
const ProgressBarPrototype: HTMLDivElement = Object.create(HTMLDivElement.prototype);

function onAutoTimeProgress(this: HTMLDivElement & { timeInterval?: ReturnType<typeof setInterval> | null }): void {
    const start: number = parseInt(this.getAttribute('data-starttime') || '0', 10);
    const end: number = parseInt(this.getAttribute('data-endtime') || '0', 10);

    const now: number = new Date().getTime();
    const total: number = end - start;
    let pct: number = 100 * ((now - start) / total);

    pct = Math.min(100, pct);
    pct = Math.max(0, pct);

    const itemProgressBarForeground = this.querySelector('.itemProgressBarForeground') as HTMLElement;
    itemProgressBarForeground.style.width = pct + '%';
}

(ProgressBarPrototype as any).attachedCallback = function (this: HTMLDivElement & { timeInterval?: ReturnType<typeof setInterval> | null }): void {
    if (this.timeInterval) {
        clearInterval(this.timeInterval);
    }

    if (this.getAttribute('data-automode') === 'time') {
        this.timeInterval = setInterval(onAutoTimeProgress.bind(this), 60000);
    }
};

(ProgressBarPrototype as any).detachedCallback = function (this: HTMLDivElement & { timeInterval?: ReturnType<typeof setInterval> | null }): void {
    if (this.timeInterval) {
        clearInterval(this.timeInterval);
        this.timeInterval = null;
    }
};

document.registerElement('emby-progressbar', {
    prototype: ProgressBarPrototype,
    extends: 'div'
});
