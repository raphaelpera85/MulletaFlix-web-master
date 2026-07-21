import { AppFeature } from 'constants/appFeature';
import browser from '../../scripts/browser';
import { appHost } from '../apphost';
import loading from '../loading/loading';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import dom from '../../utils/dom';
import './multiSelect.scss';
import alert from '../alert';
import confirm from '../confirm/confirm';
import itemHelper from '../itemHelper';

interface MultiSelectOptions {
    container: HTMLElement;
    bindOnClick?: boolean;
}

type SelectionCommandId =
    | 'selectall'
    | 'addtocollection'
    | 'playlist'
    | 'delete'
    | 'groupvideos'
    | 'markplayed'
    | 'markunplayed'
    | 'refresh';

interface SelectionMenuItem {
    name: string;
    id: SelectionCommandId;
    icon: string;
}

interface RefreshableElement extends HTMLElement {
    notifyRefreshNeeded(refresh: boolean): void;
}

let selectedItems: string[] = [];
let selectedElements: HTMLElement[] = [];
let currentSelectionCommandsPanel: HTMLElement | null = null;

function hideSelections(): void {
    const selectionCommandsPanel = currentSelectionCommandsPanel;

    if (!selectionCommandsPanel) {
        return;
    }

    selectionCommandsPanel.parentNode?.removeChild(selectionCommandsPanel);
    currentSelectionCommandsPanel = null;

    selectedItems = [];
    selectedElements = [];

    const elems = document.querySelectorAll<HTMLElement>('.itemSelectionPanel');
    for (let i = 0, length = elems.length; i < length; i++) {
        const parent = elems[i].parentElement;

        if (parent) {
            parent.removeChild(elems[i]);
            parent.classList.remove('withMultiSelect');
        }
    }
}

function onItemSelectionPanelClick(e: Event, itemSelectionPanel: HTMLElement): false {
    // toggle the checkbox, if it wasn't clicked on
    const target = e.target as HTMLElement | null;
    if (target && !dom.parentWithClass(target, 'chkItemSelect')) {
        const chkItemSelect = itemSelectionPanel.querySelector<HTMLInputElement>('.chkItemSelect');

        if (chkItemSelect) {
            if (chkItemSelect.classList.contains('checkedInitial')) {
                chkItemSelect.classList.remove('checkedInitial');
            } else {
                const newValue = !chkItemSelect.checked;
                chkItemSelect.checked = newValue;
                updateItemSelection(chkItemSelect, newValue);
            }
        }
    }

    e.preventDefault();
    e.stopPropagation();
    return false;
}

function updateItemSelection(chkItemSelect: HTMLElement, selected: boolean): void {
    const itemRoot = dom.parentWithAttribute(chkItemSelect, 'data-id') as HTMLElement | null;
    const id = itemRoot?.getAttribute('data-id');

    if (!id) {
        return;
    }

    if (selected) {
        const current = selectedItems.filter((i: string) => {
            return i === id;
        });

        if (!current.length) {
            selectedItems.push(id);
            selectedElements.push(chkItemSelect);
        }
    } else {
        selectedItems = selectedItems.filter((i: string) => {
            return i !== id;
        });
        selectedElements = selectedElements.filter((i: HTMLElement) => {
            return i !== chkItemSelect;
        });
    }

    if (selectedItems.length) {
        const itemSelectionCount = document.querySelector<HTMLElement>('.itemSelectionCount');
        if (itemSelectionCount) {
            itemSelectionCount.innerHTML = selectedItems.length.toLocaleString();
        }
    } else {
        hideSelections();
    }
}

function onSelectionChange(this: HTMLInputElement): void {
    updateItemSelection(this, this.checked);
}

