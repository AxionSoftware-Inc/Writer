import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    timeout: 45_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: "http://127.0.0.1:3007",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        reducedMotion: "reduce",
    },
    webServer: {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3007",
        url: "http://127.0.0.1:3007",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: [
        { name: "premium-desktop", use: { viewport: { width: 1440, height: 1000 } } },
        { name: "premium-mobile", use: { ...devices["iPhone 13"] } },
    ],
});
