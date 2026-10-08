# Настройка Supabase и GitHub Pages

Для просмотра без Supabase используйте [DEMO_PAGES](DEMO_PAGES.md). Pages workflow по умолчанию собирает read-only демо; следующие шаги нужны только для общей работающей админки и реального контента.

Это однократная работа разработчика. Владелец после настройки пользуется только админкой сайта. Не присылайте пароли, ключи service_role или строки подключения в чат. В frontend нужны только URL проекта и публичный ключ.

## 1. Управляемый проект

Создайте проект Supabase, выберите согласованный регион, план и способ резервирования. Проверьте доступность сервиса для команды, квоты Auth/Storage/egress и необходимость оплаты. Пароль PostgreSQL храните в менеджере секретов, не в `VITE_*` и не в репозитории.

Примените `supabase/migrations/20261008000100_kilta.sql` через SQL Editor или стандартный миграционный процесс Supabase CLI с административным доступом, например `supabase link` и `supabase db push`. Credentials CLI вводятся защищённо; сам CLI не нужен владельцу или frontend runtime. Миграция транзакционная. В существующем проекте сначала проверьте названия объектов и отсутствие конфликтующих permissive policies. Не запускайте SQL-тестовую инфраструктуру `tests/sql/run.mjs` в облачном/production проекте.

Миграция создаёт таблицы, ограничения, RLS, grants, role-checked RPC и buckets:

| Bucket                   | Доступ                      | Максимум / MIME              |
| ------------------------ | --------------------------- | ---------------------------- |
| `kilta-originals`        | приватный, только редакторы | 20 МБ; JPEG, PNG, WebP, AVIF |
| `kilta-documents`        | приватный, только редакторы | 10 МБ; PDF                   |
| `kilta-public`           | публичные копии изображений | 20 МБ; только WebP           |
| `kilta-public-documents` | публичные PDF               | 10 МБ; только PDF            |

Проверьте Storage → Buckets после миграции. Не переводите приватные buckets в public и не добавляйте широкие anon/authenticated write policies. RLS policies складываются через OR: сторонняя permissive policy может отменить ожидаемый запрет. Серверные bucket MIME/size ограничения обязательны независимо от клиентских проверок.

Для безопасного начального наполнения **явно**, при желании, выполните `supabase/seed.sql`: восемь категорий и базовые страницы; примеры юридических документов только черновики. Seed не создаёт пользователей и не перезаписывает существующие slug/данные. Фотографии и подтверждённые реквизиты добавляет владелец. Автоматического seed при загрузке сайта/deploy нет.

## 2. Auth и роли

В Authentication → Providers → Email оставьте email/password, **отключите Allow new users to sign up**. Проверьте настройку фактической версии Dashboard: публичный endpoint signup должен отказывать. Сайт не содержит кнопки регистрации, но одного этого недостаточно.

В Authentication → Users → Add user создайте owner и при необходимости developer с надёжными уникальными паролями; подтверждение email/доставку приглашения выполните через Dashboard. Начальные пароли не встроены в код, seed или SQL.

В SQL Editor назначьте роль уже созданному UUID (замените значения своими):

```sql
insert into public.user_roles(user_id, role, name)
values ('AUTH_USER_UUID', 'owner', 'Имя владельца');
-- Аналогично отдельный user_id с role='developer' при необходимости.
```

Owner может править контент, своё имя и пароль, но не роли. Developer назначает роли существующим пользователям через «Роли пользователей» и защищённый RPC. Создание учётных записей/восстановление забытых паролей остаётся в Dashboard. User metadata не используется для принятия решения о роли. Не назначайте service_role браузерному клиенту.

## 3. URL и переменные

Для текущего project Pages ожидаемый адрес (после фактического deploy):

```text
https://ratamahata8.github.io/Kilta/
https://ratamahata8.github.io/Kilta/#/admin
```

