import { AppFeature } from 'constants/appFeature';
import Events from '../../utils/events.ts';
import browser from '../../scripts/browser';
import loading from '../loading/loading';
import { playbackManager } from '../playback/playbackmanager';
import { pluginManager } from '../pluginManager';
import { appRouter } from '../router/appRouter';
import globalize from '../../lib/globalize';
import { appHost } from '../apphost';
import { enable, isEnabled } from '../../scripts/autocast';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-button/emby-button';
import dialog from '../dialog/dialog';
import dialogHelper from '../dialogHelper/dialogHelper';
import type { PlayTarget } from 'types/playTarget';

interface MenuItem {
    name: string;
    id: string;
    selected: boolean;
    secondaryText?: string;
    icon: string;
}

interface ActionSheetOptions {
    title: string;
    items: MenuItem[];
    positionTo: HTMLElement;
    resolveOnClick: boolean;
    border: boolean;
    enableHistory?: boolean;
    text?: string;
}

interface PlayerInfo extends PlayTarget {
    deviceName?: string;
}

function getTargetSecondaryText(target: PlayTarget): string | undefined {
    return target.user?.Name ?? undefined;
}

function getIcon(target: PlayTarget): string {
    let deviceType = target.deviceType;

    if (!deviceType && target.isLocalPlayer) {
        if (browser.tv) {
            deviceType = 'tv';
        } else if (browser.mobile) {
            deviceType = 'smartphone';
        } else {
            deviceType = 'desktop';
        }
    }

    if (!deviceType) {
        deviceType = 'tv';
    }

    switch (deviceType) {
        case 'smartphone':
            return 'smartphone';
        case 'tablet':
            return 'tablet';
        case 'tv':
            return 'tv';
        case 'cast':
            return 'cast';
        case 'desktop':
            return 'computer';
        default:
            return 'tv';
    }
}

export function show(button: HTMLElement): void {
    const currentPlayerInfo = playbackManager.getPlayerInfo() as PlayerInfo | null;

    if (currentPlayerInfo && !currentPlayerInfo.isLocalPlayer) {
        showActivePlayerMenu(currentPlayerInfo);
        return;
    }

    const currentPlayerId = currentPlayerInfo ? currentPlayerInfo.id : null;

    loading.show();

    playbackManager.getTargets().then((targets: PlayTarget[]) => {
        const menuItems: MenuItem[] = targets.map((target) => {
            let name = target.name;

            if (target.appName && target.appName !== target.name) {
                name += ' - ' + target.appName;
            }

            return {
                name,
                id: target.id,
                selected: currentPlayerId === target.id,
                secondaryText: getTargetSecondaryText(target),
                icon: getIcon(target)
            };
        });

        import('../actionSheet/actionSheet').then((actionsheet) => {
            loading.hide();

            const menuOptions: ActionSheetOptions = {
                title: globalize.translate('HeaderPlayOn'),
                items: menuItems,
                positionTo: button,
                resolveOnClick: true,
                border: true
            };

            if (!(!browser.chrome && !browser.edgeChromium || appHost.supports(AppFeature.CastMenuHashChange))) {
                menuOptions.enableHistory = false;
            }

            const isChromecastPluginLoaded = !!pluginManager.plugins.find(plugin => plugin.id === 'chromecast');
            if (!isChromecastPluginLoaded) {
                menuOptions.text = `(${globalize.translate('GoogleCastUnsupported')})`;
            }

            actionsheet.show(menuOptions).then((id: unknown) => {
                const target = targets.filter((targetItem) => {
                    return targetItem.id === String(id);
                })[0];

                if (!target || !target.playerName) {
                    return;
                }

                playbackManager.trySetActivePlayer(target.playerName, target);
            }).catch(() => {
                // action sheet closed
            });
        }).catch((err: any) => {
            console.error('[playerSelectionMenu] failed to import action sheet', err);
        });
    }).catch((err: any) => {
        console.error('[playerSelectionMenu] failed to get playback targets', err);
    });
}

function showActivePlayerMenu(playerInfo: PlayerInfo): void {
    showActivePlayerMenuInternal(playerInfo);
}

