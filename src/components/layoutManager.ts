import { LayoutMode } from 'constants/layoutMode';

import { appHost } from './apphost';
import browser from '../scripts/browser';
import appSettings from '../scripts/settings/appSettings';
import Events from '../utils/events.ts';

type LayoutFlag = 'tv' | 'mobile' | 'desktop';

function setLayout(instance: LayoutManager, layout: LayoutFlag, selectedLayout: string): void {
    const isSelected = layout === selectedLayout;

    if (layout === 'tv') {
        instance.tv = isSelected;
    } else if (layout === 'mobile') {
        instance.mobile = isSelected;
    } else {
        instance.desktop = isSelected;
    }

    document.documentElement.classList.toggle('layout-' + layout, isSelected);
}

export const SETTING_KEY = 'layout';

class LayoutManager {
    tv = false;
    mobile = false;
    desktop = false;
    experimental = false;
    defaultLayout: string | undefined;

    get layout(): LayoutMode {
        if (this.tv) return LayoutMode.Tv;
        if (this.experimental) return LayoutMode.Experimental;
        if (this.mobile) return LayoutMode.Mobile;
        if (this.desktop) return LayoutMode.Desktop;
        return LayoutMode.Experimental;
    }

    setLayout(layout = '', save = true): void {
        const layoutValue = !layout || layout === LayoutMode.Auto ? '' : layout;

        if (!layoutValue) {
            this.autoLayout();
        } else {
            setLayout(this, 'mobile', layoutValue);
            setLayout(this, 'tv', layoutValue);
            setLayout(this, 'desktop', layoutValue);
        }

        console.debug('[LayoutManager] using layout mode', layoutValue);
        this.experimental = layoutValue === LayoutMode.Experimental;

        if (this.experimental) {
            const legacyLayoutMode = browser.mobile ? LayoutMode.Mobile : LayoutMode.Desktop;
            console.debug('[LayoutManager] using legacy layout mode', legacyLayoutMode);
            setLayout(this, browser.mobile ? 'mobile' : 'desktop', legacyLayoutMode);
        }

        if (save) appSettings.set(SETTING_KEY, layoutValue);

        Events.trigger(this, 'modechange');
    }

    getSavedLayout(): string | null {
        return appSettings.get(SETTING_KEY);
    }

    autoLayout(): void {
        // Take a guess at initial layout. The consuming app can override.
        // NOTE: The fallback to TV mode seems like an outdated choice. TVs should be detected properly or override the
        // default layout.
        this.setLayout(browser.tv ? LayoutMode.Tv : this.defaultLayout || LayoutMode.Tv, false);
    }

    init(): void {
        const saved = this.getSavedLayout();

        if (saved) {
            this.setLayout(saved, false);
        } else {
            this.autoLayout();
        }
    }
}

const layoutManager = new LayoutManager();

if (appHost.getDefaultLayout) {
    layoutManager.defaultLayout = appHost.getDefaultLayout();
}

layoutManager.init();

export default layoutManager;
