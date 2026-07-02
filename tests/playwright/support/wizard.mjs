import { expect } from '@playwright/test';

import { fetchStagePublicInfo, openStage, seedStageConnection, STAGE_ROUTES } from './stage.mjs';

async function setInputValue(locator, value) {
    await locator.evaluate((element, nextValue) => {
        const input = element;
        input.value = nextValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
}

export async function completeWizard(page, { adminUser, adminPassword, serverName = 'Mulletaflix' } = {}) {
    await seedStageConnection(page);
    await openStage(page, STAGE_ROUTES.wizardStart);
    const wizardStartPage = page.locator('#wizardStartPage');
    const wizardUserPage = page.locator('#wizardUserPage');
    const wizardLibraryPage = page.locator('#wizardLibraryPage');
    const wizardSettingsPage = page.locator('#wizardSettingsPage');
    const wizardFinishPage = page.locator('#wizardFinishPage');

    await expect(wizardStartPage).toBeVisible({ timeout: 30_000 });

    await page.locator('#txtServerName').fill(serverName);
    const languageSelect = page.locator('#selectLocalizationLanguage');
    const languageOptions = await languageSelect.locator('option').evaluateAll(nodes => nodes
        .map(node => ({
            value: node.value,
            text: node.textContent?.trim() || ''
        }))
        .filter(option => option.value !== '')
    );
    if (languageOptions.length > 0) {
        await languageSelect.selectOption(languageOptions[0].value);
    }

    await wizardStartPage.locator('.wizardStartForm .button-submit').click();
    await page.waitForURL(/\/wizard\/user$/i, { timeout: 30_000 });
    await expect(wizardUserPage).toBeVisible({ timeout: 30_000 });
    await expect(wizardUserPage.locator('#txtUsername')).toHaveValue(adminUser, { timeout: 30_000 });

    await setInputValue(wizardUserPage.locator('#txtManualPassword'), adminPassword);
    await setInputValue(wizardUserPage.locator('#txtPasswordConfirm'), adminPassword);
    await wizardUserPage.locator('.wizardUserForm .button-submit').click();

    await expect(wizardLibraryPage).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/wizard\/library$/i, { timeout: 10_000 });
    await expect(wizardLibraryPage.locator('#addLibrary')).toBeVisible();
    await wizardLibraryPage.locator('#addLibrary').click();
    await expect(page.locator('.dlg-librarycreator')).toBeVisible({ timeout: 30_000 });
    await page.locator('.dlg-librarycreator .btnCancel').click();
    await wizardLibraryPage.locator('.button-submit').click();

    await expect(wizardSettingsPage).toBeVisible({ timeout: 30_000 });
    await expect(wizardSettingsPage.locator('#selectLanguage')).toBeVisible({ timeout: 30_000 });
    const countrySelect = wizardSettingsPage.locator('#selectCountry');
    const countryOptions = await countrySelect.locator('option').evaluateAll(nodes => nodes
        .map(node => ({
            value: node.value,
            text: node.textContent?.trim() || ''
        }))
        .filter(option => option.value !== '')
    );
    const preferredCountry = countryOptions.find(option => /Brazil|Brasil|United States/i.test(option.text)) || countryOptions[0];
    if (preferredCountry?.value) {
        await countrySelect.selectOption(preferredCountry.value);
    }

    const secondLanguageOptions = await wizardSettingsPage.locator('#selectLanguage').locator('option').evaluateAll(nodes => nodes
        .map(node => ({
            value: node.value,
            text: node.textContent?.trim() || ''
        }))
        .filter(option => option.value !== '')
    );
    const preferredLanguage = secondLanguageOptions.find(option => /pt|en/i.test(option.value) || /Portuguese|English/i.test(option.text)) || secondLanguageOptions[0];
    if (preferredLanguage?.value) {
        await wizardSettingsPage.locator('#selectLanguage').selectOption(preferredLanguage.value);
    }

    await wizardSettingsPage.getByRole('button', { name: /^Next$/ }).last().click();
    await page.waitForURL(/\/wizard\/remoteaccess$/i, { timeout: 30_000 });
    await expect(page.locator('#chkRemoteAccess')).toBeVisible({ timeout: 30_000 });

    const remoteAccess = page.locator('#chkRemoteAccess');
    if (await remoteAccess.isVisible()) {
        await remoteAccess.check();
    }
    await page.getByRole('button', { name: /^Next$/ }).last().click();

    await page.waitForURL(/\/wizard\/finish$/i, { timeout: 30_000 });
    await expect(wizardFinishPage).toBeVisible({ timeout: 30_000 });
    await expect(wizardFinishPage.locator('.btnWizardNext')).toBeVisible({ timeout: 30_000 });
    await wizardFinishPage.locator('.btnWizardNext').click();
    await page.waitForURL(/\/login/i, { timeout: 30_000 });
    await expect(page.locator('#loginPage')).toBeVisible({ timeout: 30_000 });
}

export async function ensureWizardCompleted(page, adminUser, adminPassword) {
    const info = await fetchStagePublicInfo();
    if (info.StartupWizardCompleted) {
        return false;
    }

    await completeWizard(page, { adminUser, adminPassword });
    return true;
}