function disconnectFromPlayer(currentDeviceName: string): void {
    if (playbackManager.getSupportedCommands().indexOf('EndSession') !== -1) {
        const menuItems = [
            {
                name: globalize.translate('Yes'),
                id: 'yes'
            },
            {
                name: globalize.translate('No'),
                id: 'no'
            }
        ];

        dialog.show({
            buttons: menuItems,
            text: globalize.translate('ConfirmEndPlayerSession', currentDeviceName)
        }).then((id: string) => {
            switch (id) {
                case 'yes':
                    playbackManager.getCurrentPlayer().endSession();
                    playbackManager.setDefaultPlayerActive();
                    break;
                case 'no':
                    playbackManager.setDefaultPlayerActive();
                    break;
                default:
                    break;
            }
        }).catch(() => {
            // dialog closed
        });
    } else {
        playbackManager.setDefaultPlayerActive();
    }
}

function showActivePlayerMenuInternal(playerInfo: PlayerInfo): void {
    let html = '';

    const dialogOptions = {
        removeOnClose: true,
        modal: false,
        entryAnimationDuration: 160,
        exitAnimationDuration: 160,
        autoFocus: false
    };

    const dlg = dialogHelper.createDialog(dialogOptions);

    dlg.classList.add('promptDialog');

    const currentDeviceName = playerInfo.deviceName || playerInfo.name;

    html += '<div class="promptDialogContent" style="padding:1.5em;">';
    html += '<h2 style="margin-top:.5em;">';
    html += currentDeviceName;
    html += '</h2>';
    html += '<div>';

    if (playerInfo.supportedCommands?.indexOf('DisplayContent') !== -1) {
        html += '<label class="checkboxContainer">';
        const checkedHtml = playbackManager.enableDisplayMirroring() ? ' checked' : '';
        html += '<input type="checkbox" is="emby-checkbox" class="chkMirror"' + checkedHtml + '/>';
        html += '<span>' + globalize.translate('EnableDisplayMirroring') + '</span>';
        html += '</label>';
    }

    html += '</div>';
    html += '<div><label class="checkboxContainer">';
    const checkedHtmlAC = isEnabled() ? ' checked' : '';
    html += '<input type="checkbox" is="emby-checkbox" class="chkAutoCast"' + checkedHtmlAC + '/>';
    html += '<span>' + globalize.translate('EnableAutoCast') + '</span>';
    html += '</label></div>';
    html += '<div style="margin-top:1em;display:flex;justify-content: flex-end;">';
    html += '<button is="emby-button" type="button" class="button-flat btnRemoteControl promptDialogButton">' + globalize.translate('HeaderRemoteControl') + '</button>';
    html += '<button is="emby-button" type="button" class="button-flat btnDisconnect promptDialogButton ">' + globalize.translate('Disconnect') + '</button>';
    html += '<button is="emby-button" type="button" class="button-flat btnCancel promptDialogButton">' + globalize.translate('ButtonCancel') + '</button>';
    html += '</div>';
    html += '</div>';

    dlg.innerHTML = html;

    const chkMirror = dlg.querySelector<HTMLInputElement>('.chkMirror');
    if (chkMirror) {
        chkMirror.addEventListener('change', onMirrorChange);
    }

    const chkAutoCast = dlg.querySelector<HTMLInputElement>('.chkAutoCast');
    if (chkAutoCast) {
        chkAutoCast.addEventListener('change', onAutoCastChange);
    }

    let destination = '';

    const btnRemoteControl = dlg.querySelector<HTMLButtonElement>('.btnRemoteControl');
    if (btnRemoteControl) {
        btnRemoteControl.addEventListener('click', () => {
            destination = 'nowplaying';
            dialogHelper.close(dlg);
        });
    }

    const btnDisconnect = dlg.querySelector<HTMLButtonElement>('.btnDisconnect');
    if (btnDisconnect) {
        btnDisconnect.addEventListener('click', () => {
            destination = 'disconnectFromPlayer';
            dialogHelper.close(dlg);
        });
    }

    const btnCancel = dlg.querySelector<HTMLButtonElement>('.btnCancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            dialogHelper.close(dlg);
        });
    }

    dialogHelper.open(dlg).then(() => {
        if (destination === 'nowplaying') {
            return appRouter.showNowPlaying();
        }

        if (destination === 'disconnectFromPlayer') {
            disconnectFromPlayer(currentDeviceName);
        }
    }).catch(() => {
        // dialog closed
    });
}

function onMirrorChange(this: HTMLInputElement): void {
    playbackManager.enableDisplayMirroring(this.checked);
}

function onAutoCastChange(this: HTMLInputElement): void {
    enable(this.checked);
}

Events.on(playbackManager, 'pairing', () => {
    loading.show();
});

Events.on(playbackManager, 'paired', () => {
    loading.hide();
});

Events.on(playbackManager, 'pairerror', () => {
    loading.hide();
});

export default {
    show
};
