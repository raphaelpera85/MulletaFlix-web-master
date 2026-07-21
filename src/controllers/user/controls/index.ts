import layoutManager from 'components/layoutManager';
import toast from '../../../components/toast/toast';
import globalize from '../../../lib/globalize';
import appSettings from '../../../scripts/settings/appSettings';
import Events from '../../../utils/events.ts';
import keyboardNavigation from 'scripts/keyboardNavigation';

interface UserControlsView extends HTMLElement {
    querySelector<T extends Element = Element>(selectors: string): T | null;
}

export default function (view: UserControlsView): void {
    function submit(e?: SubmitEvent): boolean {
        const gamepadCheckbox = view.querySelector<HTMLInputElement>('.chkEnableGamepad');
        const smoothScrollCheckbox = view.querySelector<HTMLInputElement>('.chkSmoothScroll');

        appSettings.enableGamepad(gamepadCheckbox?.checked ?? false);
        appSettings.enableSmoothScroll(smoothScrollCheckbox?.checked ?? false);

        toast(globalize.translate('SettingsSaved'));

        Events.trigger(view, 'saved');

        e?.preventDefault();

        return false;
    }

    view.addEventListener('viewshow', function () {
        const gamepadContainer = view.querySelector<HTMLElement>('.enableGamepadContainer');
        const smoothScrollContainer = view.querySelector<HTMLElement>('.smoothScrollContainer');
        const gamepadCheckbox = view.querySelector<HTMLInputElement>('.chkEnableGamepad');
        const smoothScrollCheckbox = view.querySelector<HTMLInputElement>('.chkSmoothScroll');
        const form = view.querySelector<HTMLFormElement>('form');
        const saveButton = view.querySelector<HTMLElement>('.btnSave');

        if (gamepadContainer) {
            gamepadContainer.classList.toggle('hide', !keyboardNavigation.canEnableGamepad());
        }

        if (smoothScrollContainer) {
            smoothScrollContainer.classList.toggle('hide', !layoutManager.tv);
        }

        if (gamepadCheckbox) {
            gamepadCheckbox.checked = appSettings.enableGamepad();
        }

        if (smoothScrollCheckbox) {
            smoothScrollCheckbox.checked = appSettings.enableSmoothScroll();
        }

        form?.addEventListener('submit', submit);
        saveButton?.classList.remove('hide');

        import('../../../components/autoFocuser').then(({ default: autoFocuser }) => {
            autoFocuser.autoFocus(view);
        });
    });
}
