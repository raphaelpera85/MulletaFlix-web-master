import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';
import {
    clearSharedUser,
    createCommonUser,
    deleteUserById,
    getAdminCredentials,
    loginWithManualForm,
    logoutViaDashboard,
    readSharedUser,
} from '../support/admin-user.mjs';
import { navigateStage, openLogin } from '../support/stage.mjs';
import { ensureWizardCompleted } from '../support/wizard.mjs';

test.describe.serial('20 - Common user', () => {
    test('logs in as the created user and proves the session on home', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        let sharedUser = await readSharedUser();

        if (!sharedUser) {
            await loginWithManualForm(page, admin.username, admin.password);
            sharedUser = await createCommonUser(page);
            await logoutViaDashboard(page);
        }

        await loginWithManualForm(page, sharedUser.username, sharedUser.password);
        await navigateStage(page, '/mypreferencesmenu');

        await expect(page.locator('.headerUserButton')).toHaveCount(1);
        await expect(page.locator('.headerUserButton')).toHaveAttribute('title', sharedUser.username);

        await expect(page.locator('#myPreferencesMenuPage')).toBeVisible();
        await expect(page.locator('#myPreferencesMenuPage .headerUsername').first()).toHaveText(sharedUser.username);
        await expect(page.locator('#myPreferencesMenuPage .lnkUserProfile')).toBeVisible();
        await expect(page.locator('#myPreferencesMenuPage .lnkHomePreferences')).toBeVisible();
        await expect(page.locator('#myPreferencesMenuPage .btnLogout')).toHaveCount(1);
        await expect(page.locator('#myPreferencesMenuPage .adminSection')).toHaveCount(0);

        await logoutViaDashboard(page);

        await loginWithManualForm(page, admin.username, admin.password);
        await deleteUserById(page, sharedUser.userId);
        await clearSharedUser();
        await logoutViaDashboard(page);
    });

    test('opens the user profile and preference menu from the current session', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);

        let sharedUser = await readSharedUser();
        if (!sharedUser) {
            await loginWithManualForm(page, admin.username, admin.password);
            sharedUser = await createCommonUser(page);
            await logoutViaDashboard(page);
        }

        await loginWithManualForm(page, sharedUser.username, sharedUser.password);
        await navigateStage(page, `/userprofile?userId=${sharedUser.userId}`);

        await expect(page.locator('#userProfilePage')).toBeVisible();
        await expect(page.locator('h2.username')).toHaveText(sharedUser.username);
        await expect(page.locator('#btnAddImage')).toBeVisible();
        await expect(page.locator('.updatePasswordForm')).toBeVisible();
        await expect(page.locator('#txtNewPassword')).toBeVisible();
        await expect(page.locator('#txtNewPasswordConfirm')).toBeVisible();

        await navigateStage(page, '/mypreferencesmenu');
        await expect(page.locator('#myPreferencesMenuPage')).toBeVisible();
        await expect(page.locator('#myPreferencesMenuPage .lnkUserProfile')).toBeVisible();
        await expect(page.locator('#myPreferencesMenuPage .lnkDisplayPreferences')).toBeVisible();
        await expect(page.locator('#myPreferencesMenuPage .lnkHomePreferences')).toBeVisible();
        await expect(page.locator('#myPreferencesMenuPage .lnkPlaybackPreferences')).toBeVisible();
        await expect(page.locator('#myPreferencesMenuPage .lnkSubtitlePreferences')).toBeVisible();
        await expect(page.locator('#myPreferencesMenuPage .btnLogout')).toHaveCount(1);
        await expect(page.locator('#myPreferencesMenuPage .adminSection')).toHaveCount(0);

        await logoutViaDashboard(page);
    });

    test('registers a common user from the login screen and signs in', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);

        await loginWithManualForm(page, admin.username, admin.password);
        const existingUserNames = new Set((await page.evaluate(async () => {
            const users = await window.ApiClient.getUsers();
            return users.map((user) => String(user.Name || '').toLowerCase());
        })).filter(Boolean));
        await logoutViaDashboard(page);

        const passwordSeed = crypto.randomUUID().slice(0, 8);
        const password = `User@${passwordSeed}2026`;

        let username;
        do {
            username = `mflx-register-${crypto.randomUUID().slice(0, 8)}@example.com`;
        } while (existingUserNames.has(username.toLowerCase()));

        await openLogin(page);
        await page.locator('.btnRegister:visible').click();

        const registerDialog = page.locator('.formDialog');
        await expect(registerDialog).toBeVisible({ timeout: 30_000 });
        await registerDialog.locator('#txtRegisterName').fill(username);
        await registerDialog.locator('#txtRegisterPassword').fill(password);
        await registerDialog.locator('#txtRegisterConfirmPassword').fill(password);
        await registerDialog.getByRole('button', { name: /Register|Registrar|Cadastrar/i }).click();
        await expect(registerDialog).toBeHidden({ timeout: 30_000 });

        await loginWithManualForm(page, username, password);
        await expect(page.locator('.headerUserButton')).toHaveCount(1);
        await expect(page.locator('.headerUserButton')).toHaveAttribute('title', username);
        await logoutViaDashboard(page);

        await loginWithManualForm(page, admin.username, admin.password);
        const createdUserId = await page.evaluate(async (registeredUsername) => {
            const users = await window.ApiClient.getUsers();
            return users.find((user) => user.Name === registeredUsername)?.Id || null;
        }, username);

        if (createdUserId) {
            await deleteUserById(page, createdUserId);
        }

        await logoutViaDashboard(page);
    });
});
