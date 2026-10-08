import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE_PATH || "/Kilta/";
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))
    throw new Error("VITE_BASE_PATH must be / or a path such as /Kilta/");
  // Only the public URL and publishable key belong in the browser build.
  for (const [name, value] of Object.entries(env))
    if (
      name.startsWith("VITE_") &&
      (/SECRET|SERVICE_ROLE|PASSWORD|DATABASE/i.test(name) ||
        value.startsWith("sb_secret_"))
    )
      throw new Error("Secret variables cannot use the VITE_ prefix");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  if (key.startsWith("sb_secret_"))
    throw new Error("Supabase secret keys cannot be used in VITE_*");
  try {
    const body = JSON.parse(
      Buffer.from(key.split(".")[1] || "", "base64url").toString(),
    );
    if (body.role === "service_role")
      throw new Error("service_role must never be bundled");
  } catch (error) {
    if (error instanceof Error && error.message.includes("service_role"))
      throw error;
  }
  return {
    base,
    plugins: [react()],
    build: { target: "es2022" },
    test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
  };
});
