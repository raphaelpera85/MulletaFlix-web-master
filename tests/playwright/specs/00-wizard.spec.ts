import { expect, test } from '@playwright/test';
import { assertCleanWizardStage, fetchStagePublicInfo, openStage, seedStageConnection, STAGE_ROUTES } from '../support/stage.mjs';
import { completeWizard } from '../support/wizard.mjs';

const ADMIN_USER = process.env.MFLX_ADMIN_USER || 'Raphael';
const ADMIN_PASSWORD = process.env.MFLX_ADMIN_PASSWORD || 'Bug309c*';

test.describe.serial('00 - Wizard', () => {
    test('stage starts clean and wizard pages are reachable', async ({ page }) => {
        await seedStageConnection(page);
        await openStage(page, STAGE_ROUTES.wizardStart);
        await assertCleanWizardStage(page);
        const info = await fetchStagePublicInfo();
        expect(info.StartupWizardCompleted).toBe(false);

        await expect(page.locator('.wizardStartForm')).toBeVisible();
        await expect(page.locator('#txtServerName')).toBeVisible();
        await expect(page.locator('#selectLocalizationLanguage')).toBeVisible();
        await expect(page.locator('.button-submit')).toBeVisible();
    });

    test('completes the wizard end-to-end', async ({ page }) => {
        await completeWizard(page, {
            adminUser: ADMIN_USER,
            adminPassword: ADMIN_PASSWORD,
            serverName: 'Mulletaflix'
        });
    });
});
