const { Then, When } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MOVIES_PATH, SERIES_PATH } = require('../support/config');
const {
    authenticateViaApi,
    openAndWait,
    runBrowserAsync,
    waitForVisibleCss
} = require('../support/app');

const MOVIES_LIBRARY = {
    name: 'Filmes',
    type: 'movies',
    path: MOVIES_PATH,
    route: 'movies',
    pageSelector: '#moviesPage',
    aliases: [ 'Filmes', 'Movies', 'Movie', 'Filmes locais', 'Local movies' ]
};

const SERIES_LIBRARY = {
    name: 'Series',
    type: 'tvshows',
    path: SERIES_PATH,
    route: 'tv',
    pageSelector: '#tvshowsPage',
    aliases: [ 'Series', 'Séries', 'TV Shows', 'Shows', 'Programas de TV' ]
};

const MEDIA_LIBRARIES = [ MOVIES_LIBRARY, SERIES_LIBRARY ];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRuntimeLibrary(world, library) {
    return (world.mediaLibraries || []).find(entry => (
        entry.type === library.type
        || entry.name === library.name
        || library.aliases.some(alias => String(alias).toLowerCase() === String(entry.name || '').toLowerCase())
    )) || null;
}

async function clickHomeLibrary(world, library) {
    const driver = world.driver;
    const runtimeLibrary = getRuntimeLibrary(world, library);
    if (runtimeLibrary?.id) {
        await openAndWait(driver, `/${library.route}?topParentId=${runtimeLibrary.id}&collectionType=${library.type}`, library.pageSelector);
        return;
    }

    await openAndWait(driver, '/home', '#indexPage');
    const clicked = await driver.executeScript((collectionType) => {
        const links = Array.from(document.querySelectorAll(`#indexPage a[href*="collectionType=${collectionType}"]`));
        const visible = links.find(link => {
            const rect = link.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });

        if (!visible) {
            return false;
        }

        visible.click();
        return true;
    }, library.type);

    if (clicked) {
        await waitForVisibleCss(driver, library.pageSelector, 30000);
        return;
    }

    assert.fail(`Expected visible home link or virtual folder for ${library.name}`);
}

async function firstCardId(driver, pageSelector) {
    return driver.executeScript((selector) => {
        const card = document.querySelector(`${selector} .card`);
        return card?.getAttribute('data-id') || null;
    }, pageSelector);
}

async function waitForFirstCardId(driver, pageSelector, timeout = 60000) {
    let cardId = null;
    await driver.wait(async () => {
        cardId = await firstCardId(driver, pageSelector);
        return Boolean(cardId);
    }, timeout);

    return cardId;
}

async function assertLibraryPagination(world, library) {
    const driver = world.driver;
    await clickHomeLibrary(world, library);

    const firstId = await waitForFirstCardId(driver, library.pageSelector);
    assert.ok(firstId, `Expected first card id for ${library.name}`);

    const nextState = await driver.executeScript((selector) => {
        const button = document.querySelector(`${selector} .btnNextPage`);
        if (!button || button.disabled) {
            return 'unavailable';
        }

        button.click();
        return 'clicked';
    }, library.pageSelector);

    if (nextState === 'unavailable') {
        return;
    }

    await driver.wait(async () => {
        const currentId = await firstCardId(driver, library.pageSelector);
        return currentId && currentId !== firstId;
    }, 30000);

    await driver.executeScript((selector) => {
        const button = document.querySelector(`${selector} .btnPreviousPage`);
        if (button && !button.disabled) {
            button.click();
        }
    }, library.pageSelector);
}

When('I ensure movies and series libraries are recognized', { timeout: 25 * 60 * 1000 }, async function () {
    this.mediaLibraries = await runBrowserAsync(this.driver, `
        const libraries = args[0];
        const existing = await window.ApiClient.getVirtualFolders();
        const normalize = value => String(value || '').trim().toLowerCase();
        const getPaths = folder => Array.isArray(folder.PathInfos)
            ? folder.PathInfos.map(pathInfo => normalize(pathInfo?.Path))
            : [];
        const matches = (folder, library) => {
            const aliases = [library.name, ...(library.aliases || [])].map(normalize).filter(Boolean);
            const folderName = normalize(folder.Name);
            const folderType = normalize(folder.CollectionType);
            const folderPaths = getPaths(folder);
            const libraryType = normalize(library.type);
            const libraryPath = normalize(library.path);

            return aliases.includes(folderName)
                || aliases.some(alias => alias && folderName.includes(alias))
                || folderType === libraryType
                || folderPaths.includes(libraryPath);
        };

        for (const library of libraries) {
            const alreadyExists = existing.some(folder => matches(folder, library));
            if (!alreadyExists) {
                await window.ApiClient.addVirtualFolder(library.name, library.type, true, {
                    PathInfos: [
                        { Path: library.path }
                    ]
                });
            }
        }

        const folders = await window.ApiClient.getVirtualFolders();
        return libraries.map(library => {
            const folder = folders.find(candidate => matches(candidate, library));
            if (!folder?.ItemId && !folder?.Id) {
                throw new Error('Virtual folder was not created for ' + library.name);
            }

            return {
                name: folder.Name || library.name,
                type: folder.CollectionType || library.type,
                id: folder.ItemId || folder.Id,
                path: (Array.isArray(folder.PathInfos) && folder.PathInfos[0]?.Path) || library.path
            };
        });
    `, MEDIA_LIBRARIES);

    let lastCounts = null;
    let stableChecks = 0;
    const deadline = Date.now() + (22 * 60 * 1000);

    while (Date.now() < deadline) {
        const counts = await runBrowserAsync(this.driver, `
            return await window.ApiClient.getItemCounts();
        `);

        const movieCount = Number(counts?.MovieCount || 0);
        const seriesCount = Number(counts?.SeriesCount || 0);

        if (movieCount > 0 && seriesCount > 0) {
            if (lastCounts?.MovieCount === movieCount && lastCounts?.SeriesCount === seriesCount) {
                stableChecks += 1;
            } else {
                stableChecks = 0;
            }

            lastCounts = { MovieCount: movieCount, SeriesCount: seriesCount };

            if (stableChecks >= 1) {
                this.mediaCounts = lastCounts;
                return;
            }
        }

        await sleep(45000);
    }

    throw new Error('Media recognition did not stabilize before timeout.');
});

