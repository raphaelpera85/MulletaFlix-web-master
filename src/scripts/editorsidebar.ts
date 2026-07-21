import escapeHtml from 'escape-html';
// @ts-ignore
import $ from 'jquery';
import 'material-design-icons-iconfont';

import globalize from 'lib/globalize';
import Dashboard from 'utils/dashboard';
import { getParameterByName } from 'utils/url';

// Disable the naming rules since jstree requires snake_case variables
/* eslint-disable @typescript-eslint/naming-convention */
interface ItemData {
    Id?: string;
    Name?: string;
    Number?: string;
    IndexNumber?: number | null;
    Type?: string;
    IsFolder?: boolean;
    MediaType?: string;
    LockData?: boolean;
    CollectionType?: string;
    BackdropImageTags?: string[];
    ServerId?: string;
    [key: string]: any;
}

interface TreeNode {
    id?: string;
    text: string;
    state?: {
        opened?: boolean;
        selected?: boolean;
    };
    li_attr?: {
        serveritemtype?: string;
        collectiontype?: string;
        itemtype?: string;
        loadedFromServer?: boolean;
        [key: string]: any;
    };
    children?: TreeNode[];
    icon?: false;
}

interface JstreeNode {
    id: string;
    children: string[];
    li_attr: {
        itemtype?: string;
        serveritemtype?: string;
        collectiontype?: string;
        loadedFromServer?: boolean;
        [key: string]: any;
    };
    [key: string]: any;
}

declare const ApiClient: any;

function getNode(item: ItemData, folderState: string, selected: boolean): TreeNode {
    const htmlName = getNodeInnerHtml(item);
    const node: TreeNode = {
        id: item.Id,
        text: htmlName,
        state: {
            opened: item.IsFolder && folderState == 'open',
            selected: selected
        },
        li_attr: {
            serveritemtype: item.Type,
            collectiontype: item.CollectionType
        }
    };
    if (item.IsFolder) {
        node.children = [{
            text: 'Loading...',
            icon: false
        }];
        node.icon = false;
    } else {
        node.icon = false;
    }
    if (node.state?.opened) {
        node.li_attr!.loadedFromServer = true;
    }
    if (selected) {
        selectedNodeId = item.Id!;
    }
    return node;
}

function getNodeInnerHtml(item: ItemData): string {
    let name = item.Name;
    if (item.Number) {
        name = item.Number + ' - ' + name;
    }
    if (item.IndexNumber != null && item.Type != 'Season') {
        name = item.IndexNumber + ' - ' + name;
    }
    let htmlName = "<div class='editorNode'>";
    if (item.IsFolder) {
        htmlName += '<span class="material-icons metadataSidebarIcon folder" aria-hidden="true"></span>';
    } else if (item.MediaType === 'Video') {
        htmlName += '<span class="material-icons metadataSidebarIcon movie" aria-hidden="true"></span>';
    } else if (item.MediaType === 'Audio') {
        htmlName += '<span class="material-icons metadataSidebarIcon audiotrack" aria-hidden="true"></span>';
    } else if (item.Type === 'TvChannel') {
        htmlName += '<span class="material-icons metadataSidebarIcon live_tv" aria-hidden="true"></span>';
    } else if (item.MediaType === 'Photo') {
        htmlName += '<span class="material-icons metadataSidebarIcon photo" aria-hidden="true"></span>';
    } else if (item.MediaType === 'Book') {
        htmlName += '<span class="material-icons metadataSidebarIcon book" aria-hidden="true"></span>';
    }
    if (item.LockData) {
        htmlName += '<span class="material-icons metadataSidebarIcon lock" aria-hidden="true"></span>';
    }
    htmlName += escapeHtml(name!);
    htmlName += '</div>';
    return htmlName;
}

