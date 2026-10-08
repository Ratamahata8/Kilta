import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Entry, Media } from "../lib/types";
import { listDrafts, listMedia, privateURL } from "../lib/api";
type State = {
  entries: Entry[];
  media: Media[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<{ entries: Entry[]; media: Media[] }>;
};
const Context = createContext<State | null>(null);
export function AdminProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]),
    [media, setMedia] = useState<Media[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setError(null);
    try {
      const [entries, media] = await Promise.all([listDrafts(), listMedia()]);
      setEntries(entries);
      setMedia(media);
      return { entries, media };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);
  return (
    <Context.Provider value={{ entries, media, loading, error, reload }}>
      {children}
    </Context.Provider>
  );
}
export function useAdmin() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing AdminProvider");
  return context;
}
export function useSignedImages(media: Media[]) {
  const [urls, setURLs] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const update = async () => {
      const results = await Promise.allSettled(
        media.map(async (m) => [m.id, await privateURL(m)] as const),
      );
      if (active)
        setURLs(
          Object.fromEntries(
            results
              .filter(
                (r): r is PromiseFulfilledResult<readonly [string, string]> =>
                  r.status === "fulfilled",
              )
              .map((r) => r.value),
          ),
        );
    };
    void update();
    const timer = setInterval(() => void update(), 240000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [media]);
  return urls;
}
