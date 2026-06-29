const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');
const { ADMIN_USER, ADMIN_PASSWORD } = require('../support/config');
const { By, completeWizardSetup, openLogin, openStage, selectVisibleOption, stagePublicInfo, waitForVisible } = require('../support/stage');
const { waitForVisibleCss } = require('../support/app');

async function submitForm(driver, selector) {
    await driver.executeScript(`
        const form = document.querySelector(${JSON.stringify(selector)});
        if (!form) {
            throw new Error('Form not found: ${selector}');
        }

        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
        } else {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    `);
}

Given('the stage is clean', async function () {
    assert.equal(this.stageInfo?.StartupWizardCompleted, false);
});

When('I open the wizard start page', async function () {
    await openStage(this.driver, '/wizard/start');
    await waitForVisible(this.driver, By.css('#wizardStartPage'));
});

Then('I should see the wizard form controls', async function () {
    await waitForVisibleCss(this.driver, '.wizardStartForm');
    await waitForVisibleCss(this.driver, '#txtServerName');
    await waitForVisibleCss(this.driver, '#selectLocalizationLanguage');
    await waitForVisibleCss(this.driver, '.button-submit');
});

When('I complete the wizard with the admin user', async function () {
    const serverName = await this.driver.findElement(By.css('#txtServerName'));
    await serverName.clear();
    await serverName.sendKeys('Mulletaflix');
    await selectVisibleOption(this.driver, By.css('#selectLocalizationLanguage'), [ 'pt', 'pt-BR', 'en' ]);
    await completeWizardSetup(this.stageInfo?.LocalAddress || process.env.STAGE_URL || 'http://127.0.0.1:8096', {
        serverName: 'Mulletaflix',
        adminUser: ADMIN_USER,
        adminPassword: ADMIN_PASSWORD
    });
    await openLogin(this.driver, this.stageInfo?.Id || null);
    await waitForVisible(this.driver, By.css('#loginPage'));
});

Given('the wizard has been completed with the admin user', async function () {
    const info = await stagePublicInfo();

    if (info.StartupWizardCompleted === false) {
        await completeWizardSetup(this.stageInfo?.LocalAddress || process.env.STAGE_URL || 'http://127.0.0.1:8096', {
            serverName: 'Mulletaflix',
            adminUser: ADMIN_USER,
            adminPassword: ADMIN_PASSWORD
        });
    }

    await openLogin(this.driver, this.stageInfo?.Id || null);
    await waitForVisible(this.driver, By.css('#loginPage'));
});

Then('I should reach the login page', async function () {
    await waitForVisible(this.driver, By.css('#loginPage'));
});
