import multiDownload from './multiDownload';
import shell from './shell';

export function download(items: Record<string, unknown>[]): void {
    if (!shell.downloadFiles(items)) {
        multiDownload(items.map(function (item: Record<string, unknown>) {
            return item.url as string;
        }));
    }
}
