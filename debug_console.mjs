import { chromium } from '@playwright/test';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
    });

    page.on('request', req => {
        const url = req.url();
        if (url.includes('8096') && !url.includes('/web/')) {
            console.log(`[REQUEST] ${req.method()} ${url}`);
        }
    });

    page.on('response', res => {
        const url = res.url();
        if (url.includes('8096') && !url.includes('/web/')) {
            console.log(`[RESPONSE] ${res.status()} ${url}`);
        }
    });

    page.on('pageerror', err => {
        console.error('[BROWSER PAGE ERROR]', err.stack || err);
    });

    try {
        console.log('Navigating to login page...');
        await page.goto('http://127.0.0.1:8096/web/#/dashboard/devices');

        // Check if Connect anyway dialog is shown
        await page.waitForTimeout(2000);
        const connectAnyway = page.locator('button:has-text("Conectar Mesmo Assim")').first();
        if (await connectAnyway.isVisible().catch(() => false)) {
            await connectAnyway.click();
        }

        // Wait for login page
        await page.waitForTimeout(2000);
        
        // Fill manual login if visible
        const manualBtn = page.locator('.btnManual').first();
        if (await manualBtn.isVisible().catch(() => false)) {
            await manualBtn.click();
        }

        await page.locator('#txtManualName').first().fill('Raphael');
        await page.locator('#txtManualPassword').first().fill('Bug309c*');
        await page.locator('button[type="submit"]').first().click();

        console.log('Logged in. Navigating to home page...');
        await page.goto('http://127.0.0.1:8096/web/#/home');
        await page.waitForTimeout(5000);
        
        console.log('Checking DOM on home page...');
        const homePageHtml = await page.content().catch(e => `Error: ${e.message}`);
        console.log('Home Page Inner HTML Length:', homePageHtml.length);
        console.log('Has library section:', homePageHtml.includes('section'));
        
        // Layout measurements
        const measurements = await page.evaluate(() => {
            const pageEl = document.querySelector('#devicesPage');
            const primaryEl = pageEl?.querySelector('.content-primary');
            const tableEl = pageEl?.querySelector('.MuiTableContainer-root') || pageEl?.querySelector('.MuiPaper-root');
            const skinBodyEl = document.querySelector('.skinBody');
            const mainEl = document.querySelector('main');
            const bodyEl = document.body;
            
            const getInfo = (el, name) => {
                if (!el) return `${name} not found`;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return {
                    name,
                    tagName: el.tagName,
                    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    display: style.display,
                    position: style.position,
                    top: style.top,
                    bottom: style.bottom,
                    left: style.left,
                    right: style.right,
                    visibility: style.visibility,
                    opacity: style.opacity,
                    height: style.height,
                    maxHeight: style.maxHeight,
                    overflow: style.overflow
                };
            };
            
            return {
                body: getInfo(bodyEl, 'body'),
                main: getInfo(mainEl, 'main'),
                skinBody: getInfo(skinBodyEl, 'skinBody'),
                page: getInfo(pageEl, 'devicesPage'),
                primary: getInfo(primaryEl, 'content-primary'),
                table: getInfo(tableEl, 'table')
            };
        });
        
        console.log('DOM Measurements:', JSON.stringify(measurements, null, 2));
        
        console.log('Taking screenshot of devices...');
        await page.screenshot({ path: 'scratch_devices.png' });

        console.log('Navigating to search page via window.location.hash...');
        await page.evaluate(() => { window.location.hash = '#/search'; });
        await page.waitForTimeout(5000);
        console.log('Current URL after hash change:', page.url());

        console.log('Locating search input...');
        const searchInput = page.locator('#searchTextInput, input[type="search"], .searchfields-txtSearch').first();
        if (await searchInput.isVisible().catch(() => false)) {
            console.log('Search input found. Typing query "a"...');
            await searchInput.fill('a');
            await page.waitForTimeout(5000);
            
            console.log('Taking search page screenshot...');
            await page.screenshot({ path: 'scratch_search.png' });
            
            console.log('Checking search results DOM...');
            const searchHtml = await page.content();
            console.log('Search Page Content Length:', searchHtml.length);
        } else {
            console.error('Search input NOT found! Current page body text:', await page.locator('body').innerText().catch(() => 'no body'));
            await page.screenshot({ path: 'scratch_search_not_found.png' });
        }
    } catch (e) {
        console.error('Error during test execution:', e);
    } finally {
        await browser.close();
    }
})();
