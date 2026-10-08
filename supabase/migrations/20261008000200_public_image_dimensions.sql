-- Additive: reserve the actual proportions for newly published and existing media.
begin;
alter table public.published_media add column width integer;
alter table public.published_media add column height integer;
update public.published_media p set width=m.width,height=m.height from public.media m where m.id=p.id;
create function public.published_image_dimensions() returns trigger language plpgsql security definer set search_path='' as $$
begin
  select m.width,m.height into new.width,new.height from public.media m where m.id=new.id;
  return new;
end; $$;
revoke all on function public.published_image_dimensions() from public,anon,authenticated;
create trigger published_image_dimensions before insert or update on public.published_media
for each row execute function public.published_image_dimensions();
-- New JSON fields are constrained on the server as well as in the editor.
create function public.validate_import_fields() returns trigger language plpgsql set search_path='' as $$
declare key text; value jsonb;
begin
  foreach key in array array['dimensionsText','yearText','exhibitionsText','priceNote'] loop
    if new.draft ? key and (jsonb_typeof(new.draft->key)<>'string' or length(new.draft->>key)>5000) then raise exception 'Неверный текст: %',key; end if;
  end loop;
  foreach key in array array['availabilityConfirmed','requiresReview'] loop
    if new.draft ? key and jsonb_typeof(new.draft->key)<>'boolean' then raise exception 'Неверная отметка подтверждения'; end if;
  end loop;
  foreach key in array array['contactPeople','platforms','reviewNotes'] loop
    if new.draft ? key and (jsonb_typeof(new.draft->key)<>'array' or jsonb_array_length(new.draft->key)>30) then raise exception 'Неверный список: %',key; end if;
  end loop;
  for value in select jsonb_array_elements(coalesce(new.draft->'platforms','[]')) loop
    if jsonb_typeof(value->'label') is distinct from 'string' or length(value->>'label')>160
      or jsonb_typeof(value->'description') is distinct from 'string' or length(value->>'description')>2000
      or coalesce(value->>'url','') !~ '^https?://[^[:space:]]+$' then raise exception 'Неверная площадка или ссылка'; end if;
  end loop;
  for value in select jsonb_array_elements(coalesce(new.draft->'contactPeople','[]')) loop
    if jsonb_typeof(value->'name') is distinct from 'string' or length(value->>'name')>160
      or coalesce(value->>'phone','') !~ '^[+0-9 ()-]+$' or length(value->>'phone')>80 then raise exception 'Неверный контакт'; end if;
  end loop;
  for value in select jsonb_array_elements(coalesce(new.draft->'reviewNotes','[]')) loop
    if jsonb_typeof(value)<>'string' or length(value#>>'{}')>2000 then raise exception 'Неверное примечание'; end if;
  end loop;
  if new.draft ? 'sourceInfo' and (jsonb_typeof(new.draft->'sourceInfo')<>'object'
    or jsonb_typeof(new.draft->'sourceInfo'->'referenceKey') is distinct from 'string') then raise exception 'Неверные метаданные источника'; end if;
  return new;
end; $$;
revoke all on function public.validate_import_fields() from public,anon,authenticated;
create trigger validate_import_fields before insert or update of draft on public.content
for each row execute function public.validate_import_fields();
commit;
