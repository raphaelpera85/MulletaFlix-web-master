interface CastWindow extends Window {
    appMode?: 'cordova' | 'android' | string;
    chrome?: Record<string, unknown>;
}

class CastSenderApi {
    load(): Promise<void> {
        const castWindow = window as CastWindow;

        if (castWindow.appMode === 'cordova' || castWindow.appMode === 'android') {
            castWindow.chrome = castWindow.chrome || {};
            return Promise.resolve();
        }

        let ccLoaded = false;
        if (ccLoaded) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            const fileref = document.createElement('script');
            fileref.setAttribute('type', 'text/javascript');

            fileref.onload = () => {
                ccLoaded = true;
                resolve();
            };

            fileref.setAttribute('src', 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js');
            document.querySelector('head')?.appendChild(fileref);
        });
    }
}

export default CastSenderApi;