function showSelection(item: HTMLElement, isChecked: boolean, addInitialCheck: boolean): void {
    let itemSelectionPanel = item.querySelector<HTMLElement>('.itemSelectionPanel');

    if (!itemSelectionPanel) {
        itemSelectionPanel = document.createElement('div');
        itemSelectionPanel.classList.add('itemSelectionPanel');

        const parent = item.querySelector<HTMLElement>('.cardBox') || item.querySelector<HTMLElement>('.cardContent');
        if (!parent) {
            return;
        }

        parent.classList.add('withMultiSelect');
        parent.appendChild(itemSelectionPanel);

        let cssClass = 'chkItemSelect';
        if (isChecked && addInitialCheck) {
            cssClass += ' checkedInitial';
        }

        const checkedAttribute = isChecked ? ' checked' : '';
        itemSelectionPanel.innerHTML = `<label class="checkboxContainer"><input type="checkbox" is="emby-checkbox" data-outlineclass="multiSelectCheckboxOutline" class="${cssClass}"${checkedAttribute}/><span></span></label>`;
        const chkItemSelect = itemSelectionPanel.querySelector<HTMLInputElement>('.chkItemSelect');

        if (chkItemSelect) {
            chkItemSelect.addEventListener('change', onSelectionChange);
        }
    }
}

function showSelectionCommands(): void {
    let selectionCommandsPanel = currentSelectionCommandsPanel;

    if (!selectionCommandsPanel) {
        selectionCommandsPanel = document.createElement('div');
        selectionCommandsPanel.classList.add('selectionCommandsPanel');

        document.body.appendChild(selectionCommandsPanel);
        currentSelectionCommandsPanel = selectionCommandsPanel;

        let html = '';
        html += '<button is="paper-icon-button-light" class="btnCloseSelectionPanel autoSize"><span class="material-icons close" aria-hidden="true"></span></button>';
        html += '<h1 class="itemSelectionCount"></h1>';

        const moreIcon = 'more_vert';
        html += `<button is="paper-icon-button-light" class="btnSelectionPanelOptions autoSize"><span class="material-icons ${moreIcon}" aria-hidden="true"></span></button>`;

        selectionCommandsPanel.innerHTML = html;

        const btnCloseSelectionPanel = selectionCommandsPanel.querySelector<HTMLElement>('.btnCloseSelectionPanel');
        if (btnCloseSelectionPanel) {
            btnCloseSelectionPanel.addEventListener('click', hideSelections);
        }

        const btnSelectionPanelOptions = selectionCommandsPanel.querySelector<HTMLElement>('.btnSelectionPanelOptions');
        if (btnSelectionPanelOptions) {
            dom.addEventListener(btnSelectionPanelOptions, 'click', showMenuForSelectedItems, { passive: true });
        }
    }
}

function alertText(options: string | { text: string }): Promise<void> {
    return new Promise((resolve) => {
        alert(options).then(resolve, resolve);
    });
}

function deleteItems(apiClient: any, itemIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        let msg = globalize.translate('ConfirmDeleteItem');
        let title = globalize.translate('HeaderDeleteItem');

        if (itemIds.length > 1) {
            msg = globalize.translate('ConfirmDeleteItems');
            title = globalize.translate('HeaderDeleteItems');
        }

        confirm(msg, title).then(() => {
            const promises = itemIds.map((itemId) => apiClient.deleteItem(itemId));

            Promise.all(promises).then(() => {
                resolve();
            }, () => {
                alertText(globalize.translate('ErrorDeletingItem')).then(reject, reject);
            });
        }, reject);
    });
}

