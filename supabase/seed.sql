-- OPTIONAL, EXPLICIT starter content. Never run on startup/deployment.
-- Run as database administrator AFTER migrations. Safe to repeat: skips every
-- existing (including archived) slug; never edits user data or user accounts.
begin;
do $$
declare row record; content_id uuid; version_id uuid;
begin
  for row in select * from (values
    ('home','home','{"title":"Главная","heading":"Предметы с характером","subtitle":"Авторская мебель и скульптуры KILTA","primaryLabel":"Смотреть коллекцию","secondaryLabel":"Обсудить заказ","sections":[{"section":"featured","visible":true},{"section":"categories","visible":true},{"section":"workshop","visible":true},{"section":"custom","visible":true},{"section":"showrooms","visible":true}]}'::jsonb,true),
    ('workshop','workshop','{"title":"Мастерская","heading":"Мастерская KILTA","body":{"type":"doc","content":[{"type":"paragraph"}]}}'::jsonb,true),
    ('appearance','appearance','{"title":"Оформление","theme":"gallery","accent":"natural"}'::jsonb,true),
    ('contacts','contacts','{"title":"Контакты и реквизиты"}'::jsonb,true),
    ('navigation','navigation','{"title":"Навигация и подвал","footerText":"Авторская мебель и скульптуры","links":[{"label":"Коллекция","href":"/catalog"},{"label":"Мастерская","href":"/workshop"},{"label":"Шоурумы","href":"/showrooms"},{"label":"Контакты","href":"/contacts"}]}'::jsonb,true),
    ('seo','seo','{"title":"SEO","siteName":"KILTA","description":"Авторская мебель и скульптуры KILTA"}'::jsonb,true),
    ('category','shezlongi','{"title":"Шезлонги","order":0}'::jsonb,true),
    ('category','skulptury','{"title":"Скульптуры","order":1}'::jsonb,true),
    ('category','konsoli','{"title":"Консоли","order":2}'::jsonb,true),
    ('category','komody','{"title":"Комоды","order":3}'::jsonb,true),
    ('category','shirmy','{"title":"Ширмы","order":4}'::jsonb,true),
    ('category','stoly','{"title":"Столы","order":5}'::jsonb,true),
    ('category','stellazhi','{"title":"Стеллажи","order":6}'::jsonb,true),
    ('category','torshery','{"title":"Торшеры","order":7}'::jsonb,true),
    ('document','demo-privacy','{"title":"Демо / Политика","documentType":"privacy","editionDate":"2026-10-08","body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Демонстрационный черновик. Не является юридическим документом. Владелец должен предоставить согласованный текст."}]}]}}'::jsonb,false),
    ('document','demo-consent','{"title":"Демо / Согласие","documentType":"consent","editionDate":"2026-10-08","body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Демонстрационный черновик. Реальную форму сбора данных не включаем."}]}]}}'::jsonb,false),
    ('document','demo-delivery','{"title":"Демо / Доставка и оплата","documentType":"delivery","editionDate":"2026-10-08"}'::jsonb,false),
    ('document','demo-returns','{"title":"Демо / Возврат и гарантия","documentType":"returns","editionDate":"2026-10-08"}'::jsonb,false),
    ('document','demo-details','{"title":"Демо / Реквизиты","documentType":"details","editionDate":"2026-10-08"}'::jsonb,false),
    ('document','demo-cookies','{"title":"Демо / Cookie","documentType":"cookies","editionDate":"2026-10-08"}'::jsonb,false)
  ) as starter(kind,slug,data,publish)
  loop
    if exists(select 1 from public.content where kind=row.kind and slug=row.slug) then continue; end if;
    perform public.validate_content(row.kind,row.data);
    insert into public.content(kind,slug,draft) values(row.kind,row.slug,row.data) returning id into content_id;
    insert into public.versions(content_id,slug,data,revision,action) values(content_id,row.slug,row.data,1,case when row.publish then 'publish' else 'draft' end) returning id into version_id;
    if row.publish then insert into public.published_content(id,kind,slug,data,version_id) values(content_id,row.kind,row.slug,row.data,version_id); end if;
  end loop;
end $$;
commit;
