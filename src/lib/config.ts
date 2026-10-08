export function validatePublicConfig(url: string, key: string) {
  if (!url && !key) return { configured: false, error: null };
  if (!url || !key)
    return {
      configured: false,
      error: "Укажите URL Supabase и публичный publishable key.",
    };
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      )
    )
      throw new Error("URL проекта должен использовать HTTPS.");
    if (key.startsWith("sb_secret_"))
      throw new Error("Секретный ключ запрещён в браузере.");
    if (!key.startsWith("sb_publishable_")) {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon")
        throw new Error("Разрешён только publishable key или legacy anon key.");
    }
    return { configured: true, error: null };
  } catch (error) {
    return {
      configured: false,
      error:
        error instanceof Error
          ? error.message
          : "Неверная конфигурация Supabase.",
    };
  }
}
export const config = {
  url: import.meta.env.VITE_SUPABASE_URL || "",
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  demo: import.meta.env.VITE_DEMO_MODE === "true",
  base: import.meta.env.BASE_URL,
};
export const configStatus = validatePublicConfig(config.url, config.key);
