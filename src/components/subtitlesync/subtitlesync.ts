
import { playbackManager } from '../playback/playbackmanager';
import layoutManager from '../layoutManager';
import template from './subtitlesync.template.html';
import './subtitlesync.scss';

let player: any;
let subtitleSyncSlider: any;
let subtitleSyncTextField: any;
let subtitleSyncCloseButton: HTMLElement;
let subtitleSyncContainer: HTMLElement;

function init(instance: SubtitleSync): void {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    parent.innerHTML = template;

    subtitleSyncSlider = parent.querySelector('.subtitleSyncSlider') as any;
    subtitleSyncTextField = parent.querySelector('.subtitleSyncTextField') as any;
    subtitleSyncCloseButton = parent.querySelector('.subtitleSync-closeButton') as HTMLElement;
    subtitleSyncContainer = parent.querySelector('.subtitleSyncContainer') as HTMLElement;

    if (layoutManager.tv) {
        subtitleSyncSlider.classList.add('focusable');
        setTimeout(function () {
            subtitleSyncSlider.enableKeyboardDragging();
        }, 0);
    }

    subtitleSyncContainer.classList.add('hide');

    subtitleSyncTextField.updateOffset = function (offset: number): void {
        this.textContent = offset + 's';
    };

    subtitleSyncTextField.addEventListener('click', function (this: any) {
        this.hasFocus = true;
    });

    subtitleSyncTextField.addEventListener('keydown', function (this: any, event: KeyboardEvent) {
        if (event.key === 'Enter') {
            let inputOffset = /[-+]?\d+\.?\d*/g.exec(this.textContent);
            if (inputOffset) {
                const offsetStr = inputOffset[0];
                const parsedOffset = parseFloat(offsetStr);

                subtitleSyncSlider.updateOffset(parsedOffset);
            } else {
                this.textContent = (playbackManager.getPlayerSubtitleOffset(player) || 0) + 's';
            }
            this.hasFocus = false;
            event.preventDefault();
        } else {
            this.hasFocus = true;
            if (event.key.match(/[+-\d.s]/) === null) {
                event.preventDefault();
            }
        }

        event.stopPropagation();
    });

    subtitleSyncTextField.blur = function (this: any) {
        if (!this.hasFocus && this.prototype) {
            this.prototype.blur();
        }
    } as any;

    function updateSubtitleOffset(): void {
        const value = parseFloat(subtitleSyncSlider.value);
        playbackManager.setSubtitleOffset(value, player);
        subtitleSyncTextField.updateOffset(value);
    }

    subtitleSyncSlider.updateOffset = function (sliderValue: number): void {
        this.value = sliderValue === undefined ? 0 : sliderValue;

        updateSubtitleOffset();
    };

    subtitleSyncSlider.addEventListener('change', () => updateSubtitleOffset());

    subtitleSyncSlider.getBubbleHtml = function (_: any, value: number): string {
        return '<h1 class="sliderBubbleText">'
            + (value > 0 ? '+' : '') + parseFloat(value as unknown as string) + 's'
            + '</h1>';
    };

    subtitleSyncCloseButton.addEventListener('click', function () {
        playbackManager.disableShowingSubtitleOffset(player);
        SubtitleSync.prototype.toggle('forceToHide');
    });

    instance.element = parent;
}

class SubtitleSync {
    element: HTMLDivElement | null = null;

    constructor(currentPlayer: any) {
        player = currentPlayer;
        init(this);
    }

    destroy(): void {
        SubtitleSync.prototype.toggle('forceToHide');
        if (player) {
            playbackManager.disableShowingSubtitleOffset(player);
            playbackManager.setSubtitleOffset(0, player);
        }
        const elem = this.element;
        if (elem) {
            elem.parentNode!.removeChild(elem);
            this.element = null;
        }
    }

    toggle(action?: string): void {
        if (action && !['hide', 'forceToHide'].includes(action)) {
            console.warn('SubtitleSync.toggle called with invalid action', action);
            return;
        }

        if (player && playbackManager.supportSubtitleOffset(player)) {
            if (!action) {
                if (playbackManager.isShowingSubtitleOffsetEnabled(player) && playbackManager.canHandleOffsetOnCurrentSubtitle(player)) {
                    if (!(playbackManager.getPlayerSubtitleOffset(player) || subtitleSyncTextField.hasFocus)) {
                        subtitleSyncSlider.value = '0';
                        subtitleSyncTextField.textContent = '0s';
                        playbackManager.setSubtitleOffset(0, player);
                    }
                    subtitleSyncContainer.classList.remove('hide');
                    return;
                }
            } else if (action === 'hide' && subtitleSyncTextField.hasFocus) {
                return;
            }

            subtitleSyncContainer.classList.add('hide');
        }
    }

    update(offset: number): void {
        this.toggle();

        const value = parseFloat(subtitleSyncSlider.value) + offset;
        subtitleSyncSlider.updateOffset(value);
    }

    incrementOffset(): void {
        this.update(+subtitleSyncSlider.step);
    }

    decrementOffset(): void {
        this.update(-subtitleSyncSlider.step);
    }
}

export default SubtitleSync;
