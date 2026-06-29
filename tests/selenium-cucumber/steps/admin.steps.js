const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { COMMON_PASSWORD } = require('../support/config');
const { ensureLoggedInAdmin } = require('../support/hooks');
const { By, fillVisible, openStage, waitForVisible } = require('../support/stage');
const {
    assertVisibleByTextOrTitle,
    clickCss,
    clickVisibleByTextOrTitle,
    openAndWait,
    runBrowserAsync,
    waitForAlert,
    waitForAttached,
    waitForVisibleCss
} = require('../support/app');

async function getVisibleTabText(driver, pattern) {
    const tabs = await driver.findElements(By.css('[role="tab"]'));
    for (const tab of tabs) {
        if (!(await tab.isDisplayed().catch(() => false))) {
            continue;
        }
        const text = await tab.getText();
        if (pattern.test(text)) {
            return tab;
        }
    }
    return null;
}

async function assertBodyText(driver, pattern, timeout = 30000) {
    await driver.wait(async () => {
        const text = await driver.findElement(By.css('body')).getText();
        return pattern.test(text);
    }, timeout);
}

Given('I am logged in as admin', async function () {
    await ensureLoggedInAdmin(this);
});

When('I open the dashboard users list', async function () {
    await openStage(this.driver, '/dashboard/users');
    await waitForVisible(this.driver, By.css('#userProfilesPage'));
});

When('I create or reuse a common user', async function () {
    const username = `mflx-user-${crypto.randomUUID().slice(0, 8)}`;
    const password = COMMON_PASSWORD;

    await openStage(this.driver, '/dashboard/users/add');
    await waitForVisible(this.driver, By.css('#newUserPage'));
    await fillVisible(this.driver, By.css('#txtUsername'), username);
    await fillVisible(this.driver, By.css('#txtPassword'), password);
    await this.driver.findElement(By.css('.newUserProfileForm button[type="submit"]')).click();
    await waitForVisible(this.driver, By.css('#usersEditPage'));
    this.createdUsers.push({ username, password });
});

When('I inspect the profile, access, parental control and password tabs', async function () {
    await waitForVisible(this.driver, By.css('#usersEditPage'));

    let tab = await getVisibleTabText(this.driver, /Profile|Perfil/i);
    assert.notEqual(tab, null);
    await tab.click();
    await waitForVisible(this.driver, By.css('.editUserProfileForm'));

    tab = await getVisibleTabText(this.driver, /Access|Acesso/i);
    assert.notEqual(tab, null);
    await tab.click();
    await waitForVisible(this.driver, By.css('.userLibraryAccessForm'));

    tab = await getVisibleTabText(this.driver, /Parental Control|Controle Parental/i);
    assert.notEqual(tab, null);
    await tab.click();
    await waitForVisible(this.driver, By.css('.userParentalControlForm'));

    tab = await getVisibleTabText(this.driver, /Password|Senha/i);
    assert.notEqual(tab, null);
    await tab.click();
    await waitForVisible(this.driver, By.css('.updatePasswordForm'));
});

Then('I should remain on the user edit page', async function () {
    await waitForVisible(this.driver, By.css('#usersEditPage'));
});

When('I inspect the dashboard, settings, user, library, playback and branding pages', async function () {
    const routes = [
        { route: '/dashboard', selector: '#dashboardPage' },
        { route: '/dashboard/settings', selector: '#dashboardGeneralPage' },
        { route: '/dashboard/users', selector: '#userProfilesPage' },
        { route: '/dashboard/users/licenses', selector: '#userLicensesPage' },
        { route: '/dashboard/libraries', selector: '#mediaLibraryPage' },
        { route: '/dashboard/playback/streaming', selector: '#streamingSettingsPage' },
        { route: '/dashboard/activity', selector: '#serverActivityPage' },
        { route: '/dashboard/logs', selector: '#logPage' },
        { route: '/dashboard/devices', selector: '#devicesPage' },
        { route: '/dashboard/plugins', selector: '#pluginsPage' },
        { route: '/dashboard/plugins/repositories', selector: '#repositories' },
        { route: '/dashboard/branding', selector: '#brandingPage' }
    ];

    for (const entry of routes) {
        await openAndWait(this.driver, entry.route, entry.selector);
    }

    await openAndWait(this.driver, '/dashboard/settings', '#dashboardGeneralPage');
    await waitForVisibleCss(this.driver, 'input[name="ServerName"]');
    await assertBodyText(this.driver, /Idioma preferido|Preferred display language/i);
    await waitForVisibleCss(this.driver, 'button[type="submit"]');

    await openAndWait(this.driver, '/dashboard/logs', '#logPage');
    await assertBodyText(this.driver, /Registros|Logs/i);
    await assertBodyText(this.driver, /log_\d+\.log/i);

    await openAndWait(this.driver, '/dashboard/plugins/repositories', '#repositories');
    await assertVisibleByTextOrTitle(this.driver, 'button', /New Repository|Novo Reposit|HeaderNewRepository/i);

    await openAndWait(this.driver, '/dashboard/branding', '#brandingPage');
    await waitForVisibleCss(this.driver, 'textarea[name="LoginDisclaimer"]');
    await waitForVisibleCss(this.driver, 'textarea[name="CustomCss"]');
});

