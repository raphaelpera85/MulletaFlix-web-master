import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';

import {
    clearSharedUser,
    deleteUserById,
    getAdminCredentials,
    loginWithManualForm,
    logoutViaDashboard,
} from '../support/admin-user.mjs';
import { ensureWizardCompleted } from '../support/wizard.mjs';
import { navigateStage } from '../support/stage.mjs';
import {
    ensureMediaLibrariesReady,
    getFirstInstalledPlugin,
    getFirstScheduledTask,
    getVirtualFolderByLibrary,
    MOVIES_LIBRARY,
    SERIES_LIBRARY,
} from '../support/media-library.mjs';

async function assertHomeShowsLibrariesAndCarousels(page, libraries) {
    await navigateStage(page, '/home');
    await expect(page.locator('#indexPage')).toBeVisible({ timeout: 30_000 });

    for (const library of libraries) {
        const libraryButton = page.locator(`#indexPage a[href*="collectionType=${library.type}"]`).first();
        if (await libraryButton.isVisible({ timeout: 8_000 }).catch(() => false)) {
            continue;
        }

        const folder = await getVirtualFolderByLibrary(page, library);
        expect(folder?.ItemId || folder?.Id).toBeTruthy();
    }

    for (const library of libraries) {
        const libraryButton = page.locator(`#indexPage a[href*="collectionType=${library.type}"]`).first();
        if (!(await libraryButton.isVisible().catch(() => false))) {
            const folder = await getVirtualFolderByLibrary(page, library);
            const folderId = folder?.ItemId || folder?.Id;
            expect(folderId).toBeTruthy();
            await navigateStage(page, `/${library.route || (library.type === 'tvshows' ? 'tv' : library.type)}?topParentId=${folderId}&collectionType=${library.type}`);
            await expect(page.locator(library.type === 'tvshows' ? '#tvshowsPage' : '#moviesPage')).toBeVisible({ timeout: 30_000 });
            await expect(page.locator(`${library.type === 'tvshows' ? '#tvshowsPage' : '#moviesPage'} .card`).first()).toBeVisible({ timeout: 60_000 });
            await navigateStage(page, '/home');
            continue;
        }

        const section = page.locator('.homePage .verticalSection').filter({
            hasText: library.aliases?.length ? new RegExp(library.aliases.map(alias => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i') : library.name
        }).first();
        await section.scrollIntoViewIfNeeded();
        await expect(section).toBeVisible({ timeout: 30_000 });

        const cards = section.locator('.card');
        await expect(cards.first()).toBeVisible({ timeout: 30_000 });
        expect(await cards.count()).toBeGreaterThan(0);
    }
}

async function assertLibraryPagination(page, library, pageSelector, knownFolder = null) {
    const folder = knownFolder || await getVirtualFolderByLibrary(page, library).catch(() => null);
    const folderId = folder?.ItemId || folder?.Id;
    if (folderId) {
        await navigateStage(page, `/${library.route || (library.type === 'tvshows' ? 'tv' : library.type)}?topParentId=${folderId}&collectionType=${library.type}`);
    } else {
        await navigateStage(page, '/home');
        const libraryButton = page.locator(`#indexPage a[href*="collectionType=${library.type}"]`).first();
        await expect(libraryButton).toBeVisible({ timeout: 30_000 });
        await libraryButton.click();
    }

    await expect(page.locator(pageSelector)).toBeVisible({ timeout: 30_000 });

    const firstCard = page.locator(`${pageSelector} .card`).first();
    await expect(firstCard).toBeVisible({ timeout: 60_000 });
    const firstCardId = await firstCard.getAttribute('data-id');

    const nextButtons = page.locator(`${pageSelector} .btnNextPage`);
    if (await nextButtons.count() === 0) {
        return;
    }

    const nextButton = nextButtons.first();
    if (await nextButton.isDisabled().catch(() => true)) {
        return;
    }

    await nextButton.click();

    await expect.poll(async () => {
        return page.locator(`${pageSelector} .card`).first().getAttribute('data-id');
    }, {
        timeout: 30_000
    }).not.toBe(firstCardId);

    const previousButton = page.locator(`${pageSelector} .btnPreviousPage`).first();
    if (await previousButton.isVisible().catch(() => false) && !(await previousButton.isDisabled().catch(() => true))) {
        await previousButton.click();
        await expect.poll(async () => {
            return page.locator(`${pageSelector} .card`).first().getAttribute('data-id');
        }, {
            timeout: 30_000
        }).toBe(firstCardId);
    }

    await navigateStage(page, '/home');
}

test.describe.serial('99 - Pagination and home media', () => {
    test.setTimeout(25 * 60 * 1000);

    test('admin sees the media libraries, home carousels and the paged library views after recognition', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        await loginWithManualForm(page, admin.username, admin.password);

        await ensureMediaLibrariesReady(page, {
            timeoutMs: 22 * 60 * 1000,
            pollIntervalMs: 45_000
        });

        await assertHomeShowsLibrariesAndCarousels(page, [ MOVIES_LIBRARY, SERIES_LIBRARY ]);

        await assertLibraryPagination(page, MOVIES_LIBRARY, '#moviesPage');
        await assertLibraryPagination(page, SERIES_LIBRARY, '#tvshowsPage');

        await navigateStage(page, '/movies');
        await expect(page.locator('#moviesPage')).toBeVisible({ timeout: 30_000 });
        const firstMovie = page.locator('#moviesPage .card').first();
        await expect(firstMovie).toBeVisible({ timeout: 30_000 });
        const firstMovieId = await firstMovie.getAttribute('data-id');
        expect(firstMovieId).toBeTruthy();

        if (firstMovieId) {
            await navigateStage(page, `/metadata?id=${firstMovieId}`);
            await expect(page.locator('#editItemMetadataPage')).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('#editItemMetadataPage .libraryTree')).toBeVisible();
            await expect(page.locator('#editItemMetadataPage .editPageInnerContent')).toBeVisible();
        }

        const plugin = await getFirstInstalledPlugin(page);
        if (plugin?.id) {
            await navigateStage(page, `/dashboard/plugins/${plugin.id}?name=${encodeURIComponent(plugin.name)}`);
            await expect(page.locator('#addPluginPage')).toBeVisible({ timeout: 30_000 });

            const settingsButton = page.getByRole('button', { name: /Settings|Configurações|Configurações/i });
            if (await settingsButton.isVisible().catch(() => false)) {
                await settingsButton.click();
                await expect(page.url()).toContain('/configurationpage?name=');
            }
        }

        const task = await getFirstScheduledTask(page);
        if (task?.id) {
            await navigateStage(page, `/dashboard/tasks/${task.id}`);
            await expect(page.locator('#scheduledTaskPage')).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('#scheduledTaskPage h2').first()).toContainText(task.name);
        }

        await navigateStage(page, '/dashboard/logs');
        const logLink = page.locator('#logPage a[href*="/dashboard/logs/"]').first();
        if (await logLink.isVisible().catch(() => false)) {
            const logFileName = await logLink.textContent();
            await logLink.click();
            await expect(page.locator('#logPage pre')).toBeVisible({ timeout: 30_000 });
            if (logFileName) {
                await expect(page.locator('#logPage h1')).toContainText(logFileName);
            }
        }

        await logoutViaDashboard(page);
    });

    test('common user can browse home and page through movies and series too', async ({ page }) => {
        const admin = getAdminCredentials();
        await ensureWizardCompleted(page, admin.username, admin.password);
        await loginWithManualForm(page, admin.username, admin.password);

        await ensureMediaLibrariesReady(page, {
            timeoutMs: 22 * 60 * 1000,
            pollIntervalMs: 45_000
        });

        const movieFolder = await getVirtualFolderByLibrary(page, MOVIES_LIBRARY);
        const seriesFolder = await getVirtualFolderByLibrary(page, SERIES_LIBRARY);

        const username = `mflx-paging-${crypto.randomUUID().slice(0, 8)}@example.com`;
        const password = `User@${crypto.randomUUID().slice(0, 8)}2026`;

        const sharedUser = await page.evaluate(async ({ currentUsername, currentPassword }) => {
            const created = await window.ApiClient.createUser({
                Name: currentUsername,
                Password: currentPassword
            });

            const user = await window.ApiClient.getUser(created.Id);
            await window.ApiClient.updateUserPolicy(created.Id, {
                ...user.Policy,
                EnableAllFolders: true,
                EnableAllChannels: true,
                EnableMediaPlayback: true,
                EnableLiveTvAccess: true,
                IsAdministrator: false
            });

            return {
                username: created.Name || currentUsername,
                password: currentPassword,
                userId: created.Id
            };
        }, {
            currentUsername: username,
            currentPassword: password
        });

        await logoutViaDashboard(page);

        await loginWithManualForm(page, sharedUser.username, sharedUser.password);
        await assertHomeShowsLibrariesAndCarousels(page, [ MOVIES_LIBRARY, SERIES_LIBRARY ]);
        await assertLibraryPagination(page, MOVIES_LIBRARY, '#moviesPage', movieFolder);
        await assertLibraryPagination(page, SERIES_LIBRARY, '#tvshowsPage', seriesFolder);

        await logoutViaDashboard(page);
        await loginWithManualForm(page, admin.username, admin.password);
        await deleteUserById(page, sharedUser.userId);
        await clearSharedUser();
        await logoutViaDashboard(page);
    });
});
