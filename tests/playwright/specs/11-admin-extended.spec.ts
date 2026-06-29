import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';

import { getAdminCredentials, loginWithManualForm } from '../support/admin-user.mjs';
import { ensureWizardCompleted } from '../support/wizard.mjs';
import { navigateStage } from '../support/stage.mjs';

test.describe.serial('11 - Admin extended', () => {
    test('covers live tv status and recordings settings', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        await loginWithManualForm(page, admin.username, admin.password);

        await navigateStage(page, '/dashboard/livetv');
        await expect(page.locator('#liveTvStatusPage')).toBeVisible();
        await expect(page.getByRole('link', { name: /Add Tuner Device|Adicionar dispositivo sintonizador|ButtonAddTunerDevice/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Add Provider|Adicionar provedor|ButtonAddProvider/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Refresh Guide Data|Atualizar Dados do Guia|ButtonRefreshGuideData/i })).toBeVisible();

        await page.getByRole('button', { name: /Add Provider|Adicionar provedor|ButtonAddProvider/i }).click();
        await expect(page.getByRole('menuitem', { name: /Schedules Direct/i })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: /XMLTV/i })).toBeVisible();

        await navigateStage(page, '/dashboard/livetv/recordings');
        await expect(page.locator('#liveTvSettingsPage')).toBeVisible();
        await expect(page.locator('input[name="RecordingPath"]')).toBeVisible();
        await expect(page.locator('input[name="MovieRecordingPath"]')).toBeVisible();
        await expect(page.locator('input[name="SeriesRecordingPath"]')).toBeVisible();
        await expect(page.locator('input[name="PrePaddingMinutes"]')).toBeVisible();
        await expect(page.locator('input[name="PostPaddingMinutes"]')).toBeVisible();
        await expect(page.locator('input[name="RecordingPostProcessor"]')).toBeVisible();
    });

    test('covers api keys, jobs and backups surfaces', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        await loginWithManualForm(page, admin.username, admin.password);

        await navigateStage(page, '/dashboard/keys');
        await expect(page.locator('#apiKeysPage')).toBeVisible();
        await expect(page.getByRole('button', { name: /New API Key|Nova Chave de API|HeaderNewApiKey/i })).toBeVisible();
        await page.locator('#apiKeysPage button').filter({ hasText: /New API Key|Nova Chave de API|HeaderNewApiKey/i }).evaluate((button) => {
            button.click();
        });
        const apiKeyDialog = page.getByRole('dialog');
        await expect(apiKeyDialog).toBeVisible();
        await expect(apiKeyDialog.getByRole('textbox')).toBeVisible();
        await apiKeyDialog.getByRole('textbox').fill(`pw-key-${crypto.randomUUID().slice(0, 8)}`);
        await page.keyboard.press('Escape');
        await expect(apiKeyDialog).toBeHidden();

        await navigateStage(page, '/dashboard/jobs');
        await expect(page.locator('#jobQueuePage')).toBeVisible();
        await expect(page.getByRole('button', { name: /Pré-aquecer imagens|Pre-warm images|Prewarm/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Atualizar|Refresh/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Parar todos|Stop all|Stop/i })).toBeVisible();

        await navigateStage(page, '/dashboard/backups');
        await expect(page.locator('#backupsPage')).toBeVisible();
        await page.getByRole('button', { name: /Create Backup|Criar Backup|ButtonCreateBackup/i }).click();
        const backupDialog = page.getByRole('dialog');
        await expect(backupDialog).toBeVisible();
        await expect(backupDialog.getByLabel(/Database|LabelDatabase/i)).toBeVisible();
        await expect(backupDialog.getByLabel(/Metadata|LabelMetadata/i)).toBeVisible();
        await expect(backupDialog.getByLabel(/Subtitles/i)).toBeVisible();
        await expect(backupDialog.getByLabel(/Trickplay/i)).toBeVisible();
        await backupDialog.getByRole('button', { name: /Cancel|ButtonCancel|Cancelar/i }).click();
        await expect(backupDialog).toBeHidden();
    });

    test('saves the networking and library metadata shells', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        await loginWithManualForm(page, admin.username, admin.password);

        await navigateStage(page, '/dashboard/networking');
        await expect(page.locator('#networkingPage')).toBeVisible();
        await expect(page.locator('input[name="InternalHttpPort"]')).toBeVisible();
        await expect(page.locator('input[name="BaseUrl"]')).toBeVisible();
        await expect(page.locator('input[name="KnownProxies"]')).toBeVisible();
        await page.locator('#networkingPage button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').last()).toContainText(/Settings saved\.?|SettingsSaved|Saved|Salvo/i);

        await navigateStage(page, '/dashboard/libraries/display');
        await expect(page.locator('#libraryDisplayPage')).toBeVisible();
        await expect(page.locator('select[name="DateAddedBehavior"], [name="DateAddedBehavior"]')).toBeVisible();
        await page.locator('#libraryDisplayPage button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').last()).toContainText(/Settings saved\.?|SettingsSaved|Saved|Salvo/i);

        await navigateStage(page, '/dashboard/libraries/metadata');
        await expect(page.locator('#metadataImagesConfigurationPage')).toBeVisible();
        await expect(page.locator('select[name="Language"], [name="Language"]')).toBeVisible();
        await expect(page.locator('select[name="Country"], [name="Country"]')).toBeVisible();
        await page.locator('#metadataImagesConfigurationPage button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').last()).toContainText(/Settings saved\.?|SettingsSaved|Saved|Salvo/i);

        await navigateStage(page, '/dashboard/libraries/nfo');
        await expect(page.locator('#metadataNfoPage')).toBeVisible();
        await expect(page.locator('select[name="UserId"], [name="UserId"]')).toBeVisible();
        await page.locator('#metadataNfoPage button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').last()).toContainText(/Settings saved\.?|SettingsSaved|Saved|Salvo/i);

        await navigateStage(page, '/dashboard/libraries/unidentified');
        await expect(page.locator('#unidentifiedMediaPage')).toBeVisible();
        await expect(page.getByRole('tab', { name: /Movies|Filmes/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Series|Séries/i })).toBeVisible();
        await page.getByRole('button', { name: /Refresh|Atualizar/i }).click();
    });
});
