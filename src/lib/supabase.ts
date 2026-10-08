import { createClient } from "@supabase/supabase-js";
import { config, configStatus } from "./config";
export const supabase = configStatus.configured
  ? createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)])
              : AbortSignal.timeout(20000),
          }),
      },
    })
  : null;
export function backend() {
  if (!supabase)
    throw new Error("Supabase не подключён. Данные не сохраняются.");
  return supabase;
}
export function publicURL(path: string, bucket = "kilta-public") {
  return backend().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
export function check<
  T extends { data: unknown; error: { message: string; code?: string } | null },
>(result: T): NonNullable<T["data"]> {
  if (result.error) {
    if (result.error.code === "40001" || result.error.code === "40P01")
      throw new Error(
        "Запись изменилась или редактируется одновременно. Обновите данные и повторите действие.",
      );
    throw new Error(result.error.message);
  }
  return result.data as NonNullable<T["data"]>;
}
