interface NativeShellMediaInfo {
    [key: string]: unknown;
}

interface NativeShellDownloadItem {
    [key: string]: unknown;
}

/** @deprecated Use window.NativeShell directly. Maintained for backward compatibility with 7 consumers. */
export default {
    enableFullscreen: function (): void {
        if (window.NativeShell?.enableFullscreen) {
            window.NativeShell.enableFullscreen();
        }
    },
    disableFullscreen: function (): void {
        if (window.NativeShell?.disableFullscreen) {
            window.NativeShell.disableFullscreen();
        }
    },
    openClientSettings: (): void => {
        if (window.NativeShell?.openClientSettings) {
            window.NativeShell.openClientSettings();
        }
    },
    openDownloadManager: (): void => {
        if (window.NativeShell?.openDownloadManager) {
            window.NativeShell.openDownloadManager();
        }
    },
    openUrl: function (url: string, target?: string): void {
        if (window.NativeShell?.openUrl) {
            window.NativeShell.openUrl(url, target);
        } else {
            window.open(url, target || '_blank');
        }
    },
    updateMediaSession(mediaInfo: NativeShellMediaInfo): void {
        if (window.NativeShell?.updateMediaSession) {
            window.NativeShell.updateMediaSession(mediaInfo);
        }
    },
    hideMediaSession(): void {
        if (window.NativeShell?.hideMediaSession) {
            window.NativeShell.hideMediaSession();
        }
    },
    /**
     * Notify the NativeShell about volume level changes.
     * Useful for e.g. remote playback.
     */
    updateVolumeLevel(volume: number): void {
        if (window.NativeShell?.updateVolumeLevel) {
            window.NativeShell.updateVolumeLevel(volume);
        }
    },
    /**
     * Download specified files with NativeShell if possible
     *
     * @returns true on success
     */
    downloadFiles(items: NativeShellDownloadItem[]): boolean {
        if (window.NativeShell?.downloadFiles) {
            window.NativeShell.downloadFiles(items);
            return true;
        }
        if (window.NativeShell?.downloadFile) {
            items.forEach(item => {
                window.NativeShell.downloadFile(item);
            });
            return true;
        }
        return false;
    }
};
