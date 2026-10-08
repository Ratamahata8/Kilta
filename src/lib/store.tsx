import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { loadPublished, getRole } from "./api";
import { supabase } from "./supabase";
import { config, configStatus } from "./config";
import { demoEntries, demoMedia } from "./demo";
import type { Kind, Snapshot, PublicMedia, Role } from "./types";
import { defaultData } from "./types";
import type { Session } from "@supabase/supabase-js";
type CatalogState = {
  entries: Snapshot[];
  media: PublicMedia[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};
const CatalogContext = createContext<CatalogState | null>(null);
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Snapshot[]>(
    config.demo && !configStatus.configured ? demoEntries : [],
  );
  const [media, setMedia] = useState<PublicMedia[]>(
    config.demo && !configStatus.configured ? demoMedia : [],
  );
  const [loading, setLoading] = useState(configStatus.configured);
  const [error, setError] = useState<string | null>(configStatus.error);
  const refresh = useCallback(async () => {
    if (!configStatus.configured) return;
    setLoading(true);
    setError(null);
    try {
      const data = await loadPublished();
      setEntries(data.entries);
      setMedia(data.media);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <CatalogContext.Provider
      value={{ entries, media, loading, error, refresh }}
    >
      {children}
    </CatalogContext.Provider>
  );
}
export function CatalogOverride({
  entries,
  media,
  children,
}: {
  entries: Snapshot[];
  media: PublicMedia[];
  children: ReactNode;
}) {
  const old = useCatalog();
  return (
    <CatalogContext.Provider value={{ ...old, entries, media }}>
      {children}
    </CatalogContext.Provider>
  );
}
export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("Missing CatalogProvider");
  return context;
}
export function useGlobal(kind: Kind) {
  return (
    useCatalog().entries.find((e) => e.kind === kind)?.data || defaultData(kind)
  );
}
type AuthState = {
  session: Session | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
};
const AuthContext = createContext<AuthState>({
  session: null,
  role: null,
  loading: false,
  error: null,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    role: null,
    loading: Boolean(supabase),
    error: null,
  });
  useEffect(() => {
    if (!supabase) return;
    let active = true,
      epoch = 0;
    const update = async (session: Session | null) => {
      const request = ++epoch;
      setState({ session, role: null, loading: Boolean(session), error: null });
      if (session)
        try {
          const role = await getRole(session.user.id);
          if (active && epoch === request)
            setState({ session, role, loading: false, error: null });
        } catch (e) {
          if (active && epoch === request)
            setState({
              session,
              role: null,
              loading: false,
              error: e instanceof Error ? e.message : "Ошибка доступа",
            });
        }
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (active) void update(session);
      });
    });
    return () => {
      active = false;
      epoch++;
      data.subscription.unsubscribe();
    };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
