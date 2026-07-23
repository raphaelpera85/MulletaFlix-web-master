import { defineConfig, devices } from '@playwright/test';

const stageUrl = process.env.PW_BASE_URL || process.env.STAGE_URL || 'http://127.0.0.1:8096';
const reportFile = process.env.PW_JSON_REPORT || 'reports/playwright/raw-results.json';

export default defineConfig({
    testDir: './tests/playwright/specs',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 90_000,
    expect: {
        timeout: 15_000
    },
    use: {
        baseURL: stageUrl,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 15_000
    },
    reporter: [
        [ 'line' ],
        [ 'json', { outputFile: reportFile } ]
    ],
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: {
        command: 'npm run serve',
        url: stageUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
    }
});
