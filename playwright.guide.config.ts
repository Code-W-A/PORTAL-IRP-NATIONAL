import { defineConfig } from "@playwright/test";
const projectId = "demo-irp-guide";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Rulează npm run test:guide pentru a folosi exclusiv emulatoarele.");
}
export default defineConfig({
  testDir: "./tests/ghid-comunicare",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3017",
    channel: "chrome",
    viewport: { width: 360, height: 780 },
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3017",
    url: "http://127.0.0.1:3017/login",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      FIREBASE_ADMIN_PROJECT_ID: projectId,
      GCLOUD_PROJECT: projectId,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId,
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${projectId}.firebaseapp.com`,
      NEXT_PUBLIC_FIREBASE_APP_ID: "demo-irp-guide-app",
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
      NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3017",
    },
  },
});
