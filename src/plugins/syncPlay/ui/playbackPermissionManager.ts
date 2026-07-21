import { appHost } from 'components/apphost';
import { AppFeature } from 'constants/appFeature';

function createTestMediaElement(): HTMLAudioElement {
    const elem = document.createElement('audio');
    elem.classList.add('testMediaPlayerAudio');
    elem.classList.add('hide');

    document.body.appendChild(elem);

    elem.volume = 1;
    elem.src = 'assets/audio/silence.mp3';

    return elem;
}

function destroyTestMediaElement(elem: HTMLAudioElement): void {
    elem.pause();
    elem.remove();
}

class PlaybackPermissionManager {
    check(): Promise<boolean> {
        if (appHost.supports(AppFeature.HtmlAudioAutoplay)) {
            return Promise.resolve(true);
        }

        const media = createTestMediaElement();

        return media.play()
            .then(() => true)
            .finally(() => {
                destroyTestMediaElement(media);
            });
    }
}

export default new PlaybackPermissionManager();
