import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173/Kilta/",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: [
    {
      command:
        "VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_transport_mock VITE_DEMO_MODE=false npm run build -- --outDir .test-build/integration && npm run preview -- --outDir .test-build/integration --port 4173",
      url: "http://127.0.0.1:4173/Kilta/",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command:
        "VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_DEMO_MODE=true npm run build -- --outDir .test-build/demo && npm run preview -- --outDir .test-build/demo --port 4174",
      url: "http://127.0.0.1:4174/Kilta/",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command:
        "VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_DEMO_MODE=false npm run build -- --outDir .test-build/unconfigured && npm run preview -- --outDir .test-build/unconfigured --port 4175",
      url: "http://127.0.0.1:4175/Kilta/",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
