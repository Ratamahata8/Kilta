-- KILTA revision 2. Apply once through Supabase migrations / SQL Editor.
begin;
create extension if not exists pgcrypto with schema extensions;
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','developer')),
  name text not null default '' check (length(name)<=160)
);
create function public.is_editor() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('owner','developer'));
$$;
create function public.is_developer() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles where user_id=auth.uid() and role='developer');
$$;
create function public.require_editor() returns void language plpgsql security definer set search_path = '' as $$
begin if not public.is_editor() then raise exception 'Нет права редактора' using errcode='42501'; end if; end; $$;

create table public.media (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('image','pdf')),
  alt text not null check(length(alt) between 1 and 400), caption text not null default '', source text not null default '',
  focal_x integer not null default 50 check(focal_x between 0 and 100), focal_y integer not null default 50 check(focal_y between 0 and 100),
  original_path text not null unique, card_path text, hero_path text,
  mime_type text not null, bytes bigint not null check(bytes>0), width integer, height integer,
  created_at timestamptz not null default now(),
  check(original_path like id::text || '/original.%'),
  check((kind='pdf' and mime_type='application/pdf' and bytes<=10485760 and card_path is null and hero_path is null)
    or (kind='image' and mime_type in ('image/jpeg','image/png','image/webp','image/avif') and bytes<=20971520
      and card_path=id::text||'/card.webp' and hero_path=id::text||'/hero.webp' and width>0 and height>0 and width::bigint*height<=60000000))
);
create table public.content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('product','category','showroom','document','home','workshop','appearance','contacts','navigation','seo')),
  slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  draft jsonb not null check(jsonb_typeof(draft)='object'), revision bigint not null default 1,
  deleted boolean not null default false, updated_at timestamptz not null default now(),
  unique(kind,slug)
);
create unique index content_singleton on public.content(kind) where kind in ('home','workshop','appearance','contacts','navigation','seo') and not deleted;
create table public.versions (
  id uuid primary key default gen_random_uuid(), content_id uuid not null references public.content(id),
  slug text not null, data jsonb not null, revision bigint not null, action text not null check(action in ('draft','publish','restore')),
  author uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), unique(content_id,revision)
);
create table public.published_content (
  id uuid primary key references public.content(id), kind text not null, slug text not null,
  data jsonb not null, version_id uuid not null references public.versions(id), published_at timestamptz not null default now(), unique(kind,slug)
);
create table public.content_media (
  content_id uuid not null references public.content(id), media_id uuid not null references public.media(id),
  stage text not null check(stage in ('draft','published')), primary key(content_id,media_id,stage)
);
create table public.version_media (
  version_id uuid not null references public.versions(id), media_id uuid not null references public.media(id), primary key(version_id,media_id)
);
create table public.content_links (
  content_id uuid not null references public.content(id), linked_id uuid not null references public.content(id),
  stage text not null check(stage in ('draft','published')), primary key(content_id,linked_id,stage)
);
create table public.published_media (
  id uuid primary key references public.media(id), kind text not null, alt text not null, caption text not null, source text not null,
  focal_x integer not null, focal_y integer not null, card_path text, hero_path text, pdf_path text
);
create table public.inquiries (
  id uuid primary key default gen_random_uuid(), item_id uuid references public.content(id), name text not null,
  contact text not null, message text, consent_revision uuid not null references public.versions(id),
  created_at timestamptz not null default now(), status text not null default 'new' check(status in ('new','progress','done'))
);

-- Validate structured rich text. No arbitrary HTML, JS, style, or executable URL.
create function public.valid_rich(node jsonb, depth integer default 0) returns boolean language plpgsql immutable set search_path='' as $$
declare child jsonb; mark jsonb; t text;
begin
  if node is null or node='null'::jsonb then return true; end if;
  if depth>30 or jsonb_typeof(node)<>'object' then return false; end if;
  t:=node->>'type';
  if t is null or t not in ('doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','hardBreak','horizontalRule') then return false; end if;
  if t='text' and (jsonb_typeof(node->'text')<>'string' or length(node->>'text')>50000) then return false; end if;
  if t='heading' and coalesce(node->'attrs'->>'level','') not in ('1','2','3') then return false; end if;
  if node ? 'content' then
    if jsonb_typeof(node->'content')<>'array' then return false; end if;
    for child in select value from jsonb_array_elements(node->'content') loop if not public.valid_rich(child,depth+1) then return false; end if; end loop;
  end if;
  if node ? 'marks' then
    if jsonb_typeof(node->'marks')<>'array' then return false; end if;
    for mark in select value from jsonb_array_elements(node->'marks') loop
      if coalesce(mark->>'type','') not in ('bold','italic','underline','strike','code','link') then return false; end if;
      if mark->>'type'='link' and coalesce(mark->'attrs'->>'href','') !~ '^(https?://|mailto:|tel:)' then return false; end if;
    end loop;
  end if;
  return true;
