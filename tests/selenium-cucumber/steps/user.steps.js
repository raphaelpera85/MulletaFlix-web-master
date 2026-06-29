const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { COMMON_PASSWORD } = require('../support/config');
const { ensureLoggedInAdmin } = require('../support/hooks');
const { By, fillVisible, openLogin, stagePublicInfo, waitForVisible } = require('../support/stage');
const {
    authenticateViaApi,
    assertVisibleByTextOrTitle,
    openAndWait,
    runBrowserAsync,
    waitForVisibleCss
} = require('../support/app');

async function assertCurrentUser(world, expectedName) {
    const currentUser = await runBrowserAsync(world.driver, `
        const userId = window.ApiClient.getCurrentUserId();
        const user = await window.ApiClient.getUser(userId);
        return user?.Name || null;
    `);

    assert.equal(currentUser, expectedName);
}

async function createSharedCommonUser(world) {
    await ensureLoggedInAdmin(world);

    const username = `mflx-shared-${crypto.randomUUID().slice(0, 8)}`;
    const password = COMMON_PASSWORD;
    const created = await runBrowserAsync(world.driver, `
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

    world.sharedUser = created;
    return created;
}

Given('a shared common user exists', async function () {
    if (!this.sharedUser) {
        await createSharedCommonUser(this);
    }
});

When('I log in as the shared common user', async function () {
    assert.ok(this.sharedUser?.username, 'Expected shared common user.');
    await authenticateViaApi(this.driver, this.sharedUser.username, this.sharedUser.password);
});

Then('I should see the common user preference menu without admin controls', async function () {
    await openAndWait(this.driver, '/mypreferencesmenu', '#myPreferencesMenuPage');
    await assertCurrentUser(this, this.sharedUser.username);
    await assertVisibleByTextOrTitle(this.driver, '#myPreferencesMenuPage *', new RegExp(this.sharedUser.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    await assertVisibleByTextOrTitle(this.driver, '#myPreferencesMenuPage a, #myPreferencesMenuPage button, #myPreferencesMenuPage div', /Perfil|Profile/i);
    await assertVisibleByTextOrTitle(this.driver, '#myPreferencesMenuPage a, #myPreferencesMenuPage button, #myPreferencesMenuPage div', /In.cio|Home/i);
    await assertVisibleByTextOrTitle(this.driver, '#myPreferencesMenuPage a, #myPreferencesMenuPage button, #myPreferencesMenuPage div', /Reprodu..o|Playback/i);

    const adminSections = await this.driver.findElements(By.css('#myPreferencesMenuPage .adminSection'));
    assert.equal(adminSections.length, 0);
});

When('I open the common user profile and preferences', async function () {
    assert.ok(this.sharedUser?.userId, 'Expected shared common user id.');

    await openAndWait(this.driver, `/userprofile?userId=${this.sharedUser.userId}`, '#userProfilePage');
    await waitForVisibleCss(this.driver, '#btnAddImage');
    await waitForVisibleCss(this.driver, '.updatePasswordForm');
    await waitForVisibleCss(this.driver, '#txtNewPassword');
    await waitForVisibleCss(this.driver, '#txtNewPasswordConfirm');

    await openAndWait(this.driver, '/mypreferencesmenu', '#myPreferencesMenuPage');
});

Then('I should see the common user profile and preference links', async function () {
    await assertVisibleByTextOrTitle(this.driver, '#myPreferencesMenuPage a, #myPreferencesMenuPage button, #myPreferencesMenuPage div', /Perfil|Profile/i);
    await assertVisibleByTextOrTitle(this.driver, '#myPreferencesMenuPage a, #myPreferencesMenuPage button, #myPreferencesMenuPage div', /Exibi..o|Display/i);
    await assertVisibleByTextOrTitle(this.driver, '#myPreferencesMenuPage a, #myPreferencesMenuPage button, #myPreferencesMenuPage div', /In.cio|Home/i);
    await assertVisibleByTextOrTitle(this.driver, '#myPreferencesMenuPage a, #myPreferencesMenuPage button, #myPreferencesMenuPage div', /Reprodu..o|Playback/i);
    await assertVisibleByTextOrTitle(this.driver, '#myPreferencesMenuPage a, #myPreferencesMenuPage button, #myPreferencesMenuPage div', /Legendas|Subtitles/i);

    const adminSections = await this.driver.findElements(By.css('#myPreferencesMenuPage .adminSection'));
    assert.equal(adminSections.length, 0);
});

Given('I am on the login page', async function () {
    const info = await stagePublicInfo();
    await openLogin(this.driver, info.Id);
    await waitForVisible(this.driver, By.css('#loginPage:not(.hide)'));
});

When('I register a common user with a unique email', async function () {
    await ensureLoggedInAdmin(this);
    const existingNames = new Set();
    const users = await this.driver.executeScript(`
        return window.ApiClient.getUsers().then(users =>
            users.map(user => String(user.Name || "").toLowerCase())
        );
    `);
    for (const name of users || []) {
        existingNames.add(name);
    }

    const password = `User@${crypto.randomUUID().slice(0, 8)}2026`;
    let email = '';
    do {
        email = `mflx-register-${crypto.randomUUID().slice(0, 8)}@example.com`;
    } while (existingNames.has(email.toLowerCase()));

    await this.driver.executeScript('window.Dashboard.logout()');
    await waitForVisible(this.driver, By.css('#loginPage:not(.hide)'));
    await this.driver.findElement(By.css('.btnRegister')).click();
    await waitForVisible(this.driver, By.css('.formDialog'));
    await fillVisible(this.driver, By.css('#txtRegisterName'), email);
    await fillVisible(this.driver, By.css('#txtRegisterPassword'), password);
    await fillVisible(this.driver, By.css('#txtRegisterConfirmPassword'), password);
    await this.driver.findElement(By.css('.formDialog button[type="submit"]')).click();
    await this.driver.wait(async () => {
        return this.driver.executeScript(() => {
            const dialog = document.querySelector('.formDialog');
            if (!dialog) {
                return true;
            }

            const rect = dialog.getBoundingClientRect();
            return rect.width === 0 || rect.height === 0;
        });
    }, 60000);

    this.sharedUser = { email, password };
});

Then('I should log in successfully with that account', async function () {
    const { email, password } = this.sharedUser;
    await authenticateViaApi(this.driver, email, password);
    await assertCurrentUser(this, email);
});
