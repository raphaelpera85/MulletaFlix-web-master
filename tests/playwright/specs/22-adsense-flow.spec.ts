import { expect, test } from '@playwright/test';

import {
    getAdminCredentials,
    loginWithManualForm,
    logoutViaDashboard,
} from '../support/admin-user.mjs';
import { ensureWizardCompleted } from '../support/wizard.mjs';
import { fetchStagePublicInfo, navigateStage } from '../support/stage.mjs';
import {
    ensureMediaLibrariesReady,
    getVirtualFolderByLibrary,
    MOVIES_LIBRARY,
} from '../support/media-library.mjs';

async function getTwoPlayableItems(page, folderId) {
    return page.evaluate(async (parentId) => {
        const result = await window.ApiClient.getItems(window.ApiClient.getCurrentUserId(), {
            ParentId: parentId,
            Limit: 10,
            Recursive: true,
            Fields: 'Path,MediaType,RunTimeTicks,Name'
        });

        return (result?.Items || [])
            .filter(item => item?.Id && item?.Path && item?.MediaType === 'Video')
            .map(item => ({
                id: item.Id,
                name: item.Name || item.Id,
                path: item.Path,
                runtimeTicks: Number(item.RunTimeTicks || 0)
            }))
            .sort((left, right) => left.runtimeTicks - right.runtimeTicks || left.name.localeCompare(right.name));
    }, folderId);
}

async function updateBranding(page, patch) {
    return page.evaluate(async (brandingPatch) => {
        const current = await window.ApiClient.getNamedConfiguration('branding');
        const next = {
            ...current,
            ...brandingPatch
        };

        await window.ApiClient.updateNamedConfiguration('branding', next);
        return next;
    }, patch);
}

async function getActivePlaybackSessions(page, itemId) {
    return page.evaluate(async (targetItemId) => {
        const sessions = await window.ApiClient.getSessions({ activeWithinSeconds: 120 });
        return sessions.filter((session) => String(session.NowPlayingItem?.Id || '').toLowerCase() === String(targetItemId).toLowerCase());
    }, itemId);
}

async function prepareAdSensePlayback(page, scriptMode) {
    try {
        await fetchStagePublicInfo();
    } catch {
        test.skip(true, 'Stage server is not available for AdSense playback validation.');
    }

    const admin = getAdminCredentials();
    await ensureWizardCompleted(page, admin.username, admin.password);
    await loginWithManualForm(page, admin.username, admin.password);

    await ensureMediaLibrariesReady(page, {
        timeoutMs: 22 * 60 * 1000,
        pollIntervalMs: 45_000
    });

    const moviesFolder = await getVirtualFolderByLibrary(page, MOVIES_LIBRARY);
    const folderId = moviesFolder?.ItemId || moviesFolder?.Id;
    expect(folderId, 'movie library folder not found').toBeTruthy();

    const playableItems = await getTwoPlayableItems(page, folderId);
    expect(playableItems.length, 'need at least two playable videos for intro + main flow').toBeGreaterThanOrEqual(2);

    const introItem = playableItems[0];
    const movieItem = playableItems[1];

    const originalBranding = await page.evaluate(async () => await window.ApiClient.getNamedConfiguration('branding'));

    await updateBranding(page, {
        IntroEnabled: true,
        IntroPath: introItem.path,
        AdSenseEnabled: true,
        AdSenseClientId: 'ca-pub-0000000000000000',
        AdSenseSlotId: '1234567890',
        AdSenseHoldSeconds: 1,
        AdSenseShowOnLogin: false,
        AdSenseShowOnHome: false,
        AdSenseShowAfterIntro: true
    });

    await page.route('**/pagead/js/adsbygoogle.js*', async (route) => {
        if (scriptMode === 'success') {
            await route.fulfill({
                contentType: 'application/javascript',
                body: 'window.adsbygoogle = window.adsbygoogle || []; window.adsbygoogle.push = function () { return true; };'
            });
            return;
        }

        await route.abort();
    });

    try {
        await navigateStage(page, `/details?id=${movieItem.id}`);

        const playButton = page.locator('.btnPlayOrResume, .btnPlay').first();
        await expect(playButton).toBeVisible({ timeout: 60_000 });
        await playButton.click({ force: true });

        await expect(page.locator('.adsenseInterstitialOverlay')).toBeVisible({ timeout: 120_000 });
        await expect(page.locator('.btnContinueAdSense')).toBeEnabled({ timeout: 30_000 });
        await page.locator('.btnContinueAdSense').click();

        await expect.poll(async () => (await getActivePlaybackSessions(page, movieItem.id)).length, {
            timeout: 90_000,
            intervals: [ 2_000, 5_000, 10_000 ]
        }).toBe(1);

        const introSessions = await getActivePlaybackSessions(page, introItem.id);
        expect(introSessions.length).toBe(0);
    } finally {
        await page.evaluate(async (branding) => {
            await window.ApiClient.updateNamedConfiguration('branding', branding);
        }, originalBranding);

        await logoutViaDashboard(page);
    }
}

test.describe.serial('22 - AdSense playback flow', () => {
    test.setTimeout(25 * 60 * 1000);

    test('shows the ad after the intro and resumes the main media', async ({ page }) => {
        await prepareAdSensePlayback(page, 'success');
    });

    test('falls back when the ad script fails to load', async ({ page }) => {
        await prepareAdSensePlayback(page, 'fallback');
    });
});
