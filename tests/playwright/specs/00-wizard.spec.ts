import { expect, test } from '@playwright/test';
import { assertCleanWizardStage, fetchStagePublicInfo, openStage, STAGE_ROUTES } from '../support/stage.mjs';

const ADMIN_USER = process.env.MFLX_ADMIN_USER || 'Raphael';
const ADMIN_PASSWORD = process.env.MFLX_ADMIN_PASSWORD || 'Bug309c*';

test.describe.serial('00 - Wizard', () => {
    test('stage starts clean and wizard pages are reachable', async ({ page }) => {
        await assertCleanWizardStage(page);
        const info = await fetchStagePublicInfo();
        expect(info.StartupWizardCompleted).toBe(false);

        await expect(page.locator('.wizardStartForm')).toBeVisible();
        await expect(page.locator('#txtServerName')).toBeVisible();
        await expect(page.locator('#selectLocalizationLanguage')).toBeVisible();
        await expect(page.locator('.button-submit')).toBeVisible();
    });

    test('completes the wizard end-to-end', async ({ page }) => {
        await openStage(page, STAGE_ROUTES.wizardStart);
        await expect(page.locator('#wizardStartPage')).toBeVisible({ timeout: 30_000 });

        await page.locator('#txtServerName').fill('Mulletaflix');
        const languageSelect = page.locator('#selectLocalizationLanguage');
        const languageOptions = await languageSelect.locator('option').evaluateAll(nodes => nodes
            .map(node => ({
                value: (node as HTMLOptionElement).value,
                text: (node as HTMLOptionElement).textContent?.trim() || ''
            }))
            .filter(option => option.value !== '')
        );
        if (languageOptions.length > 0) {
            await languageSelect.selectOption(languageOptions[0].value);
        }

        await page.locator('.wizardStartForm .button-submit').click();
        await expect(page.locator('.wizardUserForm')).toBeVisible({ timeout: 30_000 });

        await page.locator('#txtUsername').fill(ADMIN_USER);
        await page.locator('#txtManualPassword').fill(ADMIN_PASSWORD);
        await page.locator('#txtPasswordConfirm').fill(ADMIN_PASSWORD);
        await page.locator('.wizardUserForm .button-submit').click();

        await expect(page.locator('#wizardLibraryPage')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#addLibrary')).toBeVisible();
        await page.locator('#addLibrary').click();
        await expect(page.locator('.dlg-librarycreator')).toBeVisible({ timeout: 30_000 });
        await page.locator('.dlg-librarycreator .btnCancel').click();
        await page.locator('#wizardLibraryPage .button-submit').click();

        await expect(page.locator('#selectLanguage')).toBeVisible({ timeout: 30_000 });
        const countrySelect = page.locator('#selectCountry');
        const countryOptions = await countrySelect.locator('option').evaluateAll(nodes => nodes
            .map(node => ({
                value: (node as HTMLOptionElement).value,
                text: (node as HTMLOptionElement).textContent?.trim() || ''
            }))
            .filter(option => option.value !== '')
        );
        const preferredCountry = countryOptions.find(option => /Brazil|Brasil|United States/i.test(option.text)) || countryOptions[0];
        if (preferredCountry?.value) {
            await countrySelect.selectOption(preferredCountry.value);
        }

        const secondLanguageOptions = await page.locator('#selectLanguage').locator('option').evaluateAll(nodes => nodes
            .map(node => ({
                value: (node as HTMLOptionElement).value,
                text: (node as HTMLOptionElement).textContent?.trim() || ''
            }))
            .filter(option => option.value !== '')
        );
        const preferredLanguage = secondLanguageOptions.find(option => /pt|en/i.test(option.value) || /Portuguese|English/i.test(option.text)) || secondLanguageOptions[0];
        if (preferredLanguage?.value) {
            await page.locator('#selectLanguage').selectOption(preferredLanguage.value);
        }

        await page.locator('.wizardSettingsForm .button-submit').click();
        await expect(page.locator('#chkRemoteAccess')).toBeVisible({ timeout: 30_000 });

        const remoteAccess = page.locator('#chkRemoteAccess');
        if (await remoteAccess.isVisible()) {
            await remoteAccess.check();
        }
        await page.locator('.wizardSettingsForm .button-submit').click();

        await expect(page.locator('.btnWizardNext')).toBeVisible({ timeout: 30_000 });
        await page.locator('.btnWizardNext').click();

        await expect(page.locator('#loginPage')).toBeVisible({ timeout: 30_000 });
    });
});
