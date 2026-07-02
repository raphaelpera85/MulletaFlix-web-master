import { expect } from '@playwright/test';

export const MOVIES_LIBRARY = {
    name: 'Filmes',
    type: 'movies',
    path: 'D:\\Users\\Raphael\\Videos\\Filmes',
    aliases: [ 'Filmes', 'Movies', 'Movie', 'Filmes locais', 'Local movies' ]
};

export const SERIES_LIBRARY = {
    name: 'Series',
    type: 'tvshows',
    path: 'D:\\Users\\Raphael\\Videos\\Series',
    aliases: [ 'Series', 'Séries', 'TV Shows', 'Shows', 'Programas de TV' ]
};

const DEFAULT_MEDIA_LIBRARIES = [ MOVIES_LIBRARY, SERIES_LIBRARY ];

function normalizeName(name) {
    return String(name || '').trim().toLowerCase();
}

function getFolderPaths(folder) {
    return [
        folder?.Path,
        folder?.PathInfo?.Path,
        ...(Array.isArray(folder?.PathInfos) ? folder.PathInfos.map(pathInfo => pathInfo?.Path) : [])
    ].filter(Boolean);
}

function matchesLibrary(folder, library) {
    const folderName = normalizeName(folder?.Name);
    const folderType = normalizeName(folder?.CollectionType);
    const libraryName = normalizeName(library?.name);
    const aliases = [ library?.name, ...(library?.aliases || []) ].map(normalizeName);
    const libraryType = normalizeName(library?.type);
    const folderPaths = getFolderPaths(folder).map(normalizeName);
    const libraryPath = normalizeName(library?.path);

    return (
        aliases.includes(folderName)
        || aliases.some(alias => alias && folderName.includes(alias))
        || folderType === libraryType
        || (libraryPath && folderPaths.includes(libraryPath))
        || (libraryName && folderName.includes(libraryName))
    );
}

export async function ensureMediaLibraries(page, libraries = DEFAULT_MEDIA_LIBRARIES) {
    const createdLibraries = await page.evaluate(async (librarySeed) => {
        const existing = await window.ApiClient.getVirtualFolders();
        const created = [];

        for (const library of librarySeed) {
            const aliases = [ library.name, ...(library.aliases || []) ]
                .map(name => String(name || '').trim().toLowerCase())
                .filter(Boolean);

            if (existing.some(folder => {
                const folderName = String(folder.Name || '').trim().toLowerCase();
                const folderType = String(folder.CollectionType || '').trim().toLowerCase();
                const folderPathInfos = Array.isArray(folder.PathInfos) ? folder.PathInfos : [];
                const folderPaths = folderPathInfos.map(pathInfo => String(pathInfo?.Path || '').trim().toLowerCase());

                return (
                    aliases.includes(folderName)
                    || aliases.some(alias => alias && folderName.includes(alias))
                    || folderType === String(library.type || '').trim().toLowerCase()
                    || folderPaths.includes(String(library.path || '').trim().toLowerCase())
                );
            })) {
                continue;
            }

            await window.ApiClient.addVirtualFolder(library.name, library.type, true, {
                PathInfos: [
                    { Path: library.path }
                ]
            });
            created.push(library.name);
        }

        return {
            existingCount: existing.length,
            created
        };
    }, libraries);

    return createdLibraries;
}

export async function waitForMediaRecognition(page, {
    timeoutMs = 20 * 60 * 1000,
    pollIntervalMs = 30_000
} = {}) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const counts = await page.evaluate(async () => window.ApiClient.getItemCounts());
        const movieCount = Number(counts?.MovieCount || 0);
        const seriesCount = Number(counts?.SeriesCount || 0);

        if (movieCount > 0 && seriesCount > 0) {
            return {
                MovieCount: movieCount,
                SeriesCount: seriesCount
            };
        }

        await page.waitForTimeout(pollIntervalMs);
    }

    throw new Error('Media recognition did not stabilize before timeout.');
}

