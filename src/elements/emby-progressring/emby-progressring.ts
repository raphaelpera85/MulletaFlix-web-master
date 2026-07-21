import './emby-progressring.scss';
import 'webcomponents.js/webcomponents-lite';
import template from './emby-progressring.template.html';
import { getCurrentDateTimeLocale } from '../../lib/globalize';
import { toPercentString } from '../../utils/number';

const EmbyProgressRing: HTMLDivElement = Object.create(HTMLDivElement.prototype);

(EmbyProgressRing as any).createdCallback = function (this: HTMLDivElement & { observer?: MutationObserver | null; setProgress: (progress: number) => void }): void {
    this.classList.add('progressring');
    this.setAttribute('dir', 'ltr');
    const instance = this;

    instance.innerHTML = template;

    if (window.MutationObserver) {
        // create an observer instance
        const observer = new MutationObserver(function (mutations: MutationRecord[]) {
            mutations.forEach(function () {
                instance.setProgress(parseFloat(instance.getAttribute('data-progress') || '0'));
            });
        });

        // configuration of the observer:
        const config: MutationObserverInit = { attributes: true, childList: false, characterData: false };

        // pass in the target node, as well as the observer options
        observer.observe(instance, config);

        instance.observer = observer;
    }

    instance.setProgress(parseFloat(instance.getAttribute('data-progress') || '0'));
};

(EmbyProgressRing as any).setProgress = function (this: HTMLDivElement, progress: number): void {
    progress = Math.floor(progress);

    let angle: number;

    if (progress < 25) {
        angle = -90 + (progress / 100) * 360;

        (this.querySelector('.animate-0-25-b') as HTMLElement).style.transform = 'rotate(' + angle + 'deg)';

        (this.querySelector('.animate-25-50-b') as HTMLElement).style.transform = 'rotate(-90deg)';
        (this.querySelector('.animate-50-75-b') as HTMLElement).style.transform = 'rotate(-90deg)';
        (this.querySelector('.animate-75-100-b') as HTMLElement).style.transform = 'rotate(-90deg)';
    } else if (progress >= 25 && progress < 50) {
        angle = -90 + ((progress - 25) / 100) * 360;

        (this.querySelector('.animate-0-25-b') as HTMLElement).style.transform = 'none';
        (this.querySelector('.animate-25-50-b') as HTMLElement).style.transform = 'rotate(' + angle + 'deg)';

        (this.querySelector('.animate-50-75-b') as HTMLElement).style.transform = 'rotate(-90deg)';
        (this.querySelector('.animate-75-100-b') as HTMLElement).style.transform = 'rotate(-90deg)';
    } else if (progress >= 50 && progress < 75) {
        angle = -90 + ((progress - 50) / 100) * 360;

        (this.querySelector('.animate-0-25-b') as HTMLElement).style.transform = 'none';
        (this.querySelector('.animate-25-50-b') as HTMLElement).style.transform = 'none';
        (this.querySelector('.animate-50-75-b') as HTMLElement).style.transform = 'rotate(' + angle + 'deg)';

        (this.querySelector('.animate-75-100-b') as HTMLElement).style.transform = 'rotate(-90deg)';
    } else if (progress >= 75 && progress <= 100) {
        angle = -90 + ((progress - 75) / 100) * 360;

        (this.querySelector('.animate-0-25-b') as HTMLElement).style.transform = 'none';
        (this.querySelector('.animate-25-50-b') as HTMLElement).style.transform = 'none';
        (this.querySelector('.animate-50-75-b') as HTMLElement).style.transform = 'none';
        (this.querySelector('.animate-75-100-b') as HTMLElement).style.transform = 'rotate(' + angle + 'deg)';
    }

    (this.querySelector('.progressring-text') as HTMLElement).innerHTML = toPercentString(progress / 100, getCurrentDateTimeLocale() as string);
};

(EmbyProgressRing as any).attachedCallback = function (): void {
    // no-op
};

(EmbyProgressRing as any).detachedCallback = function (this: HTMLDivElement & { observer?: MutationObserver | null }): void {
    const observer = this.observer;

    if (observer) {
        // later, you can stop observing
        observer.disconnect();

        this.observer = null;
    }
};

document.registerElement('emby-progressring', {
    prototype: EmbyProgressRing,
    extends: 'div'
});

export default EmbyProgressRing;