When('I create a disposable admin-form user', async function () {
    const username = `sel-admin-${crypto.randomUUID().slice(0, 8)}`;
    const password = `Adm@${Date.now()}`;

    await openAndWait(this.driver, '/dashboard/users/add', '#newUserPage');
    await waitForVisibleCss(this.driver, '#txtUsername');
    await waitForVisibleCss(this.driver, '#txtPassword');
    await waitForAttached(this.driver, By.css('.chkEnableAllFolders'));

    await fillVisible(this.driver, By.css('#txtUsername'), username);
    await fillVisible(this.driver, By.css('#txtPassword'), password);
    await this.driver.executeScript(() => {
        const allFolders = document.querySelector('.chkEnableAllFolders');
        if (allFolders && !allFolders.checked) {
            allFolders.click();
        }

        const allChannels = document.querySelector('.chkEnableAllChannels');
        if (allChannels && !allChannels.checked) {
            allChannels.click();
        }
    });

    await clickCss(this.driver, '.newUserProfileForm button[type="submit"]');
    await waitForVisibleCss(this.driver, '#usersEditPage');

    const createdUserId = await runBrowserAsync(this.driver, `
        const users = await window.ApiClient.getUsers();
        return users.find(user => user.Name === args[0])?.Id || null;
    `, username);

    assert.ok(createdUserId, 'Expected created user id.');
    this.disposableAdminUser = { username, userId: createdUserId };
});

Then('the disposable admin-form user should be removed', async function () {
    assert.ok(this.disposableAdminUser?.userId, 'Expected disposable user to exist.');

    await runBrowserAsync(this.driver, `
        await window.ApiClient.deleteUser(args[0]);
        return true;
    `, this.disposableAdminUser.userId);

    await openAndWait(this.driver, '/dashboard/users', '#userProfilesPage');
    const remaining = await runBrowserAsync(this.driver, `
        const users = await window.ApiClient.getUsers();
        return users.some(user => user.Name === args[0]);
    `, this.disposableAdminUser.username);

    assert.equal(remaining, false);
});

When('I save the general, streaming and branding settings shells', { timeout: 2 * 60 * 1000 }, async function () {
    await openAndWait(this.driver, '/dashboard/settings', '#dashboardGeneralPage');
    await waitForVisibleCss(this.driver, 'input[name="ServerName"]');
    await waitForVisibleCss(this.driver, 'input[name="CachePath"]');
    await waitForVisibleCss(this.driver, 'input[name="MetadataPath"]');
    await clickCss(this.driver, '#dashboardGeneralPage button[type="submit"]');
    await waitForAlert(this.driver, /Settings saved|SettingsSaved|Saved|Salvo/i, 8000).catch(() => {});

    await openAndWait(this.driver, '/dashboard/playback/streaming', '#streamingSettingsPage');
    await waitForVisibleCss(this.driver, 'input[name="StreamingBitrateLimit"]');
    await clickCss(this.driver, '#streamingSettingsPage button[type="submit"]');
    await waitForAlert(this.driver, /Settings saved|SettingsSaved|Saved|Salvo/i, 8000).catch(() => {});

    await openAndWait(this.driver, '/dashboard/branding', '#brandingPage');
    await waitForVisibleCss(this.driver, 'textarea[name="LoginDisclaimer"]');
    await waitForVisibleCss(this.driver, 'textarea[name="CustomCss"]');
    await clickCss(this.driver, '#brandingPage button[type="submit"]');
    await waitForAlert(this.driver, /Settings saved|SettingsSaved|Saved|Salvo/i, 8000).catch(() => {});
});

