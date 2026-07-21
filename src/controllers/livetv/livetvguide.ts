import Guide from '../../components/guide/guide';

declare const ApiClient: {
    serverId(): string;
};

interface LiveTvGuideController {
    renderTab: () => void;
    onShow: () => void;
    onHide: () => void;
}

export default function (this: LiveTvGuideController, view: HTMLElement, params: Record<string, string>, tabContent: HTMLElement): void {
    let guideInstance: any;
    const self = this;
    const GuideCtor = Guide as any;

    self.renderTab = function (): void {
        if (!guideInstance) {
            guideInstance = new GuideCtor({
                element: tabContent,
                serverId: ApiClient.serverId()
            });
        }
    };

    self.onShow = function (): void {
        if (guideInstance) {
            guideInstance.resume();
        }
    };

    self.onHide = function (): void {
        if (guideInstance) {
            guideInstance.pause();
        }
    };
}
