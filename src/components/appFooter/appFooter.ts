import './appFooter.scss';

function render(): HTMLDivElement {
    const elem = document.createElement('div');
    elem.classList.add('appfooter');

    document.body.appendChild(elem);

    return elem;
}

class AppFooter {
    element: HTMLDivElement | null;

    constructor() {
        this.element = render();

        this.add = function (elem: HTMLElement): void {
            if (this.element) {
                this.element.appendChild(elem);
            }
        };

        this.insert = function (elem: string | HTMLElement): void {
            if (!this.element) return;
            if (typeof elem === 'string') {
                this.element.insertAdjacentHTML('afterbegin', elem);
            } else {
                this.element.insertBefore(elem, this.element.firstChild);
            }
        };
    }

    add(elem: HTMLElement): void {
        this.element?.appendChild(elem);
    }

    insert(elem: string | HTMLElement): void {
        if (!this.element) return;
        if (typeof elem === 'string') {
            this.element.insertAdjacentHTML('afterbegin', elem);
        } else {
            this.element.insertBefore(elem, this.element.firstChild);
        }
    }

    destroy(): void {
        this.element = null;
    }
}

export default new AppFooter();