function showMenuForSelectedItems(e: Event): void {
    const apiClient: any = ServerConnections.currentApiClient();

    apiClient.getCurrentUser().then((user: any) => {
        // get first selected item to perform metadata refresh permission check
        apiClient.getItem(apiClient.getCurrentUserId(), selectedItems[0]).then((firstItem: any) => {
            const menuItems: SelectionMenuItem[] = [];

            menuItems.push({
                name: globalize.translate('SelectAll'),
                id: 'selectall',
                icon: 'select_all'
            });

            menuItems.push({
                name: globalize.translate('AddToCollection'),
                id: 'addtocollection',
                icon: 'add'
            });

            menuItems.push({
                name: globalize.translate('AddToPlaylist'),
                id: 'playlist',
                icon: 'playlist_add'
            });

            // TODO: Be more dynamic based on what is selected
            if (user.Policy.EnableContentDeletion) {
                menuItems.push({
                    name: globalize.translate('Delete'),
                    id: 'delete',
                    icon: 'delete'
                });
            }

            if (user.Policy.EnableContentDownloading && appHost.supports(AppFeature.FileDownload)) {
                // Disabled because there is no callback for this item
            }

            if (user.Policy.IsAdministrator) {
                menuItems.push({
                    name: globalize.translate('GroupVersions'),
                    id: 'groupvideos',
                    icon: 'call_merge'
                });
            }

            menuItems.push({
                name: globalize.translate('MarkPlayed'),
                id: 'markplayed',
                icon: 'check_box'
            });

            menuItems.push({
                name: globalize.translate('MarkUnplayed'),
                id: 'markunplayed',
                icon: 'check_box_outline_blank'
            });

            // this assures that if the user can refresh metadata for the first item
            // they can refresh metadata for all items
            if (itemHelper.canRefreshMetadata(firstItem, user)) {
                menuItems.push({
                    name: globalize.translate('RefreshMetadata'),
                    id: 'refresh',
                    icon: 'refresh'
                });
            }

            import('../actionSheet/actionSheet').then((actionsheet: any) => {
                actionsheet.show({
                    items: menuItems,
                    positionTo: e.target as HTMLElement,
                    callback: function (id: string): void {
                        const items = selectedItems.slice(0);
                        const serverId = apiClient.serverInfo().Id;

                        switch (id) {
                            case 'selectall':
                                {
                                    const elems = document.querySelectorAll<HTMLElement>('.itemSelectionPanel');
                                    for (let i = 0, length = elems.length; i < length; i++) {
                                        const chkItemSelect = elems[i].querySelector<HTMLInputElement>('.chkItemSelect');

                                        if (chkItemSelect && !chkItemSelect.classList.contains('checkedInitial') && !chkItemSelect.checked && chkItemSelect.getBoundingClientRect().width !== 0) {
                                            chkItemSelect.checked = true;
                                            updateItemSelection(chkItemSelect, true);
                                        }
                                    }
                                }
                                break;
                            case 'addtocollection':
                                import('../collectionEditor/collectionEditor').then(({ default: CollectionEditor }: any) => {
                                    const collectionEditor = new CollectionEditor();
                                    collectionEditor.show({
                                        items: items,
                                        serverId: serverId
                                    });
                                });
                                hideSelections();
                                dispatchNeedsRefresh();
                                break;
                            case 'playlist':
                                import('../playlisteditor/playlisteditor').then(({ default: PlaylistEditor }: any) => {
                                    const playlistEditor = new PlaylistEditor();
                                    playlistEditor.show({
                                        items: items,
                                        serverId: serverId
                                    }).catch(() => {
                                        // Dialog closed
                                    });
                                }).catch((err: any) => {
                                    console.error('[AddToPlaylist] failed to load playlist editor', err);
                                });
                                hideSelections();
                                dispatchNeedsRefresh();
                                break;
                            case 'delete':
                                deleteItems(apiClient, items).then(dispatchNeedsRefresh);
                                hideSelections();
                                dispatchNeedsRefresh();
                                break;
                            case 'groupvideos':
                                combineVersions(apiClient, items);
                                break;
                            case 'markplayed':
                                items.forEach((itemId: string) => {
                                    apiClient.markPlayed(apiClient.getCurrentUserId(), itemId);
                                });
                                hideSelections();
                                dispatchNeedsRefresh();
                                break;
                            case 'markunplayed':
                                items.forEach((itemId: string) => {
                                    apiClient.markUnplayed(apiClient.getCurrentUserId(), itemId);
                                });
                                hideSelections();
                                dispatchNeedsRefresh();
                                break;
                            case 'refresh':
                                import('../refreshdialog/refreshdialog').then(({ default: RefreshDialog }: any) => {
                                    new RefreshDialog({
                                        itemIds: items,
                                        serverId: serverId
                                    }).show();
                                });
                                hideSelections();
                                dispatchNeedsRefresh();
                                break;
                            default:
                                break;
                        }
                    }
                });
            });
        });
    });
}

