import loading from 'components/loading/loading';
import { getCurrentItemId, setCurrentItemId } from 'scripts/editorsidebar';

declare const ApiClient: {
    serverInfo: () => { Id: string };
};

interface ItemClickedEventDetail {
    id: string;
}

interface ItemClickedEvent extends CustomEvent<ItemClickedEventDetail> {
    detail: ItemClickedEventDetail;
}

function reload(context: HTMLElement, itemId: string | undefined): void {
    loading.show();

    if (itemId) {
        import('../components/metadataEditor/metadataEditor').then(({ default: metadataEditor }) => {
            metadataEditor.embed(
                context.querySelector('.editPageInnerContent') as HTMLElement,
                itemId,
                ApiClient.serverInfo().Id,
            );
        });
    } else {
        context.querySelector('.editPageInnerContent')!.innerHTML = '';
        loading.hide();
    }
}

export default function (view: HTMLElement): void {
    view.addEventListener('viewshow', (() => {
        reload(view, getCurrentItemId());
    }) as EventListener);

    setCurrentItemId('');

    (view.querySelector('.libraryTree') as HTMLElement).addEventListener(
        'itemclicked',
        ((event: ItemClickedEvent) => {
            const data = event.detail;

            if (data.id != getCurrentItemId()) {
                setCurrentItemId(data.id);
                reload(view, data.id);
            }
        }) as EventListener,
    );
}