export async function ensureMediaLibrariesReady(page, options = {}) {
    const libraries = options.libraries || DEFAULT_MEDIA_LIBRARIES;
    await ensureMediaLibraries(page, libraries);

    await page.evaluate(async () => {
        const tasks = await window.ApiClient.getScheduledTasks();
        const refreshTask = tasks?.find(task => task?.Key === 'RefreshLibrary' && task?.Id);

        if (refreshTask?.Id) {
            try {
                await window.ApiClient.startScheduledTask(refreshTask.Id);
            } catch (error) {
                console.warn('Unable to start RefreshLibrary task', error);
            }
        }
    });

    await page.waitForTimeout(options.settleMs ?? 60_000);
    return null;
}

export async function getVirtualFolders(page) {
    return page.evaluate(async () => {
        try {
            return await window.ApiClient.getVirtualFolders();
        } catch (error) {
            console.warn('Unable to load virtual folders', error);
            return [];
        }
    });
}

export async function getVirtualFolderByName(page, name) {
    const folders = await getVirtualFolders(page);
    const names = Array.isArray(name) ? name : [ name ];
    const normalizedNames = names.map(normalizeName).filter(Boolean);

    return folders.find(folder => {
        const folderName = normalizeName(folder.Name);
        const folderType = normalizeName(folder.CollectionType);
        const folderPaths = getFolderPaths(folder).map(normalizeName);

        return (
            normalizedNames.includes(folderName)
            || normalizedNames.some(alias => alias && folderName.includes(alias))
            || normalizedNames.includes(folderType)
            || folderPaths.some(path => normalizedNames.includes(path))
        );
    }) || null;
}

export async function getVirtualFolderByLibrary(page, library) {
    const folders = await getVirtualFolders(page);
    return folders.find(folder => matchesLibrary(folder, library)) || null;
}

export async function getFirstItemFromVirtualFolder(page, folderId) {
    if (!folderId) {
        return null;
    }

    return page.evaluate(async (parentId) => {
        const result = await window.ApiClient.getItems(window.ApiClient.getCurrentUserId(), {
            ParentId: parentId,
            Limit: 1,
            Recursive: true,
            Fields: 'PrimaryImageAspectRatio,ParentId,Path,ProviderIds'
        });
        const item = result?.Items?.[0];

        if (!item?.Id) {
            return null;
        }

        return {
            id: item.Id,
            name: item.Name || item.Id
        };
    }, folderId);
}

export async function getFirstInstalledPlugin(page) {
    return page.evaluate(async () => {
        const plugins = await window.ApiClient.getInstalledPlugins();
        const plugin = plugins?.[0];

        if (!plugin?.Id) {
            return null;
        }

        return {
            id: plugin.Id,
            name: plugin.Name || plugin.Id
        };
    });
}

export async function getFirstScheduledTask(page) {
    return page.evaluate(async () => {
        const tasks = await window.ApiClient.getScheduledTasks();
        const task = tasks?.[0];

        if (!task?.Id) {
            return null;
        }

        return {
            id: task.Id,
            name: task.Name || task.Key || task.Id
        };
    });
}

export async function getFirstServerLogFile(page) {
    return page.evaluate(async () => {
        const logs = await window.ApiClient.getServerLogs();
        const log = logs?.[0];

        if (!log?.Name) {
            return null;
        }

        return {
            name: log.Name
        };
    });
}

export async function ensureUserMediaAccess(page, userId) {
    await page.evaluate(async (targetUserId) => {
        const user = await window.ApiClient.getUser(targetUserId);
        const policy = {
            ...user.Policy,
            EnableAllFolders: true,
            EnableAllChannels: true,
            EnableMediaPlayback: true,
            EnableLiveTvAccess: true,
            EnableLiveTvManagement: false,
            IsAdministrator: false
        };

        await window.ApiClient.updateUserPolicy(targetUserId, policy);
    }, userId);

    await expect(page.locator('#loginPage')).toBeHidden().catch(() => true);
}