function loadChildrenOfRootNode(page: HTMLElement, scope: any, callback: (nodes: TreeNode[]) => void): void {
    ApiClient.getLiveTvChannels({
        limit: 0
    }).then(function (result: any) {
        const nodes: TreeNode[] = [];
        nodes.push({
            id: 'MediaFolders',
            text: globalize.translate('HeaderMediaFolders'),
            state: {
                opened: true
            },
            li_attr: {
                itemtype: 'mediafolders',
                loadedFromServer: true
            },
            icon: false
        });
        if (result.TotalRecordCount) {
            nodes.push({
                id: 'livetv',
                text: globalize.translate('LiveTV'),
                state: {
                    opened: false
                },
                li_attr: {
                    itemtype: 'livetv'
                },
                children: [{
                    text: 'Loading...',
                    icon: false
                }],
                icon: false
            });
        }
        callback.call(scope, nodes);
        nodesToLoad.push('MediaFolders');
    });
}

function loadLiveTvChannels(service: string, openItems: string[], callback: (nodes: TreeNode[]) => void): void {
    ApiClient.getLiveTvChannels({
        ServiceName: service,
        AddCurrentProgram: false
    }).then(function (result: any) {
        const nodes: TreeNode[] = result.Items.map(function (i: ItemData) {
            const state = openItems.indexOf(i.Id!) == -1 ? 'closed' : 'open';
            return getNode(i, state, false);
        });
        callback(nodes);
    });
}

function loadMediaFolders(page: HTMLElement, scope: any, openItems: string[], callback: (nodes: TreeNode[]) => void): void {
    ApiClient.getJSON(ApiClient.getUrl('Library/MediaFolders')).then(function (result: any) {
        const nodes: TreeNode[] = result.Items.map(function (n: ItemData) {
            const state = openItems.indexOf(n.Id!) == -1 ? 'closed' : 'open';
            return getNode(n, state, false);
        });
        callback.call(scope, nodes);
        for (let i = 0, length = nodes.length; i < length; i++) {
            if (nodes[i].state?.opened) {
                nodesToLoad.push(nodes[i].id!);
            }
        }
    });
}

function loadNode(page: HTMLElement, scope: any, node: JstreeNode, openItems: string[], selectedId: string, currentUser: any, callback: (nodes: TreeNode[]) => void): void {
    const id = node.id;
    if (id == '#') {
        loadChildrenOfRootNode(page, scope, callback);
        return;
    }
    if (id == 'livetv') {
        loadLiveTvChannels(id, openItems, callback);
        return;
    }
    if (id == 'MediaFolders') {
        loadMediaFolders(page, scope, openItems, callback);
        return;
    }
    const query: Record<string, any> = {
        ParentId: id,
        Fields: 'Settings',
        IsVirtualUnaired: false,
        IsMissing: false,
        EnableTotalRecordCount: false,
        EnableImages: false,
        EnableUserData: false
    };
    const itemtype = node.li_attr.itemtype;
    if (itemtype != 'Season' && itemtype != 'Series') {
        query.SortBy = 'SortName';
    }
    ApiClient.getItems(Dashboard.getCurrentUserId(), query).then(function (result: any) {
        const nodes: TreeNode[] = result.Items.map(function (n: ItemData) {
            const state = openItems.indexOf(n.Id!) == -1 ? 'closed' : 'open';
            return getNode(n, state, n.Id == selectedId);
        });
        callback.call(scope, nodes);
        for (let i = 0, length = nodes.length; i < length; i++) {
            if (nodes[i].state?.opened) {
                nodesToLoad.push(nodes[i].id!);
            }
        }
    });
}

function scrollToNode(id: string): void {
    const elem = $('#' + id)[0];
    if (elem) {
        elem.scrollIntoView();
    }
}

function initializeTree(page: HTMLElement, currentUser: any, openItems: string[], selectedId?: string): void {
    Promise.all([
        // @ts-ignore
        import('jstree'),
        import('jstree/dist/themes/default/style.css')
    ]).then(() => {
        initializeTreeInternal(page, currentUser, openItems, selectedId);
    });
}

function onNodeSelect(this: HTMLElement, event: any, data: any): void {
    const node = data.node;
    const eventData = {
        id: node.id,
        itemType: node.li_attr.itemtype,
        serverItemType: node.li_attr.serveritemtype,
        collectionType: node.li_attr.collectiontype
    };
    if (eventData.itemType != 'livetv' && eventData.itemType != 'mediafolders') {
        {
            this.dispatchEvent(new CustomEvent('itemclicked', {
                detail: eventData,
                bubbles: true,
                cancelable: false
            }));
        }
        document.querySelector('.editPageSidebar')!.classList.add('editPageSidebar-withcontent');
    } else {
        document.querySelector('.editPageSidebar')!.classList.remove('editPageSidebar-withcontent');
    }
}

