const assert = require('node:assert/strict');
const { By, fillVisible, openLogin, openStage, stagePublicInfo, waitForVisible, until } = require('./stage');

async function waitForAttached(driver, locator, timeout = 30000) {
    return driver.wait(until.elementLocated(locator), timeout);
}

async function waitForVisibleCss(driver, selector, timeout = 30000) {
    return waitForVisible(driver, By.css(selector), timeout);
}

async function openAndWait(driver, route, selector, timeout = 30000) {
    await openStage(driver, route);
    return waitForVisibleCss(driver, selector, timeout);
}

async function clickCss(driver, selector, timeout = 30000) {
    const element = await waitForVisibleCss(driver, selector, timeout);
    await driver.executeScript('arguments[0].click();', element);
    return element;
}

async function visibleElementCount(driver, selector) {
    const elements = await driver.findElements(By.css(selector));
    let count = 0;

    for (const element of elements) {
        if (await element.isDisplayed().catch(() => false)) {
            count += 1;
        }
    }

    return count;
}

async function findVisibleByTextOrTitle(driver, selector, pattern, timeout = 30000) {
    let matched = null;

    await driver.wait(async () => {
        const elements = await driver.findElements(By.css(selector));

        for (const element of elements) {
            if (!(await element.isDisplayed().catch(() => false))) {
                continue;
            }

            const text = await element.getText().catch(() => '');
            const title = await element.getAttribute('title').catch(() => '');
            const ariaLabel = await element.getAttribute('aria-label').catch(() => '');
            const value = `${text} ${title} ${ariaLabel}`;

            if (pattern.test(value)) {
                matched = element;
                return true;
            }
        }

        return false;
    }, timeout);

    return matched;
}

async function assertVisibleByTextOrTitle(driver, selector, pattern, timeout = 30000) {
    const element = await findVisibleByTextOrTitle(driver, selector, pattern, timeout);
    assert.ok(element, `Expected visible ${selector} matching ${pattern}`);
    return element;
}

async function clickVisibleByTextOrTitle(driver, selector, pattern, timeout = 30000) {
    const element = await findVisibleByTextOrTitle(driver, selector, pattern, timeout);
    assert.ok(element, `Expected clickable ${selector} matching ${pattern}`);
    await driver.executeScript('arguments[0].click();', element);
    return element;
}

async function runBrowserAsync(driver, body, ...args) {
    const result = await driver.executeAsyncScript(`
        const done = arguments[arguments.length - 1];
        const args = Array.from(arguments).slice(0, -1);

        (async () => {
            ${body}
        })().then(
            value => done({ ok: true, value }),
            error => done({ ok: false, error: error && (error.stack || error.message) || String(error) })
        );
    `, ...args);

    if (!result?.ok) {
        throw new Error(result?.error || 'Browser async script failed.');
    }

    return result.value;
}

async function loginWithManualForm(driver, username, password) {
    const info = await stagePublicInfo();
    await openLogin(driver, info.Id);
    await waitForVisibleCss(driver, '#loginPage');

    await driver.executeScript(() => {
        const button = document.querySelector('#loginPage .btnManual');
        if (button) {
            button.click();
        }
    });

    await fillVisible(driver, By.css('#txtManualName'), username);
    await fillVisible(driver, By.css('#txtManualPassword'), password);
    await clickCss(driver, '.manualLoginForm button[type="submit"]');
    await waitForVisibleCss(driver, '#indexPage', 30000);
}

async function authenticateViaApi(driver, username, password) {
    const authResult = await runBrowserAsync(driver, `
        const apiClient = window.ApiClient;
        const dashboard = window.Dashboard;

        if (!apiClient || typeof apiClient.authenticateUserByName !== 'function') {
            throw new Error('ApiClient authentication is not available in the current browser context.');
        }

        const result = await apiClient.authenticateUserByName(args[0], args[1]);
        if (typeof apiClient.setAuthenticationInfo === 'function') {
            apiClient.setAuthenticationInfo(result.AccessToken, result.User.Id);
        }

        if (dashboard && typeof dashboard.onServerChanged === 'function') {
            dashboard.onServerChanged(result.User.Id, result.AccessToken, apiClient);
        }

        if (dashboard && typeof dashboard.navigate === 'function') {
            dashboard.navigate('home');
        }

        return {
            userId: result.User.Id,
            username: result.User.Name || args[0]
        };
    `, username, password);

    await waitForVisibleCss(driver, '#indexPage', 30000);
    return authResult;
}

async function logoutViaDashboard(driver) {
    await driver.executeScript(() => {
        if (window.Dashboard && typeof window.Dashboard.logout === 'function') {
            window.Dashboard.logout();
        }
    });
}

async function waitForAlert(driver, pattern, timeout = 30000) {
    await driver.wait(async () => {
        const alerts = await driver.findElements(By.css('[role="alert"]'));

        for (const alert of alerts) {
            if (!(await alert.isDisplayed().catch(() => false))) {
                continue;
            }

            const text = await alert.getText().catch(() => '');
            if (pattern.test(text)) {
                return true;
            }
        }

        return false;
    }, timeout);
}

module.exports = {
    authenticateViaApi,
    assertVisibleByTextOrTitle,
    clickCss,
    clickVisibleByTextOrTitle,
    findVisibleByTextOrTitle,
    loginWithManualForm,
    logoutViaDashboard,
    openAndWait,
    runBrowserAsync,
    visibleElementCount,
    waitForAlert,
    waitForAttached,
    waitForVisibleCss
};