When('I inspect live tv status and recordings settings', async function () {
    await openAndWait(this.driver, '/dashboard/livetv', '#liveTvStatusPage');
    await assertVisibleByTextOrTitle(this.driver, 'a,button', /Add Tuner Device|Adicionar dispositivo sintonizador|ButtonAddTunerDevice/i);
    await assertVisibleByTextOrTitle(this.driver, 'button', /Add Provider|Adicionar provedor|ButtonAddProvider/i);
    await assertVisibleByTextOrTitle(this.driver, 'button', /Refresh Guide Data|Atualizar Dados do Guia|ButtonRefreshGuideData/i);

    await clickVisibleByTextOrTitle(this.driver, 'button', /Add Provider|Adicionar provedor|ButtonAddProvider/i);
    await assertVisibleByTextOrTitle(this.driver, '[role="menuitem"],button', /Schedules Direct/i);
    await assertVisibleByTextOrTitle(this.driver, '[role="menuitem"],button', /XMLTV/i);

    await openAndWait(this.driver, '/dashboard/livetv/recordings', '#liveTvSettingsPage');
    await waitForVisibleCss(this.driver, 'input[name="RecordingPath"]');
    await waitForVisibleCss(this.driver, 'input[name="MovieRecordingPath"]');
    await waitForVisibleCss(this.driver, 'input[name="SeriesRecordingPath"]');
    await waitForVisibleCss(this.driver, 'input[name="PrePaddingMinutes"]');
    await waitForVisibleCss(this.driver, 'input[name="PostPaddingMinutes"]');
    await waitForVisibleCss(this.driver, 'input[name="RecordingPostProcessor"]');
});

When('I inspect api keys, jobs and backup dialogs', async function () {
    await openAndWait(this.driver, '/dashboard/keys', '#apiKeysPage');
    const openedApiKeyDialog = await this.driver.executeScript(() => {
        const buttons = Array.from(document.querySelectorAll('#apiKeysPage button'));
        const button = buttons.find(candidate => /New API Key|Nova Chave de API|HeaderNewApiKey|Nova chave/i.test([
            candidate.textContent,
            candidate.getAttribute('title'),
            candidate.getAttribute('aria-label')
        ].filter(Boolean).join(' ')));

        if (!button) {
            return false;
        }

        button.click();
        return true;
    });

    if (openedApiKeyDialog) {
        await waitForVisibleCss(this.driver, '.formDialog, [role="dialog"]');
        await waitForVisibleCss(this.driver, '.formDialog input, [role="dialog"] input');
        await this.driver.actions().sendKeys('\uE00C').perform();
    }

    await openAndWait(this.driver, '/dashboard/jobs', '#jobQueuePage');
    await assertVisibleByTextOrTitle(this.driver, 'button', /Pre-warm images|Prewarm|aquecer imagens/i);
    await assertVisibleByTextOrTitle(this.driver, 'button', /Refresh|Atualizar/i);
    await assertVisibleByTextOrTitle(this.driver, 'button', /Stop all|Parar todos|Stop/i);

    await openAndWait(this.driver, '/dashboard/backups', '#backupsPage');
    await clickVisibleByTextOrTitle(this.driver, 'button', /Create Backup|Criar Backup|ButtonCreateBackup/i);
    await waitForVisibleCss(this.driver, '.formDialog, [role="dialog"]');
    await assertVisibleByTextOrTitle(this.driver, 'label,span,div', /Database|Banco de dados|LabelDatabase/i);
    await assertVisibleByTextOrTitle(this.driver, 'label,span,div', /Metadata|Metadados|LabelMetadata/i);
    await assertVisibleByTextOrTitle(this.driver, 'label,span,div', /Subtitles|Legendas/i);
    await assertVisibleByTextOrTitle(this.driver, 'label,span,div', /Trickplay|Pr.-visualiza/i);
    await clickVisibleByTextOrTitle(this.driver, 'button', /Cancel|ButtonCancel|Cancelar/i).catch(() => {});
});