function onNodeOpen(this: HTMLElement, _: any, data: any): void {
    const page = $(this).parents('.page')[0];
    const node = data.node;
    if (node.children) {
        loadNodesToLoad(page, node);
    }
    if (node.li_attr && node.id != '#' && !node.li_attr.loadedFromServer) {
        node.li_attr.loadedFromServer = true;
        $.jstree.reference('.libraryTree', page).load_node(node.id, loadNodeCallback);
    }
}

function initializeTreeInternal(page: HTMLElement, currentUser: any, openItems: string[], selectedId?: string): void {
    nodesToLoad = [];
    selectedNodeId = null;
    $.jstree.destroy();
    $('.libraryTree', page).jstree({
        'plugins': ['wholerow'],
        core: {
            check_callback: true,
            data: function (node: any, callback: any) {
                loadNode(page, this, node, openItems, selectedId!, currentUser, callback);
            },
            themes: {
                variant: 'large'
            }
        }
    })
        .off('select_node.jstree', onNodeSelect)
        .on('select_node.jstree', onNodeSelect)
        .off('open_node.jstree', onNodeOpen)
        .on('open_node.jstree', onNodeOpen)
        .off('load_node.jstree', onNodeOpen)
        .on('load_node.jstree', onNodeOpen);
}

function loadNodesToLoad(page: HTMLElement, node: JstreeNode): void {
    const children = node.children;
    for (let i = 0, length = children.length; i < length; i++) {
        const child = children[i];
        if (nodesToLoad.indexOf(child) != -1) {
            nodesToLoad = nodesToLoad.filter(function (n) {
                return n != child;
            });
            $.jstree.reference('.libraryTree', page).load_node(child, loadNodeCallback);
        }
    }
}

function loadNodeCallback(node: JstreeNode): void {
    if (selectedNodeId && node.children && node.children.indexOf(selectedNodeId) != -1) {
        setTimeout(function () {
            scrollToNode(selectedNodeId!);
        }, 500);
    }
}

function updateEditorNode(page: HTMLElement, item: ItemData): void {
    const elem = $('#' + item.Id + '>a', page)[0];
    if (elem == null) {
        return;
    }
    $('.editorNode', elem).remove();
    $(elem).append(getNodeInnerHtml(item));
    if (item.IsFolder) {
        const tree = $.jstree._reference('.libraryTree');
        const currentNode = tree._get_node(null, false);
        tree.refresh(currentNode);
    }
}

let itemId: string | undefined;
export function setCurrentItemId(id: string): void {
    itemId = id;
}

export function getCurrentItemId(): string | undefined {
    if (itemId) {
        return itemId;
    }
    return getParameterByName('id');
}

let nodesToLoad: string[] = [];
let selectedNodeId: string | null;
$(document).on('itemsaved', '.metadataEditorPage', function (this: HTMLElement, e: any, item: ItemData) {
    updateEditorNode(this, item);
}).on('pagebeforeshow', '.metadataEditorPage', function () {
    import('../styles/metadataeditor.scss');
}).on('pagebeforeshow', '.metadataEditorPage', function (this: HTMLElement) {
    const page = this;
    (Dashboard as any).getCurrentUser().then(function (user: any) {
        const id = getCurrentItemId();
        if (id) {
            (ApiClient as any).getAncestorItems(id, user.Id).then(function (ancestors: any[]) {
                const ids = ancestors.map(function (i) {
                    return i.Id;
                });
                initializeTree(page, user, ids, id);
            });
        } else {
            initializeTree(page, user, []);
        }
    });
}).on('pagebeforehide', '.metadataEditorPage', function (this: HTMLElement) {
    const page = this;
    $('.libraryTree', page)
        .off('select_node.jstree', onNodeSelect)
        .off('open_node.jstree', onNodeOpen)
        .off('load_node.jstree', onNodeOpen);
});
/* eslint-enable @typescript-eslint/naming-convention */
