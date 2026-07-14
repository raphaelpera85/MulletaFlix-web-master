import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';

import {
    deleteUserById,
    getAdminCredentials,
    loginWithManualForm,
    logoutViaDashboard,
} from '../support/admin-user.mjs';
import { ensureWizardCompleted } from '../support/wizard.mjs';
import { navigateStage } from '../support/stage.mjs';
import {
    ensureMediaLibrariesReady,
    getFirstItemFromVirtualFolder,
    getVirtualFolderByLibrary,
    MOVIES_LIBRARY,
} from '../support/media-library.mjs';

async function createPlayableUser(page, username, password) {
    return page.evaluate(async ({ currentUsername, currentPassword }) => {
        const createdUser = await window.ApiClient.createUser({
            Name: currentUsername,
            Password: currentPassword
        });

        const user = await window.ApiClient.getUser(createdUser.Id);
        await window.ApiClient.updateUserPolicy(createdUser.Id, {
            ...user.Policy,
            EnableAllFolders: true,
            EnableAllChannels: true,
            EnableMediaPlayback: true,
            EnableLiveTvAccess: true,
            IsAdministrator: false
        });

        return {
            username: createdUser.Name || currentUsername,
            password: currentPassword,
            userId: createdUser.Id
        };
    }, {
        currentUsername: username,
        currentPassword: password
    });
}

async function loginAndPlayItem(context, credentials, itemId) {
    const page = await context.newPage();
    await loginWithManualForm(page, credentials.username, credentials.password);
    await navigateStage(page, `/details?id=${itemId}`);

    const playButton = page.locator('.btnPlayOrResume, .btnPlay').first();
    await expect(playButton).toBeVisible({ timeout: 60_000 });
    await playButton.click({ force: true });

    return page;
}

async function getActivePlaybackSessions(page, itemId) {
    return page.evaluate(async (targetItemId) => {
        const sessions = await window.ApiClient.getSessions({ activeWithinSeconds: 120 });
        return sessions
            .filter((session) => String(session.NowPlayingItem?.Id || '').toLowerCase() === String(targetItemId).toLowerCase())
            .map((session) => ({
                userName: session.UserName || '',
                sessionId: session.Id || '',
                deviceName: session.DeviceName || ''
            }));
    }, itemId);
}

type PlayableUser = {
    username: string;
    password: string;
    userId: string;
};

test.describe.serial('21 - Multi user playback', () => {
    test.setTimeout(20 * 60 * 1000);

    test('keeps media playback active for two different users at the same time', async ({ browser, page }) => {
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

        const movie = await getFirstItemFromVirtualFolder(page, folderId);
        if (!movie?.id) {
            test.skip(true, 'no movie item available to validate concurrent playback');
        }

        const firstUsername = `mflx-playback-${crypto.randomUUID().slice(0, 8)}@example.com`;
        const secondUsername = `mflx-playback-${crypto.randomUUID().slice(0, 8)}@example.com`;
        const password = `User@${crypto.randomUUID().slice(0, 8)}2026`;

        let firstUser: PlayableUser | undefined;
        let secondUser: PlayableUser | undefined;
        const firstContext = await browser.newContext();
        const secondContext = await browser.newContext();
        let firstPage;
        let secondPage;

        try {
            firstUser = await createPlayableUser(page, firstUsername, password);
            secondUser = await createPlayableUser(page, secondUsername, password);

            firstPage = await loginAndPlayItem(firstContext, firstUser, movie.id);
            await expect.poll(async () => (await getActivePlaybackSessions(page, movie.id)).length, {
                timeout: 90_000,
                intervals: [ 2_000, 5_000, 10_000 ]
            }).toBe(1);

            secondPage = await loginAndPlayItem(secondContext, secondUser, movie.id);
            await expect.poll(async () => (await getActivePlaybackSessions(page, movie.id)).length, {
                timeout: 90_000,
                intervals: [ 2_000, 5_000, 10_000 ]
            }).toBe(2);

            const sessions = await getActivePlaybackSessions(page, movie.id);
            expect(sessions.map((session) => session.userName).sort()).toEqual([ firstUser.username, secondUser.username ].sort());
            expect(new Set(sessions.map((session) => session.sessionId)).size).toBe(2);
        } finally {
            if (firstPage) {
                await firstPage.close().catch(() => {});
            }
            if (secondPage) {
                await secondPage.close().catch(() => {});
            }

            await firstContext.close().catch(() => {});
            await secondContext.close().catch(() => {});

            if (firstUser?.userId) {
                await deleteUserById(page, firstUser.userId);
            }

            if (secondUser?.userId) {
                await deleteUserById(page, secondUser.userId);
            }

            await logoutViaDashboard(page);
        }
    });
});