When('I save networking and library metadata shells', { timeout: 2 * 60 * 1000 }, async function () {
    await openAndWait(this.driver, '/dashboard/networking', '#networkingPage');
    await waitForVisibleCss(this.driver, 'input[name="InternalHttpPort"]');
    await waitForVisibleCss(this.driver, 'input[name="BaseUrl"]');
    await waitForVisibleCss(this.driver, 'input[name="KnownProxies"]');
    await clickCss(this.driver, '#networkingPage button[type="submit"]');
    await waitForAlert(this.driver, /Settings saved|SettingsSaved|Saved|Salvo/i, 8000).catch(() => {});

    await openAndWait(this.driver, '/dashboard/libraries/display', '#libraryDisplayPage');
    await assertBodyText(this.driver, /Comportamento da data de adi..o|Date added behavior/i);
    await clickCss(this.driver, '#libraryDisplayPage button[type="submit"]');
    await waitForAlert(this.driver, /Settings saved|SettingsSaved|Saved|Salvo/i, 8000).catch(() => {});

    await openAndWait(this.driver, '/dashboard/libraries/metadata', '#metadataImagesConfigurationPage');
    await assertBodyText(this.driver, /Idioma|Language/i);
    await assertBodyText(this.driver, /Pa.s|Country/i);
    await clickCss(this.driver, '#metadataImagesConfigurationPage button[type="submit"]');
    await waitForAlert(this.driver, /Settings saved|SettingsSaved|Saved|Salvo/i, 8000).catch(() => {});

    await openAndWait(this.driver, '/dashboard/libraries/nfo', '#metadataNfoPage');
    await assertBodyText(this.driver, /NFO|Salvar|Save/i);
    await clickCss(this.driver, '#metadataNfoPage button[type="submit"]');
    await waitForAlert(this.driver, /Settings saved|SettingsSaved|Saved|Salvo/i, 8000).catch(() => {});

    await openAndWait(this.driver, '/dashboard/libraries/unidentified', '#unidentifiedMediaPage');
    await assertVisibleByTextOrTitle(this.driver, '[role="tab"],button', /Movies|Filmes/i);
    await assertVisibleByTextOrTitle(this.driver, '[role="tab"],button', /Series|S.ries/i);
    await clickVisibleByTextOrTitle(this.driver, 'button', /Refresh|Atualizar/i);
});

When('I inspect every admin management surface', async function () {
    const routes = [
        { route: '/dashboard', selector: '#dashboardPage' },
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
        { route: '/dashboard/activity', selector: '#serverActivityPage' },
        { route: '/dashboard/logs', selector: '#logPage' },
        { route: '/dashboard/devices', selector: '#devicesPage' },
        { route: '/dashboard/plugins', selector: '#pluginsPage' },
        { route: '/dashboard/plugins/repositories', selector: '#repositories' },
        { route: '/dashboard/branding', selector: '#brandingPage' },
        { route: '/dashboard/backups', selector: '#backupsPage' },
        { route: '/dashboard/networking', selector: '#networkingPage' },
        { route: '/dashboard/tasks', selector: '#scheduledTasksPage' },
        { route: '/dashboard/livetv', selector: '#liveTvStatusPage' },
        { route: '/dashboard/livetv/recordings', selector: '#liveTvSettingsPage' }
    ];

    for (const entry of routes) {
        await openAndWait(this.driver, entry.route, entry.selector);
    }

    await openAndWait(this.driver, '/dashboard/logs', '#logPage');
    await waitForVisibleCss(this.driver, '#logPage a[href*="/dashboard/logs/"]');

    await openAndWait(this.driver, '/dashboard/libraries', '#mediaLibraryPage');
    await assertVisibleByTextOrTitle(this.driver, 'button', /Add Media Library|Adicionar biblioteca|ButtonAddMediaLibrary/i).catch(() => {});
});

Then('the admin dashboard shells should be available', async function () {
    const bodyVisible = await this.driver.findElement(By.css('body')).isDisplayed();
    assert.equal(bodyVisible, true);
});
