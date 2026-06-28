import { expect } from '@playwright/test';

export const DEFAULT_STAGE_BASE_URL = 'http://127.0.0.1:8096';

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

export function resolveStageUrl(route = '/') {
    const baseUrl = getStageBaseUrl();
    const normalizedRoute = normalizeRoute(route);

    if (normalizedRoute === '/') {
        return `${baseUrl}/`;
    }

    return `${baseUrl}/#${normalizedRoute}`;
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
    await page.waitForFunction(() => Boolean(window.Dashboard && typeof window.Dashboard.navigate === 'function'));
}

export async function navigateStage(page, route) {
    const normalizedRoute = normalizeRoute(route);
    await openStage(page);
    await waitForDashboardBridge(page);
    await page.evaluate(targetRoute => {
        window.Dashboard.navigate(targetRoute);
    }, normalizedRoute);
}

export async function fetchStagePublicInfo(baseUrl = getStageBaseUrl()) {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/System/Info/Public`, {
        cache: 'no-cache'
    });

    expect(response.ok).toBeTruthy();
    return response.json();
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
    await expect(page.locator('#loginPage')).toBeVisible();
}

export async function expectUserStage(page) {
    const homePage = page.locator('#indexPage.homePage');
    await expect(homePage).toBeVisible();
}

export async function detectVisibleStage(page) {
    if (await page.locator('#wizardStartPage').isVisible().catch(() => false)) {
        return 'wizard';
    }

    if (await page.locator('#dashboardPage').isVisible().catch(() => false)) {
        return 'admin';
    }

    if (await page.locator('#indexPage.homePage').isVisible().catch(() => false)) {
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
