const { After, Before, Status, setDefaultTimeout } = require('@cucumber/cucumber');
const fs = require('node:fs/promises');
const path = require('node:path');
const { ADMIN_USER, ADMIN_PASSWORD, HEADLESS } = require('./config');
const { createDriver, seedStageConnection, stagePublicInfo, isStageClean, openLogin, waitForVisible, By } = require('./stage');

setDefaultTimeout(60_000);

Before(async function () {
    this.stageInfo = await stagePublicInfo();
    this.driver = await createDriver(HEADLESS);
    await seedStageConnection(this.driver, this.stageInfo);

    const clean = await isStageClean();
    if (!clean) {
        this.lastError = new Error(`Stage is not clean. StartupWizardCompleted=${String(this.stageInfo.StartupWizardCompleted)}`);
    }
});

After(async function (scenario) {
    if (scenario.result?.status === Status.FAILED) {
        this.lastError = scenario.result.exception || this.lastError;
        try {
            const reportDir = path.join(process.cwd(), 'tests', 'selenium-cucumber', 'reports');
            await fs.mkdir(reportDir, { recursive: true });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotPath = path.join(reportDir, `failure-${stamp}.png`);
            const urlPath = path.join(reportDir, `failure-${stamp}.txt`);
            if (this.driver) {
                await fs.writeFile(screenshotPath, await this.driver.takeScreenshot(), 'base64');
                await fs.writeFile(urlPath, await this.driver.getCurrentUrl(), 'utf8');
                console.error(`Saved Selenium failure artifacts to ${screenshotPath}`);
            }
        } catch (error) {
            console.error(`[Selenium] failed to capture artifacts: ${error.message}`);
        }
    }

    if (this.driver) {
        await this.driver.quit();
    }
});

async function ensureLoggedInAdmin(world) {
    const serverId = world.stageInfo?.Id || null;
    await openLogin(world.driver, serverId);
    await waitForVisible(world.driver, By.css('#loginPage'));
    await world.driver.executeScript(() => {
        const button = document.querySelector('#loginPage .btnManual');
        if (button) {
            button.click();
        }
    });
    await waitForVisible(world.driver, By.css('#txtManualName'));
    await world.driver.findElement(By.css('#txtManualName')).sendKeys(ADMIN_USER);
    await world.driver.findElement(By.css('#txtManualPassword')).sendKeys(ADMIN_PASSWORD);
    await world.driver.findElement(By.css('.manualLoginForm button[type="submit"]')).click();
    await waitForVisible(world.driver, By.css('#indexPage'));
}

module.exports = {
    ensureLoggedInAdmin
};
