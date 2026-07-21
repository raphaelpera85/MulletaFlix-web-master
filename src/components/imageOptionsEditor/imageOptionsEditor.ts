
/**
 * Module for image Options Editor.
 * @module components/imageOptionsEditor/imageOptionsEditor
 */

import globalize from '../../lib/globalize';
import dom from '../../utils/dom';
import dialogHelper from '../dialogHelper/dialogHelper';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-select/emby-select';
import '../../elements/emby-input/emby-input';
import template from './imageOptionsEditor.template.html';

interface ImageOption {
    Type: string;
    MinWidth: number;
    Limit: number;
}

interface AvailableOptions {
    SupportedImageTypes?: string[];
    DefaultImageOptions?: ImageOption[];
}

interface EditorOptions {
    ImageOptions?: ImageOption[];
}

function getDefaultImageConfig(_itemType: string, type: string): ImageOption {
    return {
        Type: type,
        MinWidth: 0,
        Limit: type === 'Primary' ? 1 : 0
    };
}

function findImageOptions(imageOptions: ImageOption[], type: string): ImageOption | undefined {
    return imageOptions.filter(i => {
        return i.Type == type;
    })[0];
}

function getImageConfig(options: EditorOptions, availableOptions: AvailableOptions, imageType: string, itemType: string): ImageOption {
    return findImageOptions(options.ImageOptions || [], imageType) || findImageOptions(availableOptions.DefaultImageOptions || [], imageType) || getDefaultImageConfig(itemType, imageType);
}

function setVisibilityOfBackdrops(elem: HTMLElement, visible: boolean): void {
    if (visible) {
        elem.classList.remove('hide');
        (elem.querySelector('input') as HTMLInputElement).setAttribute('required', 'required');
    } else {
        elem.classList.add('hide');
        const input = elem.querySelector('input') as HTMLInputElement;
        input.setAttribute('required', '');
        input.removeAttribute('required');
    }
}

function loadValues(context: HTMLElement, itemType: string, options: EditorOptions, availableOptions: AvailableOptions): void {
    const supportedImageTypes = availableOptions.SupportedImageTypes || [];
    setVisibilityOfBackdrops(context.querySelector('.backdropFields') as HTMLElement, supportedImageTypes.includes('Backdrop'));
    Array.prototype.forEach.call(context.querySelectorAll('.imageType'), (i: HTMLInputElement) => {
        const imageType = i.getAttribute('data-imagetype') || '';
        const container = dom.parentWithTag(i, 'LABEL') as HTMLElement;

        if (!supportedImageTypes.includes(imageType)) {
            container.classList.add('hide');
        } else {
            container.classList.remove('hide');
        }

        if (getImageConfig(options, availableOptions, imageType, itemType).Limit) {
            i.checked = true;
        } else {
            i.checked = false;
        }
    });
    const backdropConfig = getImageConfig(options, availableOptions, 'Backdrop', itemType);
    (context.querySelector('#txtMaxBackdrops') as HTMLInputElement).value = String(backdropConfig.Limit);
    (context.querySelector('#txtMinBackdropDownloadWidth') as HTMLInputElement).value = String(backdropConfig.MinWidth);
}

function saveValues(context: HTMLElement, options: EditorOptions): void {
    options.ImageOptions = Array.prototype.map.call(context.querySelectorAll('.imageType:not(.hide)'), (c: HTMLInputElement): ImageOption => {
        return {
            Type: c.getAttribute('data-imagetype') || '',
            Limit: c.checked ? 1 : 0,
            MinWidth: 0
        };
    }) as ImageOption[];
    options.ImageOptions!.push({
        Type: 'Backdrop',
        Limit: parseInt((context.querySelector('#txtMaxBackdrops') as HTMLInputElement).value, 10),
        MinWidth: parseInt((context.querySelector('#txtMinBackdropDownloadWidth') as HTMLInputElement).value, 10)
    });
}

class ImageOptionsEditor {
    show(itemType: string, options: EditorOptions, availableOptions: AvailableOptions): void {
        const dlg = dialogHelper.createDialog({
            size: 'small',
            removeOnClose: true,
            scrollY: false
        });
        dlg.classList.add('formDialog');
        dlg.innerHTML = globalize.translateHtml(template);
        dlg.addEventListener('close', function () {
            saveValues(dlg, options);
        });
        loadValues(dlg, itemType, options, availableOptions);
        dialogHelper.open(dlg).then(() => {
            return;
        }).catch(() => {
            return;
        });
        dlg.querySelector('.btnCancel')!.addEventListener('click', function () {
            dialogHelper.close(dlg);
        });
    }
}

export default ImageOptionsEditor;
