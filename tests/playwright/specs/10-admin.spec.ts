import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';
import {
    getAdminCredentials,
    deleteUserById,
    loadOrCreateSharedUser,
    loginWithManualForm,
    openUserTab,
    ensureWizardCompleted,
} from '../support/admin-user.mjs';
import { navigateStage, STAGE_ROUTES } from '../support/stage.mjs';

test.describe.serial('10 - Admin', () => {
    test('creates a common user and walks through profile, access, parental control and password tabs', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        await loginWithManualForm(page, admin.username, admin.password);

        const user = await loadOrCreateSharedUser(page);

        await openUserTab(page, user.userId, 'profile');
        await expect(page.getByRole('tab', { name: /Perfil|Profile/ })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Acesso|Access/ })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Controle Parental|Parental Control/ })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Senha|Password/ })).toBeVisible();
        await expect(page.locator('.editUserProfileForm')).toBeVisible();
        await expect(page.locator('#selectSyncPlayAccess')).toBeVisible();
        await expect(page.locator('.chkRemoteAccess')).toBeVisible();
        await expect(page.locator('.chkEnableLiveTvAccess')).toBeVisible();

        await page.locator('.editUserProfileForm button[type="submit"]').click();

        await openUserTab(page, user.userId, 'access');
        await expect(page.locator('.userLibraryAccessForm')).toBeVisible();
        await expect(page.locator('.folderAccessContainer')).toBeAttached();
        await expect(page.locator('.channelAccessContainer')).toBeAttached();
        await expect(page.locator('.deviceAccessContainer')).toBeAttached();
        await page.locator('.userLibraryAccessForm button[type="submit"]').click();

        await openUserTab(page, user.userId, 'parentalcontrol');
        await expect(page.locator('.userParentalControlForm')).toBeVisible();
        await expect(page.locator('#selectMaxParentalRating')).toBeVisible();
        await expect(page.locator('#btnAddAllowedTag')).toBeVisible();
        await expect(page.locator('#btnAddBlockedTag')).toBeVisible();
        await expect(page.locator('#btnAddSchedule')).toBeVisible();
        await expect(page.locator('.chkUnratedItem').first()).toBeVisible();

        await openUserTab(page, user.userId, 'password');
        await expect(page.locator('.updatePasswordForm')).toBeVisible();
        await page.locator('#txtNewPassword').fill('Mismatch-2026!');
        await page.locator('#txtNewPasswordConfirm').fill('Mismatch-2026-ALT!');
        await page.locator('.updatePasswordForm button[type="submit"]').click();
        await expect(page.getByText(/senha.*confirma.*iguais|password.*match/i)).toBeVisible();
    });

    test('smokes the main dashboard pages and form shells', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        await loginWithManualForm(page, admin.username, admin.password);

        const routes = [
            { route: STAGE_ROUTES.dashboard, selector: '#dashboardPage' },
            { route: '/dashboard/settings', selector: '#dashboardGeneralPage' },
            { route: '/dashboard/users', selector: '#userProfilesPage' },
            { route: '/dashboard/users/licenses', selector: '#userLicensesPage' },
            { route: '/dashboard/libraries', selector: '#mediaLibraryPage' },
            { route: '/dashboard/playback/streaming', selector: '#streamingSettingsPage' },
            { route: '/dashboard/activity', selector: '#serverActivityPage' },
            { route: '/dashboard/logs', selector: '#logPage' },
            { route: '/dashboard/devices', selector: '#devicesPage' },
            { route: '/dashboard/plugins', selector: '#pluginsPage' },
            { route: '/dashboard/plugins/repositories', selector: '#repositories' },
            { route: '/dashboard/branding', selector: '#brandingPage' },
        ];

        for (const entry of routes) {
            await navigateStage(page, entry.route);
            await page.locator(entry.selector).waitFor({ state: 'attached', timeout: 30_000 });
        }

        await navigateStage(page, '/dashboard/settings');
        await expect(page.locator('input[name="ServerName"]')).toBeVisible();
        await expect(page.locator('input[name="UICulture"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        await navigateStage(page, '/dashboard/logs');
        await expect(page.locator('input[name="SlowResponseTime"]')).toBeVisible();
        await expect(page.locator('input[name="EnableWarningMessage"]')).toBeVisible();

        await navigateStage(page, '/dashboard/plugins');
        await navigateStage(page, '/dashboard/plugins/repositories');
        await expect(page.locator('#repositories')).toBeVisible();
        await expect(page.getByRole('button', { name: /HeaderNewRepository|New Repository|Novo Repositório/i })).toBeVisible();

        await navigateStage(page, '/dashboard/branding');
        await expect(page.locator('textarea[name="LoginDisclaimer"]')).toBeVisible();
        await expect(page.locator('textarea[name="CustomCss"]')).toBeVisible();
    });

    test('creates a disposable user from the add-user form and reaches the profile page', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        await loginWithManualForm(page, admin.username, admin.password);

        const username = `pw-admin-${crypto.randomUUID().slice(0, 8)}`;
        const password = `Adm@${Date.now()}`;

        await navigateStage(page, '/dashboard/users/add');
        await expect(page.locator('#newUserPage')).toBeVisible();
        await expect(page.locator('#txtUsername')).toBeVisible();
        await expect(page.locator('#txtPassword')).toBeVisible();
        await expect(page.locator('.chkEnableAllFolders')).toBeVisible();

        await page.locator('#txtUsername').fill(username);
        await page.locator('#txtPassword').fill(password);
        await page.locator('.chkEnableAllFolders').check({ force: true });
        if (await page.locator('.chkEnableAllChannels').isVisible().catch(() => false)) {
            await page.locator('.chkEnableAllChannels').check({ force: true });
        }
        await page.locator('.newUserProfileForm button[type="submit"]').click();

        await page.waitForURL(/\/dashboard\/users\/[^/]+\/profile$/i, { timeout: 30_000 });
        const createdUserMatch = page.url().match(/\/dashboard\/users\/([^/]+)\/profile$/i);
        expect(createdUserMatch).not.toBeNull();

        const createdUserId = createdUserMatch?.[1];
        expect(createdUserId).toBeTruthy();

        await expect(page.locator('#usersEditPage')).toBeVisible();
        await expect(page.locator('h1').first()).toContainText(username);
        await expect(page.getByRole('tab', { name: /Perfil|Profile/ })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Acesso|Access/ })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Controle Parental|Parental Control/ })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Senha|Password/ })).toBeVisible();

        if (createdUserId) {
            await deleteUserById(page, createdUserId);
        }

        await navigateStage(page, '/dashboard/users');
        await expect(page.getByText(username, { exact: true })).toHaveCount(0);
    });

    test('saves the general, streaming and branding settings shells without changing the stage state', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        await loginWithManualForm(page, admin.username, admin.password);

        await navigateStage(page, '/dashboard/settings');
        await expect(page.locator('#dashboardGeneralPage')).toBeVisible();
        await expect(page.locator('input[name="ServerName"]')).toBeVisible();
        await expect(page.locator('input[name="CachePath"]')).toBeVisible();
        await expect(page.locator('input[name="MetadataPath"]')).toBeVisible();
        await page.locator('#dashboardGeneralPage button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').last()).toContainText(/Settings saved\.?|SettingsSaved|Saved|Salvo/i);

        await navigateStage(page, '/dashboard/playback/streaming');
        await expect(page.locator('#streamingSettingsPage')).toBeVisible();
        await expect(page.locator('input[name="StreamingBitrateLimit"]')).toBeVisible();
        await page.locator('#streamingSettingsPage button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').last()).toContainText(/Settings saved\.?|SettingsSaved|Saved|Salvo/i);

        await navigateStage(page, '/dashboard/branding');
        await expect(page.locator('#brandingPage')).toBeVisible();
        await expect(page.locator('textarea[name="LoginDisclaimer"]')).toBeVisible();
        await expect(page.locator('textarea[name="CustomCss"]')).toBeVisible();
        await page.locator('#brandingPage button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').last()).toContainText(/Settings saved\.?|SettingsSaved|Saved|Salvo/i);
    });
});
