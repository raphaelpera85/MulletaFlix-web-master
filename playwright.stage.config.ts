import { defineConfig, devices } from '@playwright/test';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8096';
const baseURL = (process.env.PW_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const rawResultsFile = process.env.PW_JSON_REPORT || 'reports/playwright/raw-results.json';

export default defineConfig({
    testDir: './tests/playwright/specs',
    testMatch: /.*\.spec\.(ts|js|mjs)$/,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    timeout: 120000,
    expect: {
        timeout: 10000
    },
    reporter: [
        [ 'list' ],
        [ 'json', { outputFile: rawResultsFile } ]
    ],
    use: {
        baseURL,
        launchOptions: {
            headless: false,
            args: [ '--allow-file-access-from-files' ],
            slowMo: process.env.PW_SLOW_MO ? Number(process.env.PW_SLOW_MO) : 50
        },
        viewport: {
            width: 1600,
            height: 1000
        },
        actionTimeout: 15000,
        navigationTimeout: 30000,
        ignoreHTTPSErrors: true,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    outputDir: 'test-results/playwright'
});
