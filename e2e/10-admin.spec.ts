import { expect, test } from '@playwright/test';
import { TEST_USERS } from './support/constants';
import { openLogin } from './support/utils';

test.describe.serial('10 - Admin', () => {
    test('logs in and reaches the users dashboard', async ({ page }) => {
        await openLogin(page);
        await page.locator('.btnManual').click();
        await page.locator('#txtManualName').fill(TEST_USERS.admin.name);
        await page.locator('#txtManualPassword').fill(TEST_USERS.admin.password);
        await page.locator('.manualLoginForm button[type="submit"]').click();

        await expect(page.locator('#loginPage')).toHaveCount(0);
        await page.goto('/#/dashboard/users');
        await expect(page.locator('#userProfilesPage')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#btnAddUser')).toBeVisible();
    });

    test('creates a common user and walks through profile, access, parental and password tabs', async ({ page }) => {
        const userName = process.env.MFLX_COMMON_USER || 'mflx-user';
        const userPassword = process.env.MFLX_COMMON_PASSWORD || 'User@12345';

        await page.goto('/#/dashboard/users/add');
        await expect(page.locator('#newUserPage')).toBeVisible({ timeout: 30_000 });
        await page.locator('#txtUsername').fill(userName);
        await page.locator('#txtPassword').fill(userPassword);
        await page.locator('.newUserProfileForm .button-submit').click();

        await expect(page.locator('#usersEditPage')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole('tab', { name: /Profile/i })).toBeVisible();
        await page.getByRole('tab', { name: /Access/i }).click();
        await expect(page.locator('.userLibraryAccessForm')).toBeVisible({ timeout: 30_000 });
        await page.getByRole('tab', { name: /Parental Control/i }).click();
        await expect(page.locator('#usersEditPage')).toBeVisible();
        await page.getByRole('tab', { name: /Password/i }).click();
        await expect(page.locator('.updatePasswordForm')).toBeVisible({ timeout: 30_000 });

        await page.getByRole('tab', { name: /Profile/i }).click();
        await expect(page.locator('.editUserProfileForm')).toBeVisible();
        await page.locator('.chkIsAdmin').uncheck().catch(() => {});
        await page.locator('.chkIsHidden').uncheck().catch(() => {});
        await page.locator('.editUserProfileForm .button-submit').click();

        await expect(page.locator('#userProfilesPage')).toBeVisible({ timeout: 30_000 });
    });
});
