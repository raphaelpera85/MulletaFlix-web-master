import globalize from 'lib/globalize';
import Dashboard from 'utils/dashboard';

interface ForgotPasswordResult {
    Success: boolean;
    UsersReset?: string[];
}

function processForgotPasswordResult(result: ForgotPasswordResult): void {
    if (result.Success) {
        let msg: string = globalize.translate('MessagePasswordResetForUsers');
        msg += '<br/>';
        msg += '<br/>';
        msg += (result.UsersReset || []).join('<br/>');
        Dashboard.alert({
            message: msg,
            title: globalize.translate('HeaderPasswordReset'),
            callback: function () {
                window.location.href = '';
            }
        });
        return;
    }

    Dashboard.alert({
        message: globalize.translate('MessageInvalidForgotPasswordPin'),
        title: globalize.translate('HeaderPasswordReset')
    });
}

export default function (view: HTMLElement): void {
    function onSubmit(e: Event): void {
        // eslint-disable-next-line no-undef
        ApiClient.ajax({
            type: 'POST',
            // eslint-disable-next-line no-undef
            url: ApiClient.getUrl('Users/ForgotPassword/Pin'),
            dataType: 'json',
            data: JSON.stringify({
                Pin: (view.querySelector('#txtPin') as HTMLInputElement).value
            }),
            contentType: 'application/json'
        }).then(processForgotPasswordResult);
        e.preventDefault();
    }

    view.querySelector('form')!.addEventListener('submit', onSubmit);

    (view.querySelector('#txtPin') as HTMLInputElement).focus();
}
