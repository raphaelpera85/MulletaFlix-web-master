import { appRouter } from './router/appRouter';
import dialog from './dialog/dialog';
import globalize from '../lib/globalize';

interface AlertOptions {
    title?: string;
    text?: string;
    [key: string]: any;
}

export default async function alert(text: string | AlertOptions, title?: string): Promise<void> {
    const options: AlertOptions = typeof text === 'string' ? { title, text } : text;

    await appRouter.ready();

    options.buttons = [
        {
            name: globalize.translate('ButtonGotIt'),
            id: 'ok',
            type: 'submit'
        }
    ];

    await dialog.show(options);
}
