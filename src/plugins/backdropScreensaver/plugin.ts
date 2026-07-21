
import { ServerConnections } from 'lib/jellyfin-apiclient';
import * as userSettings from 'scripts/settings/userSettings';
import { PluginType } from 'types/plugin.ts';

interface BackdropQuery {
    ImageTypes: string;
    EnableImageTypes: string;
    IncludeItemTypes: string;
    SortBy: string;
    Recursive: boolean;
    Fields: string;
    ImageTypeLimit: number;
    StartIndex: number;
    Limit: number;
}

interface BackdropSlideshowInstance {
    show(): void;
    hide(): void;
}

interface BackdropSlideshowOptions {
    showTitle: boolean;
    cover: boolean;
    items: any[];
    autoplay: {
        delay: number;
    };
}

interface BackdropApiClient {
    getItems(userId: string, query: BackdropQuery): Promise<{ Items: any[] }>;
    getCurrentUserId(): string;
}

class BackdropScreensaver {
    name: string;
    type: PluginType;
    id: string;
    supportsAnonymous: boolean;
    currentSlideshow: BackdropSlideshowInstance | null = null;

    constructor() {
        this.name = 'BackdropScreensaver';
        this.type = PluginType.Screensaver;
        this.id = 'backdropscreensaver';
        this.supportsAnonymous = false;
    }

    show(): void {
        const query: BackdropQuery = {
            ImageTypes: 'Backdrop',
            EnableImageTypes: 'Backdrop',
            IncludeItemTypes: 'Movie,Series,MusicArtist',
            SortBy: 'Random',
            Recursive: true,
            Fields: 'Taglines',
            ImageTypeLimit: 10,
            StartIndex: 0,
            Limit: 200
        };

        const apiClient = ServerConnections.currentApiClient() as BackdropApiClient | undefined;
        if (!apiClient) {
            return;
        }

        apiClient.getItems(apiClient.getCurrentUserId(), query).then((result) => {
            if (result.Items.length) {
                import('../../components/slideshow/slideshow').then(({ default: Slideshow }) => {
                    const slideshowCtor = Slideshow as any as new (options: BackdropSlideshowOptions) => BackdropSlideshowInstance;
                    const newSlideShow = new slideshowCtor({
                        showTitle: true,
                        cover: true,
                        items: result.Items,
                        autoplay: {
                            delay: userSettings.backdropScreensaverInterval() * 1000
                        }
                    });

                    newSlideShow.show();
                    this.currentSlideshow = newSlideShow;
                }).catch(console.error);
            }
        });
    }

    hide(): Promise<void> {
        if (this.currentSlideshow) {
            this.currentSlideshow.hide();
            this.currentSlideshow = null;
        }
        return Promise.resolve();
    }
}

export default BackdropScreensaver;
