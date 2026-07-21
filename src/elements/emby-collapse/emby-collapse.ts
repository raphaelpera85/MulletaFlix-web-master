import './emby-collapse.scss';
import 'webcomponents.js/webcomponents-lite';
import '../emby-button/emby-button';

const EmbyButtonPrototype: HTMLDivElement = Object.create(HTMLDivElement.prototype);

function slideDownToShow(button: HTMLElement, elem: HTMLElement): void {
    requestAnimationFrame(() => {
        elem.classList.remove('hide');
        elem.classList.add('expanded');
        elem.style.height = 'auto';
        const height = elem.offsetHeight + 'px';
        elem.style.height = '0';
        // trigger reflow
        // TODO: Find a better way to do this
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, sonarjs/no-unused-vars, sonarjs/no-dead-store
        const newHeight: number = elem.offsetHeight;
        elem.style.height = height;

        setTimeout(function () {
            if (elem.classList.contains('expanded')) {
                elem.classList.remove('hide');
            } else {
                elem.classList.add('hide');
            }
            elem.style.height = 'auto';
        }, 300);

        const icon = button.querySelector('.material-icons') as HTMLElement;
        icon.classList.add('emby-collapse-expandIconExpanded');
    });
}

function slideUpToHide(button: HTMLElement, elem: HTMLElement): void {
    requestAnimationFrame(() => {
        elem.style.height = elem.offsetHeight + 'px';
        // trigger reflow
        // TODO: Find a better way to do this
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, sonarjs/no-unused-vars, sonarjs/no-dead-store
        const newHeight: number = elem.offsetHeight;
        elem.classList.remove('expanded');
        elem.style.height = '0';

        setTimeout(function () {
            if (elem.classList.contains('expanded')) {
                elem.classList.remove('hide');
            } else {
                elem.classList.add('hide');
            }
        }, 300);

        const icon = button.querySelector('.material-icons') as HTMLElement;
        icon.classList.remove('emby-collapse-expandIconExpanded');
    });
}

function onButtonClick(this: HTMLElement): void {
    const button = this;
    const collapseContent = button.parentNode!.querySelector('.collapseContent') as HTMLElement & { expanded: boolean };

    if (collapseContent.expanded) {
        collapseContent.expanded = false;
        slideUpToHide(button, collapseContent);
    } else {
        collapseContent.expanded = true;
        slideDownToShow(button, collapseContent);
    }
}

(EmbyButtonPrototype as any).attachedCallback = function (this: HTMLElement): void {
    if (this.classList.contains('emby-collapse')) {
        return;
    }

    this.classList.add('emby-collapse');

    const collapseContent = this.querySelector('.collapseContent') as HTMLElement | null;
    if (collapseContent) {
        collapseContent.classList.add('hide');
    }

    const title = this.getAttribute('title') || '';

    const html = '<button is="emby-button" type="button" on-click="toggleExpand" id="expandButton" class="emby-collapsible-button iconRight"><h3 class="emby-collapsible-title" title="' + title + '">' + title + '</h3><span class="material-icons emby-collapse-expandIcon expand_more" aria-hidden="true"></span></button>';

    this.insertAdjacentHTML('afterbegin', html);

    const button = this.querySelector('.emby-collapsible-button') as HTMLElement;

    button.addEventListener('click', onButtonClick);

    if (this.getAttribute('data-expanded') === 'true') {
        onButtonClick.call(button);
    }
};

document.registerElement('emby-collapse', {
    prototype: EmbyButtonPrototype,
    extends: 'div'
});
