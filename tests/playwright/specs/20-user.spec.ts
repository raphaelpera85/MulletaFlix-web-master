import { expect, test } from '@playwright/test';
import {
    clearSharedUser,
    createCommonUser,
    deleteUserById,
    getAdminCredentials,
    loginWithManualForm,
    logoutViaDashboard,
    logoutViaDrawer,
    readSharedUser,
} from '../support/admin-user.mjs';
import { expectUserStage, navigateStage } from '../support/stage.mjs';

test.describe.serial('20 - Common user', () => {
    test('logs in as the created user and proves the session on home', async ({ page }) => {
        const admin = getAdminCredentials();
        let sharedUser = await readSharedUser();

        if (!sharedUser) {
            await loginWithManualForm(page, admin.username, admin.password);
            sharedUser = await createCommonUser(page);
            await logoutViaDashboard(page);
        }

        await loginWithManualForm(page, sharedUser.username, sharedUser.password);
        await navigateStage(page, '/home');
        await expectUserStage(page);

        await expect(page.locator('.headerUserButton')).toBeVisible();
        await expect(page.locator('.headerUserButton')).toHaveAttribute('title', sharedUser.username);

        await page.locator('.mainDrawerButton').click();
        await expect(page.locator('.btnLogout')).toBeVisible();
        await expect(page.locator('.lnkManageServer')).toHaveCount(0);

        await page.locator('.btnLogout').click();
        await page.locator('#loginPage').waitFor({ state: 'visible', timeout: 30_000 });

        await loginWithManualForm(page, admin.username, admin.password);
        await deleteUserById(page, sharedUser.userId);
        await clearSharedUser();
        await logoutViaDashboard(page);
    });
});