Then('I should see media libraries and home carousels', { timeout: 2 * 60 * 1000 }, async function () {
    await openAndWait(this.driver, '/home', '#indexPage');

    for (const library of MEDIA_LIBRARIES) {
        const hasHomeLink = await this.driver.wait(async () => {
            return this.driver.executeScript((collectionType) => {
                return Array.from(document.querySelectorAll(`#indexPage a[href*="collectionType=${collectionType}"]`))
                    .some(link => {
                        const rect = link.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0;
                    });
            }, library.type);
        }, 8000).catch(() => false);

        if (!hasHomeLink) {
            const runtimeLibrary = getRuntimeLibrary(this, library);
            assert.ok(runtimeLibrary?.id, `Expected ${library.name} home link or recognized virtual folder.`);
            await clickHomeLibrary(this, library);
            assert.ok(await waitForFirstCardId(this.driver, library.pageSelector), `Expected card in ${library.name} library.`);
            await openAndWait(this.driver, '/home', '#indexPage');
            continue;
        }

        const hasSectionCards = await this.driver.wait(async () => {
            return this.driver.executeScript((aliases) => {
                const pattern = new RegExp(aliases.map(alias => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
                return Array.from(document.querySelectorAll('.homePage .verticalSection')).some(section => {
                    const rect = section.getBoundingClientRect();
                    return rect.width > 0
                        && rect.height > 0
                        && pattern.test(section.textContent || '')
                        && section.querySelector('.card');
                });
            }, library.aliases);
        }, 30000);

        assert.equal(hasSectionCards, true, `Expected carousel cards for ${library.name}`);
    }
});

Then('I should page through movies and series when pagination is available', { timeout: 3 * 60 * 1000 }, async function () {
    await assertLibraryPagination(this, MOVIES_LIBRARY);
    await assertLibraryPagination(this, SERIES_LIBRARY);
});

Then('I should inspect media metadata, plugin, task and log details', { timeout: 3 * 60 * 1000 }, async function () {
    await openAndWait(this.driver, '/movies', '#moviesPage');
    const firstMovieId = await waitForFirstCardId(this.driver, '#moviesPage');
    assert.ok(firstMovieId, 'Expected first movie id.');

    await openAndWait(this.driver, `/metadata?id=${firstMovieId}`, '#editItemMetadataPage');
    await waitForVisibleCss(this.driver, '#editItemMetadataPage .libraryTree');
    await waitForVisibleCss(this.driver, '#editItemMetadataPage .editPageInnerContent');

    const plugin = await runBrowserAsync(this.driver, `
        const plugins = await window.ApiClient.getInstalledPlugins();
        const plugin = plugins?.[0];
        return plugin?.Id ? { id: plugin.Id, name: plugin.Name || plugin.Id } : null;
    `);

    if (plugin?.id) {
        await openAndWait(this.driver, `/dashboard/plugins/${plugin.id}?name=${encodeURIComponent(plugin.name)}`, '#addPluginPage');
    }

    const task = await runBrowserAsync(this.driver, `
        const tasks = await window.ApiClient.getScheduledTasks();
        const task = tasks?.[0];
        return task?.Id ? { id: task.Id, name: task.Name || task.Key || task.Id } : null;
    `);

    if (task?.id) {
        await openAndWait(this.driver, `/dashboard/tasks/${task.id}`, '#scheduledTaskPage');
    }

    await openAndWait(this.driver, '/dashboard/logs', '#logPage');
    const clickedLog = await this.driver.executeScript(() => {
        const link = document.querySelector('#logPage a[href*="/dashboard/logs/"]');
        if (!link) {
            return false;
        }

        link.click();
        return true;
    });

    if (clickedLog) {
        await waitForVisibleCss(this.driver, '#logPage pre', 30000);
    }
});

When('I create a temporary common media user', async function () {
    const username = `mflx-paging-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const password = `User@${crypto.randomUUID().slice(0, 8)}2026`;

    this.tempMediaUser = await runBrowserAsync(this.driver, `
        const created = await window.ApiClient.createUser({
            Name: args[0],
            Password: args[1]
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
            username: created.Name || args[0],
            password: args[1],
            userId: created.Id
        };
    `, username, password);
});

When('I log in as the temporary common media user', async function () {
    assert.ok(this.tempMediaUser?.username, 'Expected temporary media user.');
    await authenticateViaApi(this.driver, this.tempMediaUser.username, this.tempMediaUser.password);
});