function dispatchNeedsRefresh(): void {
    const elems: RefreshableElement[] = [];

    for (const element of selectedElements) {
        const container = dom.parentWithAttribute(element, 'is', 'emby-itemscontainer') as RefreshableElement | null;

        if (container && !elems.includes(container)) {
            elems.push(container);
        }
    }

    for (let i = 0, length = elems.length; i < length; i++) {
        elems[i].notifyRefreshNeeded(true);
    }
}

function combineVersions(apiClient: any, selection: string[]): void {
    if (selection.length < 2) {
        alert({
            text: globalize.translate('PleaseSelectTwoItems')
        });

        return;
    }

    loading.show();

    apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl('Videos/MergeVersions', { Ids: selection.join(',') })
    }).then(() => {
        loading.hide();
        hideSelections();
        dispatchNeedsRefresh();
    });
}

function showSelections(initialCard: HTMLElement, addInitialCheck: boolean): void {
    import('../../elements/emby-checkbox/emby-checkbox').then(() => {
        const cards = document.querySelectorAll<HTMLElement>('.card');
        for (let i = 0, length = cards.length; i < length; i++) {
            showSelection(cards[i], initialCard === cards[i], addInitialCheck);
        }

        showSelectionCommands();
        updateItemSelection(initialCard, true);
    });
}

