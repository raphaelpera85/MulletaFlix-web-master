import { expect, test } from '@playwright/test';
import { TEST_USERS } from './support/constants';
import { openLogin } from './support/utils';

test.describe.serial('20 - Common user', () => {
    test('logs in as a common user and sees the user landing area', async ({ page }) => {
        await openLogin(page);
        await page.locator('.btnManual').click();
        await page.locator('#txtManualName').fill(TEST_USERS.common.name);
        await page.locator('#txtManualPassword').fill(TEST_USERS.common.password);
        await page.locator('.manualLoginForm button[type="submit"]').click();

        await expect(page.locator('body')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#loginPage')).toHaveCount(0);
    });

    test('can open the main home shell after login', async ({ page }) => {
        await page.goto('/#/home');
        await expect(page.locator('body')).toBeVisible({ timeout: 30_000 });
    });
});

