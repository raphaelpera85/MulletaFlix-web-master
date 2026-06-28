import { expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { navigateStage, openLogin, openStage, STAGE_ROUTES, waitForDashboardBridge } from './stage.mjs';

const ADMIN_USER = process.env.MFLX_ADMIN_USER || 'Raphael';
const ADMIN_PASSWORD = process.env.MFLX_ADMIN_PASSWORD || 'Bug309c*';
const SHARED_USER_FILE = process.env.MFLX_SHARED_USER_FILE
    || path.join(os.tmpdir(), 'mulletaflix-playwright-common-user.json');

function createCredentials() {
    const suffix = crypto.randomUUID().slice(0, 8);

    return {
        username: `mflx-user-${suffix}`,
        password: `User@${suffix}2026`
    };
}

export function getAdminCredentials() {
    return {
        username: ADMIN_USER,
        password: ADMIN_PASSWORD
    };
}

export async function readSharedUser() {
    try {
        const content = await fs.readFile(SHARED_USER_FILE, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return null;
        }

        throw error;
    }
}

export async function saveSharedUser(user) {
    await fs.mkdir(path.dirname(SHARED_USER_FILE), { recursive: true });
    await fs.writeFile(SHARED_USER_FILE, JSON.stringify(user, null, 2), 'utf8');
}

export async function clearSharedUser() {
    try {
        await fs.unlink(SHARED_USER_FILE);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }
}

export async function loginWithManualForm(page, username, password) {
    await openLogin(page);

    const manualButton = page.locator('.btnManual');
    if (await manualButton.isVisible().catch(() => false)) {
        await manualButton.click();
    }

    await page.locator('#txtManualName').fill(username);
    await page.locator('#txtManualPassword').fill(password);
    await page.locator('.manualLoginForm button[type="submit"]').click();
    await page.locator('.headerUserButton').waitFor({ state: 'visible', timeout: 30_000 });
}

export async function logoutViaDrawer(page) {
    const drawerButton = page.locator('.mainDrawerButton');
    await drawerButton.waitFor({ state: 'visible', timeout: 30_000 });
    await drawerButton.click();
    await page.locator('.btnLogout').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('.btnLogout').click();
    await page.locator('#loginPage').waitFor({ state: 'visible', timeout: 30_000 });
}

export async function logoutViaDashboard(page) {
    await page.evaluate(() => {
        window.Dashboard.logout();
    });
    await page.locator('#loginPage').waitFor({ state: 'visible', timeout: 30_000 });
}

function parseUserIdFromHash(url) {
    const hash = new URL(url).hash.replace(/^#\/?/, '/');
    const parts = hash.split('/').filter(Boolean);
    return parts[2] || '';
}

export async function createCommonUser(page) {
    const credentials = createCredentials();

    await navigateStage(page, '/dashboard/users/add');
    await page.locator('#newUserPage').waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('#txtUsername').fill(credentials.username);
    await page.locator('#txtPassword').fill(credentials.password);

    const enableFolders = page.locator('.chkEnableAllFolders');
    if (await enableFolders.count()) {
        const folderToggle = enableFolders.first();
        if (await folderToggle.isVisible().catch(() => false) && !(await folderToggle.isChecked())) {
            await folderToggle.check();
        }
    }

    const enableChannels = page.locator('.chkEnableAllChannels');
    if (await enableChannels.count()) {
        const channelToggle = enableChannels.first();
        if (await channelToggle.isVisible().catch(() => false) && !(await channelToggle.isChecked())) {
            await channelToggle.check();
        }
    }

    await page.locator('form.newUserProfileForm button[type="submit"]').click();
    await page.locator('#usersEditPage').waitFor({ state: 'visible', timeout: 30_000 });

    const user = {
        ...credentials,
        userId: parseUserIdFromHash(page.url())
    };

    await saveSharedUser(user);
    return user;
}

export async function loadOrCreateSharedUser(page) {
    const sharedUser = await readSharedUser();
    if (sharedUser) {
        return sharedUser;
    }

    return createCommonUser(page);
}

export async function openUserTab(page, userId, tab) {
    await navigateStage(page, `/dashboard/users/${userId}/${tab}`);
    await page.locator('#usersEditPage').waitFor({ state: 'visible', timeout: 30_000 });
}

export async function deleteUserById(page, userId) {
    await page.evaluate(async (id) => {
        await window.ApiClient.deleteUser(id);
    }, userId);
}

export async function waitForStageBridge(page) {
    await waitForDashboardBridge(page);
}
