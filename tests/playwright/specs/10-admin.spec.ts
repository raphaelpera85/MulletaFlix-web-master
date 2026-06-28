import { expect, test } from '@playwright/test';
import {
    getAdminCredentials,
    loadOrCreateSharedUser,
    loginWithManualForm,
    openUserTab,
} from '../support/admin-user.mjs';
import { navigateStage, STAGE_ROUTES } from '../support/stage.mjs';

test.describe.serial('10 - Admin', () => {
    test('creates a common user and walks through profile, access, parental control and password tabs', async ({ page }) => {
        const admin = getAdminCredentials();
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
        await page.locator('#userProfilesPage').waitFor({ state: 'visible', timeout: 30_000 });

        await openUserTab(page, user.userId, 'access');
        await expect(page.locator('.userLibraryAccessForm')).toBeVisible();
        await expect(page.locator('.folderAccessContainer')).toBeAttached();
        await expect(page.locator('.channelAccessContainer')).toBeAttached();
        await expect(page.locator('.deviceAccessContainer')).toBeAttached();
        await page.locator('.userLibraryAccessForm button[type="submit"]').click();
        await page.locator('#userProfilesPage').waitFor({ state: 'visible', timeout: 30_000 });

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
            { route: '/dashboard/branding', selector: '#brandingPage' },
        ];

        for (const entry of routes) {
            await navigateStage(page, entry.route);
            await page.locator(entry.selector).waitFor({ state: 'visible', timeout: 30_000 });
        }

        await navigateStage(page, '/dashboard/settings');
        await expect(page.locator('input[name="ServerName"]')).toBeVisible();
        await expect(page.locator('input[name="UICulture"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        await navigateStage(page, '/dashboard/logs');
        await expect(page.locator('input[name="SlowResponseTime"]')).toBeVisible();
        await expect(page.locator('input[name="EnableWarningMessage"]')).toBeVisible();

        await navigateStage(page, '/dashboard/plugins');
        await expect(page.locator('a[href="/dashboard/plugins/repositories"]')).toBeVisible();

        await navigateStage(page, '/dashboard/branding');
        await expect(page.locator('textarea[name="LoginDisclaimer"]')).toBeVisible();
        await expect(page.locator('textarea[name="CustomCss"]')).toBeVisible();
    });
});
