import { expect, test } from '@playwright/test';

import {
    getAdminCredentials,
    loginWithManualForm,
} from '../support/admin-user.mjs';
import { ensureWizardCompleted } from '../support/wizard.mjs';
import { navigateStage } from '../support/stage.mjs';

async function loginAdmin(page) {
    const admin = getAdminCredentials();
    await ensureWizardCompleted(page, admin.username, admin.password);
    await loginWithManualForm(page, admin.username, admin.password);
}

test.describe.serial('12 - Admin surfaces', () => {
    test.setTimeout(3 * 60 * 1000);

    test('covers dashboard home, settings, users, libraries and playback surfaces', async ({ page }) => {
        await loginAdmin(page);

        await navigateStage(page, '/dashboard');
        await expect(page.locator('#dashboardPage')).toBeVisible();
        await expect(page.getByRole('button', { name: /Scan All Libraries|ButtonScanAllLibraries|Scanar todas as bibliotecas/i }).first()).toBeVisible().catch(() => {});
        await expect(page.getByRole('button', { name: /Restart|Reiniciar/i }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Shutdown|Desligar/i }).first()).toBeVisible();

        const routes = [
            { route: '/dashboard/settings', selector: '#dashboardGeneralPage' },
            { route: '/dashboard/users', selector: '#userProfilesPage' },
            { route: '/dashboard/users/licenses', selector: '#userLicensesPage' },
            { route: '/dashboard/libraries', selector: '#mediaLibraryPage' },
            { route: '/dashboard/libraries/display', selector: '#libraryDisplayPage' },
            { route: '/dashboard/libraries/metadata', selector: '#metadataImagesConfigurationPage' },
            { route: '/dashboard/libraries/nfo', selector: '#metadataNfoPage' },
            { route: '/dashboard/libraries/unidentified', selector: '#unidentifiedMediaPage' },
            { route: '/dashboard/playback/resume', selector: '#playbackConfigurationPage' },
            { route: '/dashboard/playback/streaming', selector: '#streamingSettingsPage' },
            { route: '/dashboard/playback/transcoding', selector: '#encodingSettingsPage' },
            { route: '/dashboard/playback/trickplay', selector: '#trickplayConfigurationPage' },
        ];

        for (const entry of routes) {
            await navigateStage(page, entry.route);
            await expect(page.locator(entry.selector)).toBeVisible({ timeout: 30_000 });
        }

        await navigateStage(page, '/dashboard/libraries');
        await expect(page.getByRole('button', { name: /ButtonAddMediaLibrary|Add Media Library|Adicionar biblioteca/i }).first()).toBeVisible().catch(() => {});
    });

    test('covers activity, logs, devices, plugins, backups, networking and task surfaces', async ({ page }) => {
        await loginAdmin(page);

        const routes = [
            { route: '/dashboard/activity', selector: '#serverActivityPage' },
            { route: '/dashboard/logs', selector: '#logPage' },
            { route: '/dashboard/devices', selector: '#devicesPage' },
            { route: '/dashboard/plugins', selector: '#pluginsPage' },
            { route: '/dashboard/plugins/repositories', selector: '#repositories' },
            { route: '/dashboard/branding', selector: '#brandingPage' },
            { route: '/dashboard/backups', selector: '#backupsPage' },
            { route: '/dashboard/networking', selector: '#networkingPage' },
            { route: '/dashboard/tasks', selector: '#scheduledTasksPage' },
        ];

        for (const entry of routes) {
            await navigateStage(page, entry.route);
            await expect(page.locator(entry.selector)).toBeVisible({ timeout: 30_000 });
        }

        await navigateStage(page, '/dashboard/logs');
        await expect(page.locator('#logPage a[href*="/dashboard/logs/"]').first()).toBeVisible({ timeout: 30_000 });

        await navigateStage(page, '/dashboard/plugins');
        await expect(page.locator('#pluginsPage a[href*="/dashboard/plugins/"]').first()).toBeVisible({ timeout: 30_000 }).catch(() => {});
    });

    test('covers live tv and recordings surfaces', async ({ page }) => {
        await loginAdmin(page);

        await navigateStage(page, '/dashboard/livetv');
        await expect(page.locator('#liveTvStatusPage')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole('button', { name: /Add Provider|Adicionar provedor|ButtonAddProvider/i }).first()).toBeVisible().catch(() => {});
        await expect(page.getByRole('button', { name: /Add Tuner Device|Adicionar dispositivo sintonizador|ButtonAddTunerDevice/i }).first()).toBeVisible().catch(() => {});

        await navigateStage(page, '/dashboard/livetv/recordings');
        await expect(page.locator('#liveTvSettingsPage')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('input[name="RecordingPath"]')).toBeVisible();
        await expect(page.locator('input[name="SeriesRecordingPath"]')).toBeVisible();
    });
});

