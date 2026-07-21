import { ServerConnections } from 'lib/jellyfin-apiclient';
import dom from '../utils/dom';
import { appRouter } from './router/appRouter';
import Dashboard from '../utils/dashboard';

function onGroupedCardClick(e: MouseEvent, card: HTMLElement): void {
    const itemId = card.getAttribute('data-id');
    const serverId = card.getAttribute('data-serverid');
    const apiClient: any = ServerConnections.getApiClient(serverId!);
    const userId = apiClient.getCurrentUserId();
    const playedIndicator = card.querySelector('.playedIndicator') as HTMLElement | null;
    const playedIndicatorHtml = playedIndicator ? playedIndicator.innerHTML : null;
    const options: Record<string, any> = {
        Limit: parseInt(playedIndicatorHtml || '10', 10),
        Fields: 'PrimaryImageAspectRatio,DateCreated',
        ParentId: itemId,
        GroupItems: false
    };
    const actionableParent = dom.parentWithTag(e.target as HTMLElement, ['A', 'BUTTON', 'INPUT']);

    if (!actionableParent || actionableParent.classList.contains('cardContent')) {
        apiClient.getJSON(apiClient.getUrl('Users/' + userId + '/Items/Latest', options)).then(function (items: any[]) {
            if (items.length === 1) {
                appRouter.showItem(items[0]);
                return;
            }

            const url = 'details?id=' + itemId + '&serverId=' + serverId;
            Dashboard.navigate(url);
        });
        e.stopPropagation();
        e.preventDefault();
    }
}

export default function onItemsContainerClick(e: MouseEvent): void {
    const groupedCard = dom.parentWithClass(e.target as HTMLElement, 'groupedCard') as HTMLElement | null;

    if (groupedCard) {
        onGroupedCardClick(e, groupedCard);
    }
}
