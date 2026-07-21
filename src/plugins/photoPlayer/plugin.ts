import { ServerConnections } from 'lib/jellyfin-apiclient';
import * as userSettings from '../../scripts/settings/userSettings';
import { PluginType } from 'types/plugin.ts';

interface PlayOptions {
    items: any[];
    startIndex?: number;
}

interface PhotoApiClient {
    getCurrentUser(): Promise<any>;
}

interface PhotoSlideshowInstance {
    show(): void;
}

interface PhotoSlideshowOptions {
    showTitle: boolean;
    cover: boolean;
    items: any[];
    startIndex: number;
    interval: number;
    interactive: boolean;
    autoplay: {
        delay: number;
    };
    user: any;
}

export default class PhotoPlayer {
    name: string;
    type: PluginType;
    id: string;
    priority: number;

    constructor() {
        this.name = 'Photo Player';
        this.type = PluginType.MediaPlayer;
        this.id = 'photoplayer';
        this.priority = 1;
    }

    play(options: PlayOptions): Promise<void> {
        return new Promise<void>(function (resolve) {
            import('../../components/slideshow/slideshow').then(({ default: Slideshow }) => {
                const index = options.startIndex || 0;

                const apiClient = ServerConnections.currentApiClient() as PhotoApiClient | undefined;
                if (!apiClient) {
                    resolve();
                    return;
                }

                apiClient.getCurrentUser().then(function(result: any) {
                    const slideshowCtor = Slideshow as any as new (options: PhotoSlideshowOptions) => PhotoSlideshowInstance;
                    const newSlideShow = new slideshowCtor({
                        showTitle: false,
                        cover: false,
                        items: options.items,
                        startIndex: index,
                        interval: 11000,
                        interactive: true,
                        // playbackManager.shuffle has no options. So treat 'shuffle' as a 'play' action
                        autoplay: {
                            delay: userSettings.slideshowInterval() * 1000
                        },
                        user: result
                    });

                    newSlideShow.show();
                    resolve();
                });
            });
        });
    }

    canPlayMediaType(mediaType: string): boolean {
        return (mediaType || '').toLowerCase() === 'photo';
    }
}