Путь `/Kilta/` регистрозависим. Никакой server rewrite и путь `/admin` без hash не нужны. В Authentication → URL Configuration:

- Site URL: фактический адрес `https://ratamahata8.github.io/Kilta/`.
- Redirect URLs: этот же адрес; для локальной разработки — точный локальный origin с `/Kilta/`. Если позже реализуется отдельный callback/recovery flow, добавьте только его согласованный URL. Не добавляйте широкие wildcard на чужие домены.

В текущей версии вход — email/password; email recovery UI не реализован. Восстановление делает разработчик в Dashboard; не обещайте непроверенный redirect reset-password сценарий.

Project Settings → API: скопируйте URL и **publishable** key. Для legacy anon key проверьте роль `anon` и реальные policies. В `.env.local` разработчика или в GitHub Actions Variables задайте `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_BASE_PATH=/Kilta/`. Никогда не используйте `sb_secret_*`, service_role, DB password или SMTP в VITE.

## 4. GitHub Pages

Проверьте тариф владельца репозитория: private Pages требует поддерживаемого платного плана. Если Settings → Pages недоступны для private-репозитория, сначала решите этот blocker с владельцем. Видимость автоматически не меняйте, приватный материал в отдельный public-репозиторий не копируйте.

Settings → Pages → Build and deployment → Source: GitHub Actions. Проверьте environment `github-pages`, ограничения deploy и необходимые approvals, если они включены в аккаунте. После настройки Supabase выберите Actions → Deploy KILTA to GitHub Pages → Run workflow → Branch: main → Mode: supabase. Для автоматического подключения Supabase при следующих push задайте Actions Variable `KILTA_DEPLOY_MODE=supabase`; без неё push продолжит публиковать демо. Успех локальной сборки не доказывает deploy, действующий HTTPS или доступ к Supabase.

Для согласованного custom domain root: `VITE_BASE_PATH=/`, затем отдельно настройте домен в Pages. В этой реализации домен не меняется. Повторный frontend deploy меняет статические файлы, не БД и не Storage; миграции/seed не запускаются автоматически.

## 5. Проверка реального подключения

Используйте отдельный тестовый проект и искусственные данные. В защищённом окружении задайте `TEST_SUPABASE_URL`, `TEST_SUPABASE_PUBLISHABLE_KEY`, `TEST_OWNER_EMAIL`, `TEST_OWNER_PASSWORD`, `TEST_OUTSIDER_EMAIL`, `TEST_OUTSIDER_PASSWORD`, `TEST_ALLOW_WRITES=true`; outsider — существующий Auth пользователь **без записи в user_roles**. Запустите `npm run test:live`. Никогда не выдавайте mock browser tests за эту проверку.

Ручной приёмочный сценарий в двух независимых браузерах:

1. Owner входит через `…/Kilta/#/admin`, загружает два изображения, сохраняет черновик предмета, меняет порядок галереи и открывает предпросмотр.
2. Анонимный браузер не видит запись. Прямые Data API запросы к `content`, `versions`, `user_roles`, `inquiries` и приватным Storage objects не раскрывают данные. Outsider не может редактировать, owner не может повысить роль.
3. Публикация делает предмет видимым после refresh другого браузера. Следующая правка черновика оставляет старый снимок. Изменение первого экрана и темы проходит без Actions build.
4. Документ публикуется, адрес стабилен, восстановление прежней редакции создаёт новый черновик и сохраняет историю.
5. Проверить выход, смену пароля и повторный вход. Провести повторный frontend deploy и проверить прежние записи/файлы. Проверить серверные size/MIME отказы прямыми Storage API запросами.
6. Выполнить резервную копию и восстановление в отдельном проекте согласно BACKUP.md. Проверить именно восстановленные данные и bytes файлов, а не наличие архива.

Не включайте сбор реальных персональных данных до отдельного согласования инфраструктуры и правил обработки. Никаких писем сайт пока не отправляет.
