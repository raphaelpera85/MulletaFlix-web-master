const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { chromium } = require('playwright');
const { ROOT_URL } = require('./config');
const CLIENT_INDEX_URL = `${ROOT_URL}/web/index.html`;

function normalizeRoute(route = '/') {
    const value = String(route || '/').trim();
    if (!value || value === '/') {
        return '/';
    }

    return value.startsWith('/') ? value.slice(1) : value;
}

function normalizeSpaRoute(route = '/') {
    return normalizeRoute(route);
}

function stageUrl(route = '/') {
    const normalized = normalizeRoute(route);
    if (!normalized) {
        return CLIENT_INDEX_URL;
    }

    return `${CLIENT_INDEX_URL}#/${normalized}`;
}

async function stagePublicInfo(baseUrl = ROOT_URL) {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    let lastError;

    for (let attempt = 1; attempt <= 60; attempt++) {
        try {
            const response = await fetch(`${normalizedBaseUrl}/System/Info/Public`, {
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch stage public info (${response.status}).`);
            }

            return response.json();
        } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    throw lastError || new Error('Failed to fetch stage public info.');
}

async function completeWizardSetup(baseUrl = ROOT_URL, { serverName = 'Mulletaflix', adminUser, adminPassword } = {}) {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

    const configurationResponse = await fetch(`${normalizedBaseUrl}/Startup/Configuration`, {
        cache: 'no-cache'
    });

    if (!configurationResponse.ok) {
        throw new Error(`Failed to load startup configuration (${configurationResponse.status}).`);
    }

    const configuration = await configurationResponse.json();
    configuration.ServerName = serverName || configuration.ServerName || 'Mulletaflix';
    if (!configuration.UICulture) {
        configuration.UICulture = 'pt';
    }

    const saveConfigurationResponse = await fetch(`${normalizedBaseUrl}/Startup/Configuration`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(configuration)
    });

    if (!saveConfigurationResponse.ok) {
        throw new Error(`Failed to save startup configuration (${saveConfigurationResponse.status}).`);
    }

    if (adminUser && adminPassword) {
        const userResponse = await fetch(`${normalizedBaseUrl}/Startup/User`, {
            cache: 'no-cache'
        });

        if (!userResponse.ok) {
            throw new Error(`Failed to load startup user (${userResponse.status}).`);
        }

        const user = await userResponse.json();
        user.Name = adminUser;
        user.Password = adminPassword;

        const saveUserResponse = await fetch(`${normalizedBaseUrl}/Startup/User`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(user)
        });

        if (!saveUserResponse.ok) {
            throw new Error(`Failed to save startup user (${saveUserResponse.status}).`);
        }
    }

    const remoteAccessResponse = await fetch(`${normalizedBaseUrl}/Startup/RemoteAccess`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ EnableRemoteAccess: true })
    });

    if (!remoteAccessResponse.ok) {
        throw new Error(`Failed to save startup remote access (${remoteAccessResponse.status}).`);
    }

    const completeResponse = await fetch(`${normalizedBaseUrl}/Startup/Complete`, {
        method: 'POST'
    });

    if (!completeResponse.ok) {
        throw new Error(`Failed to complete wizard setup (${completeResponse.status}).`);
    }
}

async function seedStageConnection(driver, info = null) {
    const stageInfo = info || await stagePublicInfo();
    const credentials = {
        Servers: [
            {
                Id: stageInfo.Id,
                Name: stageInfo.ServerName || 'MulletaFlix API',
                ManualAddress: ROOT_URL,
                LastConnectionMode: 2,
                manualAddressOnly: true,
                DateLastAccessed: Date.now(),
                UserId: null,
                AccessToken: null
            }
        ]
    };

    await driver.get(ROOT_URL);
    await driver.executeScript((seededCredentials) => {
        localStorage.setItem('jellyfin_credentials', JSON.stringify(seededCredentials));
    }, credentials);
}

async function createDriver(headless = true) {
    const options = new chrome.Options();
    const binaryPath = chromium?.executablePath?.();

    if (binaryPath) {
        options.setChromeBinaryPath(binaryPath);
    }

    options.addArguments('--window-size=1600,1000');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--allow-file-access-from-files');
    if (process.platform === 'win32') {
        // ponytail: Selenium/Cucumber runs only in tests; Chromium sandbox is noisy on the bundled Windows binary.
        options.addArguments('--no-sandbox');
    }
    if (headless) {
        options.addArguments('--headless=new');
    }

    return new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
}

async function openStage(driver, route = '/') {
    await driver.get(stageUrl(route));
}

async function navigateSpa(driver, route = '/') {
    await driver.executeScript((targetRoute) => {
        window.Dashboard.navigate(targetRoute);
    }, normalizeSpaRoute(route));
}

async function openLogin(driver, serverId = null) {
    const suffix = serverId ? `?serverid=${encodeURIComponent(serverId)}` : '';
    await openStage(driver, `/login${suffix}`);
    try {
        await driver.wait(until.urlContains('/login'), 15000);
    } catch {
        // fall through to visibility wait
    }
    await waitForVisible(driver, By.css('#loginPage'));
}

async function waitForVisible(driver, locator, timeout = 30000) {
    const element = await driver.wait(until.elementLocated(locator), timeout);
    await driver.wait(until.elementIsVisible(element), timeout);
    return element;
}

async function clickVisible(driver, locator, timeout = 30000) {
    const element = await waitForVisible(driver, locator, timeout);
    await element.click();
    return element;
}

async function fillVisible(driver, locator, value, timeout = 30000) {
    const element = await waitForVisible(driver, locator, timeout);
    await driver.executeScript((target, nextValue) => {
        const input = target;
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
            || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');

        if (descriptor?.set) {
            descriptor.set.call(input, nextValue);
        } else {
            input.value = nextValue;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, element, value);
    return element;
}

async function selectVisibleOption(driver, locator, preferredValues = [], timeout = 30000) {
    const element = await waitForVisible(driver, locator, timeout);
    const options = await element.findElements(By.css('option'));
    const normalized = preferredValues.map(option => String(option).toLowerCase());

    for (const preferred of normalized) {
        for (const option of options) {
            const value = String(await option.getAttribute('value') || '').toLowerCase();
            const text = String(await option.getText() || '').trim().toLowerCase();
            if (value === preferred || text.includes(preferred)) {
                await option.click();
                return;
            }
        }
    }

    if (options[0]) {
        await options[0].click();
        return;
    }

    throw new Error('No selectable option found.');
}

async function isStageClean() {
    const info = await stagePublicInfo();
    return info.StartupWizardCompleted === false;
}

module.exports = {
    By,
    ROOT_URL,
    clickVisible,
    createDriver,
    fillVisible,
    isStageClean,
    openLogin,
    openStage,
    navigateSpa,
    seedStageConnection,
    stagePublicInfo,
    stageUrl,
    selectVisibleOption,
    completeWizardSetup,
    waitForVisible,
    until
};
