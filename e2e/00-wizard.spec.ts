import { expect, test } from '@playwright/test';
import { apiJson, fillVisibleSelect, openRoot } from './support/utils';
import { TEST_USERS } from './support/constants';

test.describe.serial('00 - Wizard', () => {
    test('stage starts clean and wizard pages are reachable', async ({ page, request }) => {
        const publicInfo = await apiJson(request, '/System/Info/Public');
        expect(publicInfo.StartupWizardCompleted).toBe(false);

        await openRoot(page);
        await expect(page.locator('#wizardStartPage')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.wizardStartForm')).toBeVisible();
        await expect(page.locator('#txtServerName')).toBeVisible();
        await expect(page.locator('#selectLocalizationLanguage')).toBeVisible();
        await expect(page.locator('.button-submit')).toBeVisible();
    });

    test('completes the wizard end-to-end', async ({ page }) => {
        await openRoot(page);
        await expect(page.locator('#wizardStartPage')).toBeVisible({ timeout: 30_000 });

        await page.locator('#txtServerName').fill('Mulletaflix');
        await fillVisibleSelect(page.locator('#selectLocalizationLanguage'), [ 'pt', 'pt-BR', 'en' ]);
        await page.locator('.wizardStartForm .button-submit').click();

        await expect(page.locator('.wizardUserForm')).toBeVisible({ timeout: 30_000 });
        await page.locator('#txtUsername').fill(TEST_USERS.admin.name);
        await page.locator('#txtManualPassword').fill(TEST_USERS.admin.password);
        await page.locator('#txtPasswordConfirm').fill(TEST_USERS.admin.password);
        await page.locator('.wizardUserForm .button-submit').click();

        await expect(page.locator('#wizardLibraryPage')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#addLibrary')).toBeVisible();
        await page.locator('#addLibrary').click();
        await expect(page.locator('.dlg-librarycreator')).toBeVisible({ timeout: 30_000 });
        await page.locator('.dlg-librarycreator .btnCancel').click();
        await page.locator('#wizardLibraryPage .button-submit').click();

        await expect(page.locator('.wizardSettingsForm')).toBeVisible({ timeout: 30_000 });
        await fillVisibleSelect(page.locator('#selectCountry'), [ 'BR', 'United States', 'Brazil' ]);
        await fillVisibleSelect(page.locator('#selectLanguage'), [ 'pt', 'pt-BR', 'en' ]);
        await page.locator('.wizardSettingsForm .button-submit').click();

        await expect(page.locator('#chkRemoteAccess')).toBeVisible({ timeout: 30_000 });
        await setRemoteAccess(page);
        await page.locator('.wizardSettingsForm .button-submit').click();

        await expect(page.locator('.btnWizardNext')).toBeVisible({ timeout: 30_000 });
        await page.locator('.btnWizardNext').click();

        await expect(page.locator('#loginPage')).toBeVisible({ timeout: 30_000 });
    });
});

async function setRemoteAccess(page) {
    const checkbox = page.locator('#chkRemoteAccess');
    if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.check();
    }
}
