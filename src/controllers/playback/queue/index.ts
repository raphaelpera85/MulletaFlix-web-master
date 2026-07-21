import RemoteControl from '../../../components/remotecontrol/remotecontrol';
import { playbackManager } from '../../../components/playback/playbackmanager';
import { clearBackdrop } from '../../../components/backdrop/backdrop';
import libraryMenu from '../../../scripts/libraryMenu';
import '../../../elements/emby-button/emby-button';
import '../../../elements/emby-button/paper-icon-button-light';
import '../../../elements/emby-collapse/emby-collapse';
import '../../../elements/emby-input/emby-input';
import '../../../elements/emby-itemscontainer/emby-itemscontainer';
import '../../../elements/emby-slider/emby-slider';

export default function (view: HTMLElement) {
    const remoteControl = new RemoteControl();
    remoteControl.init(view, view.querySelector('.remoteControlContent'));

    let currentPlayer: any;

    function onKeyDown(e: KeyboardEvent) {
        if (e.keyCode === 32 && (e.target as HTMLElement).tagName !== 'BUTTON') {
            playbackManager.playPause(currentPlayer);
            e.preventDefault();
            e.stopPropagation();
        }
    }

    function releaseCurrentPlayer() {
        const player = currentPlayer;
        if (player) currentPlayer = null;
    }

    function bindToPlayer(player: any) {
        if (player !== currentPlayer) {
            releaseCurrentPlayer();
            currentPlayer = player;
        }
    }

    view.addEventListener('viewshow', function () {
        libraryMenu.setTransparentMenu(true);
        bindToPlayer(playbackManager.getCurrentPlayer());
        document.addEventListener('keydown', onKeyDown);

        clearBackdrop();

        if (remoteControl) {
            remoteControl.onShow();
        }
    });

    view.addEventListener('viewbeforehide', function () {
        libraryMenu.setTransparentMenu(false);
        document.removeEventListener('keydown', onKeyDown);
        releaseCurrentPlayer();

        if (remoteControl) {
            remoteControl.destroy();
        }
    });
}
