import { expect } from '@playwright/test';

export const DEFAULT_STAGE_BASE_URL = 'http://localhost:8096';
export const DEFAULT_STAGE_CLIENT_INDEX = 'http://localhost:8096/web/index.html';

export const STAGE_ROUTES = {
    wizardStart: '/wizard/start',
    wizardSettings: '/wizard/settings',
    wizardUser: '/wizard/user',
    wizardFinish: '/wizard/finish',
    login: '/login',
    dashboard: '/dashboard',
    home: '/home'
};

function normalizeBaseUrl(baseUrl) {
    return String(baseUrl || DEFAULT_STAGE_BASE_URL).replace(/\/+$/, '');
}

function normalizeRoute(route = '/') {
    if (!route) {
        return '/';
    }

    const normalized = String(route).trim();
    if (normalized.startsWith('#/')) {
        return normalized.slice(1);
    }

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function getStageBaseUrl() {
    return normalizeBaseUrl(process.env.PW_BASE_URL || DEFAULT_STAGE_BASE_URL);
}

export function getStageClientIndexUrl() {
    return String(process.env.PW_STAGE_CLIENT_INDEX || DEFAULT_STAGE_CLIENT_INDEX).replace(/\/+$/, '');
}

export function resolveStageUrl(route = '/') {
    const baseUrl = getStageClientIndexUrl();
    const normalizedRoute = normalizeRoute(route);

    if (normalizedRoute === '/') {
        return baseUrl;
    }

    return `${baseUrl}#${normalizedRoute}`;
}

export async function openStage(page, route = '/') {
    await page.goto(resolveStageUrl(route), {
        waitUntil: 'domcontentloaded'
    });
}

export async function openLogin(page) {
    const info = await fetchStagePublicInfo();
    await openStage(page, `/login?serverid=${info.Id}`);
    await expectLoginStage(page);
}

export async function waitForDashboardBridge(page) {
    for (let attempt = 1; attempt <= 60; attempt++) {
        const ready = await page.evaluate(() => Boolean(window.Dashboard && typeof window.Dashboard.navigate === 'function'))
            .catch(() => false);

        if (ready) {
            return;
        }

        await page.waitForTimeout(1000);
    }

    throw new Error('Dashboard bridge did not become ready in time.');
}

export async function navigateStage(page, route) {
    const normalizedRoute = normalizeRoute(route);
    const bridgeReady = await page.evaluate(() => Boolean(window.Dashboard && typeof window.Dashboard.navigate === 'function'))
        .catch(() => false);

    if (!bridgeReady) {
        await openStage(page);
        await waitForDashboardBridge(page);
    }

    await page.evaluate(targetRoute => {
        window.Dashboard.navigate(targetRoute);
    }, normalizedRoute);
}

export async function fetchStagePublicInfo(baseUrl = getStageBaseUrl()) {
    let lastError;

    for (let attempt = 1; attempt <= 30; attempt++) {
        try {
            const response = await fetch(`${normalizeBaseUrl(baseUrl)}/System/Info/Public`, {
                cache: 'no-cache'
            });

            expect(response.ok).toBeTruthy();
            return response.json();
        } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    throw lastError || new Error('Failed to fetch stage public info.');
}

export async function seedStageConnection(page) {
    const info = await fetchStagePublicInfo();
    const credentials = {
        Servers: [
            {
                Id: info.Id,
                Name: info.ServerName || 'MulletaFlix API',
                ManualAddress: getStageBaseUrl(),
                LastConnectionMode: 2,
                manualAddressOnly: true,
                DateLastAccessed: Date.now(),
                UserId: null,
                AccessToken: null
            }
        ]
    };

    await page.addInitScript((seededCredentials) => {
        localStorage.setItem('jellyfin_credentials', JSON.stringify(seededCredentials));
    }, credentials);
}

export async function expectWizardStage(page) {
    await expect(page.locator('#wizardStartPage')).toBeVisible();
}

export async function expectWizardUserStage(page) {
    await expect(page.locator('#wizardUserPage')).toBeVisible();
}

export async function expectWizardSettingsStage(page) {
    await expect(page.locator('#wizardSettingsPage')).toBeVisible();
}

export async function expectWizardFinishStage(page) {
    await expect(page.locator('#wizardFinishPage')).toBeVisible();
}

export async function expectAdminStage(page) {
    await expect(page.locator('#dashboardPage')).toBeVisible();
}

export async function expectLoginStage(page) {
    await expect(page.locator('#loginPage:not(.hide)').first()).toBeVisible();
}

export async function expectUserStage(page) {
    const homePage = page.locator('#indexPage');
    await expect(homePage).toBeVisible();
}

export async function detectVisibleStage(page) {
    if (await page.locator('#wizardStartPage').isVisible().catch(() => false)) {
        return 'wizard';
    }

    if (await page.locator('#dashboardPage').isVisible().catch(() => false)) {
        return 'admin';
    }

    if (await page.locator('#indexPage').isVisible().catch(() => false)) {
        return 'user';
    }

    if (await page.locator('#loginPage').isVisible().catch(() => false)) {
        return 'login';
    }

    return 'unknown';
}

export async function assertCleanWizardStage(page) {
    const info = await fetchStagePublicInfo();
    expect(info.StartupWizardCompleted).toBe(false);
    await expectWizardStage(page);
}
