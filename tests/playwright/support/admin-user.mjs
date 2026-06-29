import { expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { fetchStagePublicInfo, navigateStage, openLogin, resolveStageUrl, seedStageConnection, waitForDashboardBridge } from './stage.mjs';
import { ensureWizardCompleted } from './wizard.mjs';

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
    await seedStageConnection(page);
    await openLogin(page);
    await waitForStageBridge(page);
    const loginPage = page.locator('#loginPage:not(.hide)').first();

    if (!(await loginPage.locator('.manualLoginForm').isVisible().catch(() => false))) {
        await loginPage.locator('.btnManual').click({ force: true });
    }

    await loginPage.locator('#txtManualName').waitFor({ state: 'visible', timeout: 30_000 });
    await loginPage.locator('#txtManualName').fill(username);
    await loginPage.locator('#txtManualPassword').fill(password);
    await loginPage.locator('.manualLoginForm button[type="submit"]').click();

    await page.locator('#indexPage').waitFor({ state: 'visible', timeout: 30_000 });
    await expect(page.locator('.headerUserButton')).toHaveAttribute('title', username, { timeout: 30_000 });
    return {
        User: {
            Name: username
        }
    };
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
    await page.locator('#loginPage:not(.hide)').first().waitFor({ state: 'visible', timeout: 30_000 });
}

export async function createCommonUser(page) {
    const info = await fetchStagePublicInfo();
    const credentials = createCredentials();

    const user = await page.evaluate(async ({ currentUsername, currentPassword }) => {
        const createdUser = await window.ApiClient.createUser({
            Name: currentUsername,
            Password: currentPassword
        });

        if (!createdUser?.Id) {
            throw new Error('User creation did not return an id.');
        }

        return {
            username: createdUser.Name || currentUsername,
            password: currentPassword,
            userId: createdUser.Id
        };
    }, {
        currentUsername: credentials.username,
        currentPassword: credentials.password
    });

    const stagedUser = {
        ...user,
        serverId: info.Id
    };

    await saveSharedUser(stagedUser);
    return stagedUser;
}

export async function loadOrCreateSharedUser(page) {
    const info = await fetchStagePublicInfo();
    const sharedUser = await readSharedUser();
    if (sharedUser && sharedUser.serverId === info.Id) {
        return sharedUser;
    }

    if (sharedUser) {
        await clearSharedUser();
    }

    return createCommonUser(page);
}

export async function openUserTab(page, userId, tab) {
    const tabRoutes = {
        profile: 'profile',
        access: 'access',
        parentalcontrol: 'parentalcontrol',
        password: 'password'
    };
    const tabLabels = {
        profile: /Perfil|Profile/i,
        access: /Acesso|Access/i,
        parentalcontrol: /Controle Parental|Parental Control/i,
        password: /Senha|Password/i
    };

    await page.goto(resolveStageUrl(`/dashboard/users/${userId}/${tabRoutes[tab] || 'profile'}`), {
        waitUntil: 'domcontentloaded'
    });
    await page.locator('#usersEditPage').waitFor({ state: 'visible', timeout: 30_000 });

    const tabSelectors = {
        profile: '.editUserProfileForm',
        access: '.userLibraryAccessForm',
        parentalcontrol: '.userParentalControlForm',
        password: '.updatePasswordForm'
    };

    const selector = tabSelectors[tab] || '.editUserProfileForm';
    const tabLocator = page.getByRole('tab', { name: tabLabels[tab] || /Perfil|Profile/i }).first();

    if (!(await page.locator(selector).isVisible().catch(() => false))) {
        await tabLocator.click({ force: true });
    }

    await page.locator(selector).waitFor({ state: 'visible', timeout: 30_000 });
}

export async function deleteUserById(page, userId) {
    await page.evaluate(async (id) => {
        await window.ApiClient.deleteUser(id);
    }, userId);
}

export async function waitForStageBridge(page) {
    await waitForDashboardBridge(page);
}

export { ensureWizardCompleted };
