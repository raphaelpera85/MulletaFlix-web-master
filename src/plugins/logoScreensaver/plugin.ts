import icon from '../../assets/branding/icon.png';

import { PluginType } from '../../types/plugin.ts';
import { randomInt } from '../../utils/number.ts';

type AnimationFn = (elem: Element, iterations: number) => Animation;

interface LogoScreensaverInstance {
    name: string;
    type: PluginType;
    id: string;
    supportsAnonymous: boolean;
    show(): void;
    hide(): Promise<void>;
}

export default function (this: LogoScreensaverInstance) {
    const self = this;

    self.name = 'LogoScreensaver';
    self.type = PluginType.Screensaver;
    self.id = 'logoscreensaver';
    self.supportsAnonymous = true;

    let interval: ReturnType<typeof setInterval> | null = null;

    function animate(): void {
        const animations: AnimationFn[] = [

            bounceInLeft,
            bounceInRight,
            swing,
            tada,
            wobble,
            rotateIn,
            rotateOut
        ];

        const elem = document.querySelector('.logoScreenSaverImage');

        if (elem?.animate) {
            const random = randomInt(0, animations.length - 1);

            animations[random](elem, 1);
        }
    }

    function bounceInLeft(elem: Element, iterations: number): Animation {
        const keyframes: Keyframe[] = [
            { transform: 'translate3d(-3000px, 0, 0)', opacity: '0', offset: 0 },
            { transform: 'translate3d(25px, 0, 0)', opacity: '1', offset: 0.6 },
            { transform: 'translate3d(-100px, 0, 0)', offset: 0.75 },
            { transform: 'translate3d(5px, 0, 0)', offset: 0.9 },
            { transform: 'none', opacity: '1', offset: 1 }];
        const timing: KeyframeAnimationOptions = { duration: 900, iterations: iterations, easing: 'cubic-bezier(0.215, 0.610, 0.355, 1.000)' };
        return elem.animate(keyframes, timing);
    }

    function bounceInRight(elem: Element, iterations: number): Animation {
        const keyframes: Keyframe[] = [
            { transform: 'translate3d(3000px, 0, 0)', opacity: '0', offset: 0 },
            { transform: 'translate3d(-25px, 0, 0)', opacity: '1', offset: 0.6 },
            { transform: 'translate3d(100px, 0, 0)', offset: 0.75 },
            { transform: 'translate3d(-5px, 0, 0)', offset: 0.9 },
            { transform: 'none', opacity: '1', offset: 1 }];
        const timing: KeyframeAnimationOptions = { duration: 900, iterations: iterations, easing: 'cubic-bezier(0.215, 0.610, 0.355, 1.000)' };
        return elem.animate(keyframes, timing);
    }

    function swing(elem: Element, iterations: number): Animation {
        const keyframes: Keyframe[] = [
            { transform: 'translate(0%)', offset: 0 },
            { transform: 'rotate3d(0, 0, 1, 15deg)', offset: 0.2 },
            { transform: 'rotate3d(0, 0, 1, -10deg)', offset: 0.4 },
            { transform: 'rotate3d(0, 0, 1, 5deg)', offset: 0.6 },
            { transform: 'rotate3d(0, 0, 1, -5deg)', offset: 0.8 },
            { transform: 'rotate3d(0, 0, 1, 0deg)', offset: 1 }];
        const timing: KeyframeAnimationOptions = { duration: 900, iterations: iterations };
        return elem.animate(keyframes, timing);
    }

    function tada(elem: Element, iterations: number): Animation {
        const keyframes: Keyframe[] = [
            { transform: 'scale3d(1, 1, 1)', offset: 0 },
            { transform: 'scale3d(.9, .9, .9) rotate3d(0, 0, 1, -3deg)', offset: 0.1 },
            { transform: 'scale3d(.9, .9, .9) rotate3d(0, 0, 1, -3deg)', offset: 0.2 },
            { transform: 'scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 3deg)', offset: 0.3 },
            { transform: 'scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, -3deg)', offset: 0.4 },
            { transform: 'scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 3deg)', offset: 0.5 },
            { transform: 'scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, -3deg)', offset: 0.6 },
            { transform: 'scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 3deg)', offset: 0.7 },
            { transform: 'scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, -3deg)', offset: 0.8 },
            { transform: 'scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 3deg)', offset: 0.9 },
            { transform: 'scale3d(1, 1, 1)', offset: 1 }];
        const timing: KeyframeAnimationOptions = { duration: 900, iterations: iterations };
        return elem.animate(keyframes, timing);
    }

    function wobble(elem: Element, iterations: number): Animation {
        const keyframes: Keyframe[] = [
            { transform: 'translate(0%)', offset: 0 },
            { transform: 'translate3d(20%, 0, 0) rotate3d(0, 0, 1, 3deg)', offset: 0.15 },
            { transform: 'translate3d(-15%, 0, 0) rotate3d(0, 0, 1, -3deg)', offset: 0.45 },
            { transform: 'translate3d(10%, 0, 0) rotate3d(0, 0, 1, 2deg)', offset: 0.6 },
            { transform: 'translate3d(-5%, 0, 0) rotate3d(0, 0, 1, -1deg)', offset: 0.75 },
            { transform: 'translateX(0%)', offset: 1 }];
        const timing: KeyframeAnimationOptions = { duration: 900, iterations: iterations };
        return elem.animate(keyframes, timing);
    }

    function rotateIn(elem: Element, iterations: number): Animation {
        const keyframes: Keyframe[] = [{ transform: 'rotate3d(0, 0, 1, -200deg)', opacity: '0', transformOrigin: 'center', offset: 0 },
            { transform: 'none', opacity: '1', transformOrigin: 'center', offset: 1 }];
        const timing: KeyframeAnimationOptions = { duration: 900, iterations: iterations };
        return elem.animate(keyframes, timing);
    }

    function rotateOut(elem: Element, iterations: number): Animation {
        const keyframes: Keyframe[] = [{ transform: 'none', opacity: '1', transformOrigin: 'center', offset: 0 },
            { transform: 'rotate3d(0, 0, 1, 200deg)', opacity: '0', transformOrigin: 'center', offset: 1 }];
        const timing: KeyframeAnimationOptions = { duration: 900, iterations: iterations };
        return elem.animate(keyframes, timing);
    }

    function fadeOut(elem: Element, iterations: number): Animation {
        const keyframes: Keyframe[] = [
            { opacity: '1', offset: 0 },
            { opacity: '0', offset: 1 }];
        const timing: KeyframeAnimationOptions = { duration: 400, iterations: iterations };
        return elem.animate(keyframes, timing);
    }

    function stopInterval(): void {
        if (interval) {
            clearInterval(interval);
            interval = null;
        }
    }

    self.show = function (): void {
        import('./style.scss').then(() => {
            let elem = document.querySelector('.logoScreenSaver');

            if (!elem) {
                elem = document.createElement('div');
                elem.classList.add('logoScreenSaver');
                document.body.appendChild(elem);

                elem.innerHTML = `<img class="logoScreenSaverImage" src="${icon}" />`;
            }

            stopInterval();
            interval = setInterval(animate, 3000);
        });
    };

    self.hide = function (): Promise<void> {
        stopInterval();

        const elem = document.querySelector('.logoScreenSaver');

        if (elem) {
            return new Promise<void>((resolve) => {
                const onAnimationFinish = function (): void {
                    elem!.parentNode!.removeChild(elem!);
                    resolve();
                };

                if (typeof elem.animate === 'function') {
                    const animation = fadeOut(elem, 1);
                    animation.onfinish = onAnimationFinish;
                } else {
                    onAnimationFinish();
                }
            });
        }

        return Promise.resolve();
    };
}
