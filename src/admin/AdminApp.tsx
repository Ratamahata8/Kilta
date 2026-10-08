import { useState, useEffect } from "react";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import { useAuth, useCatalog, CatalogOverride } from "../lib/store";
import { backend, check, supabase } from "../lib/supabase";
import { configStatus } from "../lib/config";
import {
  kindLabels,
  singletonKinds,
  type Kind,
  type Role,
  type Snapshot,
  type PublicMedia,
} from "../lib/types";
import { AdminProvider, useAdmin, useSignedImages } from "./context";
import { MediaLibrary } from "./MediaLibrary";
import { EditorRoute } from "./Editor";
import { ThemeEffect } from "../components/Shell";
import {
  HomePage,
  ProductPage,
  DocumentPage,
  WorkshopPage,
  ShowroomsPage,
  ContactsPage,
} from "../pages/PublicPages";
import styles from "./Admin.module.css";
export function AdminApp() {
  const auth = useAuth();
  if (auth.loading) return <p className={styles.notice}>Проверяем доступ…</p>;
  if (!auth.session) return <Login />;
  if (!auth.role)
    return (
      <section className={styles.root}>
        <h1>Нет доступа к админке</h1>
        <p className={styles.notice}>
          {auth.error ||
            "Учётная запись не имеет роли owner или developer. Обратитесь к разработчику."}
        </p>
        <button onClick={() => void supabase?.auth.signOut()}>Выйти</button>
      </section>
    );
  return (
    <AdminProvider>
      <AdminLayout />
    </AdminProvider>
  );
}
function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className={styles.login}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError("");
        setBusy(true);
        void backend()
          .auth.signInWithPassword({
            email: String(data.get("email")),
            password: String(data.get("password")),
          })
          .then((result) => {
            check(result);
          })
          .catch((e) =>
            setError(e instanceof Error ? e.message : "Не удалось войти"),
          )
          .finally(() => setBusy(false));
      }}
    >
      <span>ДЛЯ ВЛАДЕЛЬЦА</span>
      <h1>Вход в KILTA</h1>
      <p>
        Редактируйте коллекцию, изображения и тексты без GitHub. Учётную запись
        создаёт разработчик.
      </p>
      {!configStatus.configured && (
        <p className={styles.notice}>
          Supabase не подключён. Вход и сохранение недоступны. Демо-режим не
          предоставляет фиктивную админку.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <label className={styles.field}>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={!configStatus.configured}
        />
      </label>
      <label className={styles.field}>
        Пароль
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          disabled={!configStatus.configured}
        />
      </label>
      <button
        className={styles.primary}
        disabled={!configStatus.configured || busy}
      >
        {busy ? "Входим…" : "Войти"}
      </button>
      <p className={styles.hint}>
        Публичной регистрации нет. Для первого входа или восстановления доступа
        свяжитесь с разработчиком.
      </p>
    </form>
  );
}
function AdminLayout() {
  const auth = useAuth(),
    admin = useAdmin();
  const [signoutError, setSignoutError] = useState("");
  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <div>
          <h1>Управление KILTA</h1>
          <small>
            {auth.role?.name || auth.session?.user.email} ·{" "}
            {auth.role?.role === "developer" ? "Разработчик" : "Владелец"}
          </small>
        </div>
        <button
          onClick={() =>
            void backend()
              .auth.signOut()
              .then((r) => {
                if (r.error) setSignoutError(r.error.message);
              })
          }
        >
          Выйти
        </button>
      </div>
      {signoutError && <p className={styles.error}>{signoutError}</p>}
      <div className={styles.layout}>
        <nav className={styles.sidebar} aria-label="Админка">
          <NavLink
            end
            to="/admin"
            className={({ isActive }) => (isActive ? styles.active : "")}
          >
            Обзор
          </NavLink>
          {(Object.keys(kindLabels) as Kind[]).map((kind) => (
            <NavLink
              key={kind}
              to={`/admin/content/${kind}`}
              className={({ isActive }) => (isActive ? styles.active : "")}
            >
              {kindLabels[kind]}
            </NavLink>
          ))}
          <hr />
          <NavLink
            to="/admin/media"
            className={({ isActive }) => (isActive ? styles.active : "")}
          >
            Изображения и PDF
          </NavLink>
          <NavLink
            to="/admin/inquiries"
            className={({ isActive }) => (isActive ? styles.active : "")}
          >
            Заявки
          </NavLink>
          <NavLink
            to="/admin/profile"
            className={({ isActive }) => (isActive ? styles.active : "")}
          >
            Мой профиль
          </NavLink>
          {auth.role?.role === "developer" && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) => (isActive ? styles.active : "")}
            >
              Роли пользователей
            </NavLink>
          )}
        </nav>
        <div>
          {admin.error && (
            <div className={styles.error} role="alert">
              {admin.error}
              <button onClick={() => void admin.reload().catch(() => {})}>
                Повторить загрузку
              </button>
            </div>
          )}
          {admin.loading ? (
            <p className={styles.notice}>Загружаем черновики…</p>
          ) : (
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="content/:kind" element={<ContentList />} />
              <Route path="edit/:kind/:id" element={<EditorRoute />} />
              <Route path="preview/:id" element={<PreviewPage />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="profile" element={<Profile />} />
              <Route
                path="users"
                element={
                  auth.role?.role === "developer" ? (
                    <Users />
                  ) : (
                    <p>Роли меняет только разработчик.</p>
                  )
                }
              />
              <Route path="inquiries" element={<Inquiries />} />
              <Route path="*" element={<p>Раздел не найден.</p>} />
            </Routes>
          )}
        </div>
      </div>
    </div>
  );
}
function Dashboard() {
  const { entries } = useAdmin();
  return (
    <section className={styles.panel}>
      <h2>Ваша мастерская в интернете</h2>
      <p className={styles.notice}>
        Изменения сначала сохраняются в черновик. Предпросмотр виден только
        редакторам. Кнопка «Опубликовать» обновит сайт без сборки; посетитель
        увидит изменения после обновления страницы.
      </p>
      <div className={styles.dashboard}>
        {(
          [
            "product",
            "home",
            "document",
            "appearance",
            "workshop",
            "contacts",
          ] as const
        ).map((kind) => (
          <Link key={kind} to={`/admin/content/${kind}`}>
            {kindLabels[kind]}
            <span>
              {singletonKinds.includes(kind)
                ? "Открыть настройки"
                : `Записей: ${entries.filter((e) => e.kind === kind).length}`}
            </span>
          </Link>
        ))}
        <Link to="/admin/media">
          Изображения и PDF<span>Загрузить свои фотографии</span>
        </Link>
      </div>
    </section>
  );
}
function ContentList() {
  const { kind: raw } = useParams(),
    { entries } = useAdmin(),
    { entries: published } = useCatalog();
  if (!raw || !(raw in kindLabels)) return <p>Раздел не найден.</p>;
  const kind = raw as Kind,
    rows = entries.filter((e) => e.kind === kind),
    singleton = singletonKinds.includes(kind);
  return (
    <section className={styles.panel}>
      <div className={styles.top}>
        <h2>{kindLabels[kind]}</h2>
        {(!singleton || !rows.length) && (
          <Link
            className={`${styles.button} ${styles.primary}`}
            to={`/admin/edit/${kind}/new`}
          >
            {singleton ? "Настроить страницу" : "Создать запись"}
          </Link>
        )}
      </div>
      <div className={styles.list}>
        {rows.map((row) => (
          <article key={row.id} className={styles.row}>
            <div>
              <h3>{row.draft.title}</h3>
              <p>
                {published.some((e) => e.id === row.id)
                  ? "Есть опубликованная версия"
                  : "Только черновик"}{" "}
                · Редакция {row.revision}
              </p>
            </div>
            <Link
              className={styles.button}
              to={`/admin/edit/${kind}/${row.id}`}
            >
              Редактировать
            </Link>
          </article>
        ))}
      </div>
      {!rows.length && (
        <p className={styles.notice}>
          Здесь пока нет контента. Создайте первую запись.
        </p>
      )}
    </section>
  );
}
function PreviewPage() {
  const { id } = useParams(),
    admin = useAdmin(),
    catalog = useCatalog(),
    urls = useSignedImages(admin.media);
  const entry = admin.entries.find((e) => e.id === id);
  useEffect(
    () => () => {
      const appearance = catalog.entries.find(
        (e) => e.kind === "appearance",
      )?.data;
      document.body.dataset.theme = appearance?.theme || "gallery";
      document.body.dataset.accent = appearance?.accent || "natural";
    },
    [catalog.entries],
  );
  if (!entry) return <p>Черновик не найден.</p>;
  const snapshot: Snapshot = {
    id: entry.id,
    kind: entry.kind,
    slug: entry.slug,
    data: entry.draft,
    version_id: "preview",
    published_at: entry.updated_at,
  };
  const entries = [
    ...catalog.entries.filter((e) => e.id !== entry.id),
    snapshot,
  ];
  const media: PublicMedia[] = admin.media.map((m) => ({
    ...m,
    url: urls[m.id],
    heroUrl: urls[m.id],
    pdf_path: m.kind === "pdf" ? m.original_path : undefined,
  }));
  return (
    <CatalogOverride entries={entries} media={media}>
      <ThemeEffect />
      <div className={styles.notice}>
        Предпросмотр черновика. Не является публичной страницей.{" "}
        <Link to={`/admin/edit/${entry.kind}/${entry.id}`}>
          Вернуться в редактор
        </Link>
      </div>
      {entry.kind === "product" ? (
        <ProductPage entry={snapshot} />
      ) : entry.kind === "document" ? (
        <DocumentPage entry={snapshot} />
      ) : entry.kind === "workshop" ? (
        <WorkshopPage />
      ) : entry.kind === "contacts" ? (
        <ContactsPage />
      ) : entry.kind === "showroom" ? (
        <ShowroomsPage />
      ) : (
        <HomePage />
      )}
    </CatalogOverride>
  );
}
function Profile() {
  const auth = useAuth();
  const [name, setName] = useState(auth.role?.name || ""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className={styles.panel}>
      <h2>Мой профиль</h2>
      <p className={styles.hint}>
        Email: {auth.session?.user.email}. Роль назначает разработчик.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setMessage("");
          void Promise.resolve(
            backend().rpc("update_profile", { p_name: name }),
          )
            .then((r) => {
              check(r);
              setMessage(
                "Имя сохранено. При следующем входе оно обновится в заголовке.",
              );
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <label className={styles.field}>
          Имя
          <input
            value={name}
            maxLength={160}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div>
          <button className={styles.primary} disabled={busy}>
            Сохранить имя
          </button>
        </div>
      </form>
      <h3>Сменить пароль</h3>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            data = new FormData(form);
          setBusy(true);
          setError("");
          setMessage("");
          void (async () => {
            check(
              await backend().auth.signInWithPassword({
                email: auth.session!.user.email!,
                password: String(data.get("current")),
              }),
            );
            check(
              await backend().auth.updateUser({
                password: String(data.get("new")),
              }),
            );
            form.reset();
            setMessage("Пароль изменён.");
          })()
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <label className={styles.field}>
          Текущий пароль
          <input
            name="current"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label className={styles.field}>
          Новый пароль
          <input
            name="new"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <small>Не менее 12 символов.</small>
        </label>
        <div>
          <button disabled={busy}>Сменить пароль</button>
        </div>
      </form>
    </section>
  );
}
function Users() {
  const [users, setUsers] = useState<Role[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const reload = async () => {
    setUsers(check(await backend().from("user_roles").select("*")) as Role[]);
  };
  useEffect(() => {
    void reload().catch((e) => setError(e.message));
  }, []);
  const auth = useAuth();
  return (
    <section className={styles.panel}>
      <h2>Роли пользователей</h2>
      <p className={styles.notice}>
        Создание пользователей и восстановление доступа выполняется
        разработчиком в Supabase Auth. Секретного ключа в браузере нет. Здесь
        можно назначить роль уже созданному пользователю.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError("");
          setMessage("");
          void Promise.resolve(
            backend().rpc("set_user_role", {
              p_user_id: String(data.get("id")),
              p_role: String(data.get("role")),
            }),
          )
            .then((r) => {
              check(r);
              setMessage("Роль назначена.");
              return reload();
            })
            .catch((e) => setError(e.message));
        }}
      >
        <label className={styles.field}>
          ID пользователя из Supabase Auth
          <input name="id" required pattern="[0-9a-fA-F-]{36}" />
          <small>Сначала создайте учётную запись в Auth → Users.</small>
        </label>
        <label className={styles.field}>
          Роль
          <select name="role">
            <option value="owner">Владелец</option>
            <option value="developer">Разработчик</option>
          </select>
        </label>
        <div>
          <button className={styles.primary}>Назначить роль</button>
        </div>
      </form>
      <div className={styles.list} style={{ marginTop: 25 }}>
        {users.map((u) => (
          <article key={u.user_id} className={styles.row}>
            <div>
              <h3>
                {u.name || "Без имени"}{" "}
                {u.user_id === auth.session?.user.id ? "(вы)" : ""}
              </h3>
              <p>
                {u.role} · {u.user_id}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function Inquiries() {
  const [rows, setRows] = useState<
      {
        id: string;
        name: string;
        contact: string;
        message: string;
        status: string;
        created_at: string;
      }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    void Promise.resolve(
      backend()
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false }),
    )
      .then((r) => {
        setRows(check(r));
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className={styles.panel}>
      <h2>Заявки</h2>
      <p className={styles.notice}>
        Публичная форма отключена. Эта версия не собирает персональные данные.
        Для её включения потребуется отдельно согласованная Supabase Edge
        Function с серверной проверкой и защитой от злоупотреблений.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!rows.length && <p>Заявок нет.</p>}
      {rows.map((row) => (
        <article className={styles.row} key={row.id}>
          <div>
            <h3>{row.name}</h3>
            <p>
              {row.contact} · {new Date(row.created_at).toLocaleString("ru-RU")}
            </p>
            <p>{row.message}</p>
          </div>
          <label className={styles.field}>
            Обработка
            <select
              value={row.status}
              onChange={(e) => {
                const status = e.target.value;
                void Promise.resolve(
                  backend()
                    .from("inquiries")
                    .update({ status })
                    .eq("id", row.id)
                    .select("id")
                    .single(),
                )
                  .then((r) => {
                    check(r);
                    setRows(
                      rows.map((i) => (i.id === row.id ? { ...i, status } : i)),
                    );
                  })
                  .catch((e) => setError(e.message));
              }}
            >
              <option value="new">Новая</option>
              <option value="progress">В работе</option>
              <option value="done">Завершена</option>
            </select>
          </label>
        </article>
      ))}
    </section>
  );
}
