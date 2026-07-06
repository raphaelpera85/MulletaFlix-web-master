import { chromium } from '@playwright/test';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
    });

    page.on('request', req => {
        // Log API requests
        if (req.url().includes('/Users') || req.url().includes('/Devices') || req.url().includes('/Activity') || req.url().includes('/System')) {
            console.log(`[REQUEST] ${req.method()} ${req.url()}`);
        }
    });

    page.on('response', res => {
        if (res.url().includes('/Users') || res.url().includes('/Devices') || res.url().includes('/Activity') || res.url().includes('/System')) {
            console.log(`[RESPONSE] ${res.status()} ${res.url()}`);
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

        console.log('Logged in. Waiting for devices page to render...');
        await page.waitForTimeout(5000);
        
        console.log('Checking DOM on devices page...');
        const devicesPageHtml = await page.locator('#devicesPage').innerHTML().catch(e => `Error: ${e.message}`);
        console.log('Devices Page Inner HTML Length:', devicesPageHtml.length);
        console.log('Has table element:', devicesPageHtml.includes('<table') || devicesPageHtml.includes('role="table"'));
        
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
        
        console.log('Taking screenshot...');
        await page.screenshot({ path: 'scratch_devices.png' });

        console.log('Navigating to activity...');
        await page.goto('http://127.0.0.1:8096/web/#/dashboard/activity');
        await page.waitForTimeout(5000);

        console.log('Checking DOM on activity page...');
        const activityPageHtml = await page.locator('#serverActivityPage').innerHTML().catch(e => `Error: ${e.message}`);
        console.log('Activity Page Inner HTML Length:', activityPageHtml.length);
        console.log('Has table element:', activityPageHtml.includes('<table') || activityPageHtml.includes('role="table"'));
        
        console.log('Taking screenshot...');
        await page.screenshot({ path: 'scratch_activity.png' });

    } catch (e) {
        console.error('Error during test execution:', e);
    } finally {
        await browser.close();
    }
})();