function onContainerClick(e: Event): false | void {
    const target = e.target as HTMLElement | null;

    if (selectedItems.length && target) {
        const card = dom.parentWithClass(target, 'card') as HTMLElement | null;
        if (card) {
            const itemSelectionPanel = card.querySelector<HTMLElement>('.itemSelectionPanel');
            if (itemSelectionPanel) {
                return onItemSelectionPanelClick(e, itemSelectionPanel);
            }
        }

        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

document.addEventListener('viewbeforehide', hideSelections);

class MultiSelect {
    public onContainerClick: (e: Event) => false | void;
    public destroy: () => void;

    constructor(options: MultiSelectOptions) {
        const container = options.container;

        function onTapHold(e: Event): false {
            const card = dom.parentWithClass(e.target as HTMLElement, 'card') as HTMLElement | null;

            if (card) {
                showSelections(card, true);
            }

            e.preventDefault();
            // It won't have this if it's a hammer event
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            return false;
        }

        function getTouches(e: TouchEvent): TouchList {
            return e.changedTouches || e.targetTouches || e.touches;
        }

        let touchTarget: HTMLElement | null = null;
        let touchStartTimeout: ReturnType<typeof setTimeout> | null = null;
        let touchStartX = 0;
        let touchStartY = 0;

        function onTouchStart(e: Event): void {
            const touch = getTouches(e as TouchEvent)[0];
            touchTarget = null;
            touchStartX = 0;
            touchStartY = 0;

            if (touch) {
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                const element = touch.target as HTMLElement | null;

                if (element) {
                    const card = dom.parentWithClass(element, 'card') as HTMLElement | null;

                    if (card) {
                        if (touchStartTimeout) {
                            clearTimeout(touchStartTimeout);
                            touchStartTimeout = null;
                        }

                        touchTarget = card;
                        touchStartTimeout = setTimeout(onTouchStartTimerFired, 550);
                    }
                }
            }
        }

        function onTouchMove(e: Event): void {
            if (touchTarget) {
                const touch = getTouches(e as TouchEvent)[0];
                let deltaX: number;
                let deltaY: number;

                if (touch) {
                    const touchEndX = touch.clientX || 0;
                    const touchEndY = touch.clientY || 0;
                    deltaX = Math.abs(touchEndX - (touchStartX || 0));
                    deltaY = Math.abs(touchEndY - (touchStartY || 0));
                } else {
                    deltaX = 100;
                    deltaY = 100;
                }

                if (deltaX >= 5 || deltaY >= 5) {
                    onMouseOut();
                }
            }
        }

        function onTouchEnd(): void {
            onMouseOut();
        }

        function onMouseDown(e: Event): void {
            if (touchStartTimeout) {
                clearTimeout(touchStartTimeout);
                touchStartTimeout = null;
            }

            touchTarget = e.target as HTMLElement | null;
            touchStartTimeout = setTimeout(onTouchStartTimerFired, 550);
        }

        function onMouseOut(): void {
            if (touchStartTimeout) {
                clearTimeout(touchStartTimeout);
                touchStartTimeout = null;
            }
            touchTarget = null;
        }

        function onTouchStartTimerFired(): void {
            if (!touchTarget) {
                return;
            }

            const card = dom.parentWithClass(touchTarget, 'card') as HTMLElement | null;
            touchTarget = null;

            if (card) {
                showSelections(card, true);
            }
        }

        function initTapHold(element: HTMLElement): void {
            // mobile safari doesn't allow contextmenu override
            if (browser.touch && !browser.safari) {
                element.addEventListener('contextmenu', onTapHold);
            } else {
                dom.addEventListener(element, 'touchstart', onTouchStart, {
                    passive: true
                } as AddEventListenerOptions);
                dom.addEventListener(element, 'touchmove', onTouchMove, {
                    passive: true
                } as AddEventListenerOptions);
                dom.addEventListener(element, 'touchend', onTouchEnd, {
                    passive: true
                } as AddEventListenerOptions);
                dom.addEventListener(element, 'touchcancel', onTouchEnd, {
                    passive: true
                } as AddEventListenerOptions);
                dom.addEventListener(element, 'mousedown', onMouseDown, {
                    passive: true
                } as AddEventListenerOptions);
                dom.addEventListener(element, 'mouseleave', onMouseOut, {
                    passive: true
                } as AddEventListenerOptions);
                dom.addEventListener(element, 'mouseup', onMouseOut, {
                    passive: true
                } as AddEventListenerOptions);
            }
        }

        initTapHold(container);

        if (options.bindOnClick !== false) {
            container.addEventListener('click', onContainerClick);
        }

        this.onContainerClick = onContainerClick;
        this.destroy = () => {
            container.removeEventListener('click', onContainerClick as EventListener);
            container.removeEventListener('contextmenu', onTapHold);

            const element = container;

            dom.removeEventListener(element, 'touchstart', onTouchStart as EventListener, {
                passive: true
            } as AddEventListenerOptions);
            dom.removeEventListener(element, 'touchmove', onTouchMove as EventListener, {
                passive: true
            } as AddEventListenerOptions);
            dom.removeEventListener(element, 'touchend', onTouchEnd as EventListener, {
                passive: true
            } as AddEventListenerOptions);
            dom.removeEventListener(element, 'mousedown', onMouseDown as EventListener, {
                passive: true
            } as AddEventListenerOptions);
            dom.removeEventListener(element, 'mouseleave', onMouseOut as EventListener, {
                passive: true
            } as AddEventListenerOptions);
            dom.removeEventListener(element, 'mouseup', onMouseOut as EventListener, {
                passive: true
            } as AddEventListenerOptions);
        };
    }
}

export default MultiSelect;

export const startMultiSelect = (card: HTMLElement): void => {
    showSelections(card, false);
};

export const stopMultiSelect = (): void => {
    hideSelections();
};