end; $$;
create function public.media_ids(data jsonb) returns uuid[] language plpgsql immutable set search_path='' as $$
declare ids uuid[] := '{}'; key text; v text;
begin
  foreach key in array array['image','pdf','logo','favicon','ogImage'] loop
    v:=data->>key; if v is not null and v<>'' then ids:=array_append(ids,v::uuid); end if;
  end loop;
  for v in select jsonb_array_elements_text(coalesce(data->'gallery','[]')) loop ids:=array_append(ids,v::uuid); end loop;
  return array(select distinct unnest(ids));
end; $$;
create function public.link_ids(data jsonb) returns uuid[] language plpgsql immutable set search_path='' as $$
declare ids uuid[] := '{}'; key text; v text;
begin
  foreach key in array array['categories','items','documents'] loop
    for v in select jsonb_array_elements_text(coalesce(data->key,'[]')) loop ids:=array_append(ids,v::uuid); end loop;
  end loop;
  return array(select distinct unnest(ids));
end; $$;
create function public.validate_content(kind text, data jsonb) returns void language plpgsql set search_path='' as $$
declare key text; v jsonb; x text;
begin
  if jsonb_typeof(data)<>'object' or octet_length(data::text)>200000 then raise exception 'Неверный формат или слишком длинный текст'; end if;
  if length(coalesce(data->>'title','')) not between 1 and 160 then raise exception 'Укажите название (до 160 символов)'; end if;
  if not public.valid_rich(data->'body') or (jsonb_typeof(data->'description')='object' and not public.valid_rich(data->'description')) then raise exception 'Недопустимый формат текста'; end if;
  foreach key in array array['gallery','categories','items','documents','materials','sections','links','social'] loop
    if data ? key and (jsonb_typeof(data->key)<>'array' or jsonb_array_length(data->key)>100) then raise exception 'Неверный список: %',key; end if;
  end loop;
  if data ? 'order' and (jsonb_typeof(data->'order')<>'number' or abs((data->>'order')::numeric)>100000) then raise exception 'Неверный порядок'; end if;
  if kind='product' then
    if coalesce(data->>'priceMode','') not in ('request','exact','from') or coalesce(data->>'availability','') not in ('order','stock','sold') then raise exception 'Проверьте цену и наличие'; end if;
    if data->>'priceMode'<>'request' and (coalesce(jsonb_typeof(data->'price'),'null')<>'number' or (data->>'price')::numeric<0) then raise exception 'Укажите неотрицательную цену'; end if;
    if coalesce(data->>'unit','cm') not in ('cm','mm') or coalesce(data->>'currency','RUB')<>'RUB' then raise exception 'Неверные единицы или валюта'; end if;
    foreach key in array array['height','width','depth'] loop
      v:=data->'dimensions'->key; if v is not null and v<>'null'::jsonb and (jsonb_typeof(v)<>'number' or v::text::numeric<0) then raise exception 'Размеры не могут быть отрицательными'; end if;
    end loop;
  end if;
  if kind='document' then
    if coalesce(data->>'documentType','') not in ('privacy','consent','offer','delivery','returns','details','cookies') then raise exception 'Выберите тип документа'; end if;
    if coalesce(data->>'editionDate','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Укажите дату редакции'; end if;
    perform (data->>'editionDate')::date;
    if nullif(data->>'effectiveDate','') is not null then perform (data->>'effectiveDate')::date; end if;
  end if;
  if kind='showroom' and (length(coalesce(data->>'address',''))=0 or length(coalesce(data->>'city',''))=0) then raise exception 'Укажите город и адрес'; end if;
  if kind='appearance' and (coalesce(data->>'theme','') not in ('gallery','warm','dark') or coalesce(data->>'accent','natural') not in ('natural','clay','olive')) then raise exception 'Выберите предусмотренную тему и акцент'; end if;
  if data ? 'routeURL' and nullif(data->>'routeURL','') is not null and data->>'routeURL' !~ '^https?://' then raise exception 'Маршрут должен быть ссылкой http(s)'; end if;
  for v in select value from jsonb_array_elements(coalesce(data->'social','[]')) loop if coalesce(v->>'url','') !~ '^https?://' then raise exception 'Неверная ссылка социальной сети'; end if; end loop;
  for v in select value from jsonb_array_elements(coalesce(data->'links','[]')) loop if coalesce(v->>'href','') not in ('/','/catalog','/workshop','/showrooms','/contacts') then raise exception 'Выберите существующую страницу меню'; end if; end loop;
  for v in select value from jsonb_array_elements(coalesce(data->'sections','[]')) loop if coalesce(v->>'section','') not in ('featured','categories','workshop','custom','showrooms') or jsonb_typeof(v->'visible')<>'boolean' then raise exception 'Недопустимая секция главной'; end if; end loop;
  foreach key in array array['image','logo','favicon','ogImage'] loop
    x:=data->>key; if nullif(x,'') is not null and not exists(select 1 from public.media where id=x::uuid and media.kind='image') then raise exception 'Изображение не найдено'; end if;
  end loop;
  x:=data->>'pdf'; if nullif(x,'') is not null and not exists(select 1 from public.media where id=x::uuid and media.kind='pdf') then raise exception 'PDF не найден'; end if;
  for x in select jsonb_array_elements_text(coalesce(data->'gallery','[]')) loop if not exists(select 1 from public.media where id=x::uuid and media.kind='image') then raise exception 'Изображение галереи не найдено'; end if; end loop;
end; $$;

create function public.save_content(p_id uuid, p_kind text, p_slug text, p_data jsonb, p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.content; snapshot uuid;
begin
  perform public.require_editor(); perform public.validate_content(p_kind,p_data);
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug)>180 then raise exception 'Адрес: латинские буквы, цифры и дефисы'; end if;
  if p_id is null then
    if p_expected_revision is null or p_expected_revision<>0 then raise exception 'Конфликт редакции' using errcode='40001'; end if;
    insert into public.content(kind,slug,draft) values(p_kind,p_slug,p_data) returning * into row;
  else
    select * into row from public.content where id=p_id and not deleted for update;
    if not found or p_expected_revision is null or row.revision<>p_expected_revision then raise exception 'Запись изменена другим редактором. Обновите страницу.' using errcode='40001'; end if;
    if row.kind<>p_kind then raise exception 'Тип записи изменить нельзя'; end if;
    if p_kind='document' and p_slug<>row.slug and exists(select 1 from public.versions where content_id=p_id and action='publish') then raise exception 'Адрес опубликованного документа менять нельзя'; end if;
    update public.content set draft=p_data,slug=p_slug,revision=revision+1,updated_at=now() where id=p_id returning * into row;
  end if;
  delete from public.content_media where content_id=row.id and stage='draft';
  insert into public.content_media select row.id,unnest(public.media_ids(p_data)),'draft';
  delete from public.content_links where content_id=row.id and stage='draft';
  insert into public.content_links select row.id,unnest(public.link_ids(p_data)),'draft';
  insert into public.versions(content_id,slug,data,revision,action,author) values(row.id,row.slug,row.draft,row.revision,'draft',auth.uid()) returning id into snapshot;
  insert into public.version_media select snapshot,unnest(public.media_ids(p_data));
  return to_jsonb(row);
end; $$;
create function public.publish_content(p_id uuid,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.content; file public.media; snapshot uuid; result public.published_content; bucket text;
begin
  perform public.require_editor();
  select * into row from public.content where id=p_id and not deleted for update;
  if not found or p_expected_revision is null or row.revision<>p_expected_revision then raise exception 'Запись изменена другим редактором. Обновите страницу.' using errcode='40001'; end if;
  perform public.validate_content(row.kind,row.draft);
  perform id from public.content where id=any(public.link_ids(row.draft)) order by id for update;
  if exists(select 1 from unnest(public.link_ids(row.draft)) link where not exists(select 1 from public.published_content where id=link)) then raise exception 'Сначала опубликуйте связанные категории, предметы или документы'; end if;
  for file in select * from public.media where id=any(public.media_ids(row.draft)) loop
    if file.kind='pdf' then
      if not exists(select 1 from storage.objects where bucket_id='kilta-public-documents' and name=file.original_path) then raise exception 'Публичная копия PDF ещё не подготовлена'; end if;
    elsif not exists(select 1 from storage.objects where bucket_id='kilta-public' and name=file.card_path) or not exists(select 1 from storage.objects where bucket_id='kilta-public' and name=file.hero_path) then raise exception 'Публичные копии изображений ещё не подготовлены'; end if;
    insert into public.published_media(id,kind,alt,caption,source,focal_x,focal_y,card_path,hero_path,pdf_path)
    values(file.id,file.kind,file.alt,file.caption,file.source,file.focal_x,file.focal_y,file.card_path,file.hero_path,case when file.kind='pdf' then file.original_path end)
    on conflict(id) do update set alt=excluded.alt,caption=excluded.caption,source=excluded.source,focal_x=excluded.focal_x,focal_y=excluded.focal_y;
  end loop;
  update public.content set revision=revision+1,updated_at=now() where id=p_id returning * into row;
  insert into public.versions(content_id,slug,data,revision,action,author) values(row.id,row.slug,row.draft,row.revision,'publish',auth.uid()) returning id into snapshot;
  insert into public.version_media select snapshot,unnest(public.media_ids(row.draft));
  delete from public.content_media where content_id=p_id and stage='published';
  insert into public.content_media select p_id,unnest(public.media_ids(row.draft)),'published';
  delete from public.content_links where content_id=p_id and stage='published';
  insert into public.content_links select p_id,unnest(public.link_ids(row.draft)),'published';
  insert into public.published_content(id,kind,slug,data,version_id) values(row.id,row.kind,row.slug,row.draft,snapshot)
  on conflict(id) do update set slug=excluded.slug,data=excluded.data,version_id=excluded.version_id,published_at=now() returning * into result;
  return to_jsonb(result);
end; $$;
create function public.unpublish_content(p_id uuid,p_expected_revision bigint) returns void language plpgsql security definer set search_path='' as $$
declare row public.content;
begin
  perform public.require_editor(); select * into row from public.content where id=p_id and not deleted for update;
  if not found or p_expected_revision is null or row.revision<>p_expected_revision then raise exception 'Конфликт редакции' using errcode='40001'; end if;
  if exists(select 1 from public.content_links where linked_id=p_id and content_id<>p_id and stage='published') then raise exception 'Запись используется опубликованным контентом'; end if;
  delete from public.published_content where id=p_id;
  delete from public.content_media where content_id=p_id and stage='published';
  delete from public.content_links where content_id=p_id and stage='published';
  update public.content set revision=revision+1,updated_at=now() where id=p_id;
end; $$;
create function public.restore_version(p_version_id uuid,p_expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare version public.versions; row public.content; snapshot uuid;
begin
  perform public.require_editor(); select * into version from public.versions where id=p_version_id;
  if not found then raise exception 'Редакция не найдена'; end if;
  select * into row from public.content where id=version.content_id and not deleted for update;
  if not found or p_expected_revision is null or row.revision<>p_expected_revision then raise exception 'Конфликт редакции' using errcode='40001'; end if;
  if row.kind='document' and row.slug<>version.slug and exists(select 1 from public.versions where content_id=row.id and action='publish') then raise exception 'Адрес документа сохраняется'; end if;
  update public.content set draft=version.data,slug=version.slug,revision=revision+1,updated_at=now() where id=row.id returning * into row;
  delete from public.content_media where content_id=row.id and stage='draft';
  insert into public.content_media select row.id,unnest(public.media_ids(row.draft)),'draft';
  delete from public.content_links where content_id=row.id and stage='draft';
  insert into public.content_links select row.id,unnest(public.link_ids(row.draft)),'draft';
  insert into public.versions(content_id,slug,data,revision,action,author) values(row.id,row.slug,row.draft,row.revision,'restore',auth.uid()) returning id into snapshot;
  insert into public.version_media select snapshot,unnest(public.media_ids(row.draft));
  return to_jsonb(row);
end; $$;
create function public.delete_content(p_id uuid,p_expected_revision bigint) returns void language plpgsql security definer set search_path='' as $$
declare row public.content; used text;
begin
  perform public.require_editor(); select * into row from public.content where id=p_id and not deleted for update;
  if not found or p_expected_revision is null or row.revision<>p_expected_revision then raise exception 'Конфликт редакции' using errcode='40001'; end if;
  select string_agg(c.draft->>'title',', ') into used from public.content_links l join public.content c on c.id=l.content_id where linked_id=p_id and content_id<>p_id;
  if used is not null then raise exception 'Запись используется: %',used; end if;
  delete from public.published_content where id=p_id; delete from public.content_media where content_id=p_id; delete from public.content_links where content_id=p_id;
  update public.content set deleted=true,revision=revision+1,updated_at=now() where id=p_id;
end; $$;
create function public.set_user_role(p_user_id uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_developer() then raise exception 'Роли меняет только разработчик' using errcode='42501'; end if;
  if p_user_id=auth.uid() then raise exception 'Свою роль менять нельзя'; end if;
  insert into public.user_roles(user_id,role) values(p_user_id,p_role) on conflict(user_id) do update set role=excluded.role;
end; $$;
create function public.update_profile(p_name text) returns void language plpgsql security definer set search_path='' as $$
begin perform public.require_editor(); update public.user_roles set name=p_name where user_id=auth.uid(); end; $$;
create function public.media_usage(p_id uuid) returns table(title text,location text) language plpgsql security definer set search_path='' as $$
begin
  perform public.require_editor();
  return query select c.draft->>'title',m.stage from public.content_media m join public.content c on c.id=m.content_id where media_id=p_id
  union select v.data->>'title','история редакций' from public.version_media m join public.versions v on v.id=m.version_id where media_id=p_id;
end; $$;
create function public.delete_media(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.require_editor();
  perform id from public.media where id=p_id for update;
  if not found then raise exception 'Файл уже удалён или не найден'; end if;
  if exists(select 1 from public.content_media where media_id=p_id) or exists(select 1 from public.version_media where media_id=p_id) then raise exception 'Файл используется контентом или историей редакций'; end if;
  delete from public.published_media where id=p_id;
  delete from public.media where id=p_id;
end; $$;
create function public.media_unused(p_path text) returns boolean language sql stable security definer set search_path='' as $$
  select public.is_editor() and not exists(select 1 from public.content_media where media_id::text=split_part(p_path,'/',1)) and not exists(select 1 from public.version_media where media_id::text=split_part(p_path,'/',1));
$$;
create function public.protect_media() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.content_media where media_id=old.id) or exists(select 1 from public.version_media where media_id=old.id) then raise exception 'Файл используется контентом или историей редакций. Сначала замените ссылки; историю сохраняем для восстановления.'; end if;
    return old;
  end if;
  if (new.id,new.kind,new.original_path,new.card_path,new.hero_path,new.mime_type,new.bytes,new.width,new.height) is distinct from (old.id,old.kind,old.original_path,old.card_path,old.hero_path,old.mime_type,old.bytes,old.width,old.height) then raise exception 'Файл неизменяем: загрузите новое изображение'; end if;
  return new;
end; $$;
create trigger protect_media before update or delete on public.media for each row execute function public.protect_media();

alter table public.user_roles enable row level security;
alter table public.media enable row level security;
alter table public.content enable row level security;
alter table public.versions enable row level security;
alter table public.published_content enable row level security;
alter table public.content_media enable row level security;
alter table public.version_media enable row level security;
alter table public.content_links enable row level security;
alter table public.published_media enable row level security;
alter table public.inquiries enable row level security;
create policy own_role on public.user_roles for select to authenticated using(user_id=auth.uid() or public.is_developer());
create policy editor_media_read on public.media for select to authenticated using(public.is_editor());
create policy editor_media_insert on public.media for insert to authenticated with check(public.is_editor());
create policy editor_media_update on public.media for update to authenticated using(public.is_editor()) with check(public.is_editor());
create policy editor_media_delete on public.media for delete to authenticated using(public.is_editor());
create policy editor_content on public.content for select to authenticated using(public.is_editor());
create policy editor_versions on public.versions for select to authenticated using(public.is_editor());
create policy editor_content_media on public.content_media for select to authenticated using(public.is_editor());
create policy editor_version_media on public.version_media for select to authenticated using(public.is_editor());
create policy editor_content_links on public.content_links for select to authenticated using(public.is_editor());
create policy public_snapshots on public.published_content for select to anon,authenticated using(true);
create policy public_media on public.published_media for select to anon,authenticated using(exists(select 1 from public.content_media where media_id=published_media.id and stage='published'));
-- This helper avoids exposing private reference tables through a policy subquery.
create function public.media_is_published(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.content_media where media_id=p_id and stage='published'); $$;
drop policy public_media on public.published_media;
create policy public_media on public.published_media for select to anon,authenticated using(public.media_is_published(id));
create policy editor_inquiries on public.inquiries for select to authenticated using(public.is_editor());
create policy editor_inquiry_status on public.inquiries for update to authenticated using(public.is_editor()) with check(public.is_editor());

-- Explicit least-privilege grants; mutations use role-checked RPCs exclusively.
revoke all on public.user_roles,public.media,public.content,public.versions,public.published_content,public.content_media,public.version_media,public.content_links,public.published_media,public.inquiries from anon,authenticated;
grant select on public.published_content,public.published_media to anon,authenticated;
grant select on public.user_roles,public.content,public.versions,public.content_media,public.version_media,public.content_links,public.inquiries to authenticated;
grant select,insert,update,delete on public.media to authenticated;
grant update(status) on public.inquiries to authenticated;
revoke all on function public.require_editor(), public.validate_content(text,jsonb), public.media_ids(jsonb), public.link_ids(jsonb), public.protect_media() from public,anon,authenticated;
revoke all on function public.save_content(uuid,text,text,jsonb,bigint),public.publish_content(uuid,bigint),public.unpublish_content(uuid,bigint),public.restore_version(uuid,bigint),public.delete_content(uuid,bigint),public.set_user_role(uuid,text),public.update_profile(text),public.media_usage(uuid),public.delete_media(uuid) from public,anon,authenticated;
grant execute on function public.save_content(uuid,text,text,jsonb,bigint),public.publish_content(uuid,bigint),public.unpublish_content(uuid,bigint),public.restore_version(uuid,bigint),public.delete_content(uuid,bigint),public.set_user_role(uuid,text),public.update_profile(text),public.media_usage(uuid),public.delete_media(uuid) to authenticated;
revoke all on function public.is_editor(),public.is_developer(),public.media_is_published(uuid),public.media_unused(text),public.valid_rich(jsonb,integer) from public;
grant execute on function public.is_editor(),public.is_developer(),public.media_is_published(uuid),public.media_unused(text),public.valid_rich(jsonb,integer) to anon,authenticated;

-- Storage enforces MIME and byte limits independently of browser checks.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('kilta-originals','kilta-originals',false,20971520,array['image/jpeg','image/png','image/webp','image/avif']),
('kilta-documents','kilta-documents',false,10485760,array['application/pdf']),
('kilta-public','kilta-public',true,20971520,array['image/webp']),
('kilta-public-documents','kilta-public-documents',true,10485760,array['application/pdf']);
create policy kilta_private_read on storage.objects for select to authenticated using(bucket_id in ('kilta-originals','kilta-documents') and public.is_editor());
create policy kilta_public_read on storage.objects for select to anon,authenticated using(bucket_id in ('kilta-public','kilta-public-documents'));
create policy kilta_insert on storage.objects for insert to authenticated with check(bucket_id in ('kilta-originals','kilta-documents','kilta-public','kilta-public-documents') and public.is_editor() and exists(select 1 from public.media where id::text=split_part(name,'/',1)));
-- No overwrite policy: original and public filenames are immutable.
create policy kilta_delete on storage.objects for delete to authenticated using(bucket_id in ('kilta-originals','kilta-documents','kilta-public','kilta-public-documents') and public.media_unused(name));
commit;
