const ADSENSE_SCRIPT_ID = 'mulletaFlix-adsense-script';

function getBrandingConfiguration(apiClient) {
    return apiClient.getNamedConfiguration('branding').catch(() => ({}));
}

function isPlacementEnabled(config, placement) {
    switch (placement) {
        case 'login':
            return config?.AdSenseShowOnLogin === true;
        case 'home':
            return config?.AdSenseShowOnHome === true;
        default:
            return config?.AdSenseShowAfterIntro !== false;
    }
}

function cleanupOverlay(overlay, style) {
    if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }

    if (style.parentNode) {
        style.parentNode.removeChild(style);
    }
}

export function showAdSenseInterstitial(apiClient, placement = 'playback') {
    return getBrandingConfiguration(apiClient).then(function (config) {
        if (!config?.AdSenseEnabled || !config.AdSenseClientId || !config.AdSenseSlotId || !isPlacementEnabled(config, placement)) {
            return Promise.resolve();
        }

        if (!document.body) {
            return Promise.resolve();
        }

        return new Promise(function (resolve) {
            const overlay = document.createElement('div');
            overlay.className = 'adsenseInterstitialOverlay';
            overlay.innerHTML = `
                <div class="adsenseInterstitialCard">
                    <div class="adsenseInterstitialHeader">Propaganda</div>
                    <div class="adsenseInterstitialBody">
                        <ins class="adsbygoogle"
                            style="display:block;min-width:320px;min-height:250px"
                            data-ad-client="${config.AdSenseClientId}"
                            data-ad-slot="${config.AdSenseSlotId}"
                            data-ad-format="auto"
                            data-full-width-responsive="true"></ins>
                    </div>
                    <div class="adsenseInterstitialStatus"></div>
                    <button type="button" class="btnContinueAdSense" disabled>Continuar</button>
                </div>
            `;

            const style = document.createElement('style');
            style.textContent = `
                .adsenseInterstitialOverlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    background: rgba(0, 0, 0, 0.92);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                }

                .adsenseInterstitialCard {
                    width: min(920px, 100%);
                    background: #111;
                    color: #fff;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
                }

                .adsenseInterstitialHeader {
                    font-size: 1.1rem;
                    font-weight: 700;
                }

                .adsenseInterstitialBody {
                    min-height: 280px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000;
                    border-radius: 8px;
                }

                .adsenseInterstitialStatus {
                    min-height: 1.2em;
                    color: rgba(255, 255, 255, 0.72);
                    font-size: 0.95rem;
                }

                .btnContinueAdSense {
                    align-self: flex-end;
                }
            `;

            const continueButton = overlay.querySelector('.btnContinueAdSense');
            const statusMessage = overlay.querySelector('.adsenseInterstitialStatus');
            let timer = null;
            let fallbackTimer = null;

            const finish = function () {
                if (timer) {
                    window.clearInterval(timer);
                    timer = null;
                }

                if (fallbackTimer) {
                    window.clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                }

                cleanupOverlay(overlay, style);
                resolve();
            };

            const setFallback = function (message) {
                if (statusMessage) {
                    statusMessage.textContent = message;
                }

                if (timer) {
                    window.clearInterval(timer);
                    timer = null;
                }

                if (fallbackTimer) {
                    window.clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                }

                continueButton.disabled = false;
                continueButton.textContent = 'Continuar';
            };

            const countdownSeconds = Math.max(0, Number(config.AdSenseHoldSeconds || 8));
            let secondsLeft = countdownSeconds;
            const updateButtonLabel = function () {
                continueButton.textContent = secondsLeft > 0 ? `Continuar em ${secondsLeft}s` : 'Continuar';
            };

            document.head.appendChild(style);
            document.body.appendChild(overlay);

            updateButtonLabel();

            timer = window.setInterval(function () {
                secondsLeft -= 1;
                if (secondsLeft <= 0) {
                    secondsLeft = 0;
                    window.clearInterval(timer);
                    timer = null;
                    continueButton.disabled = false;
                }

                updateButtonLabel();
            }, 1000);

            if (countdownSeconds === 0) {
                continueButton.disabled = false;
                updateButtonLabel();
            } else {
                fallbackTimer = window.setTimeout(function () {
                    secondsLeft = 0;
                    continueButton.disabled = false;
                    updateButtonLabel();
                }, countdownSeconds * 1000);
            }

            continueButton.addEventListener('click', finish, { once: true });

            const injectAdSense = function () {
                try {
                    window.adsbygoogle = window.adsbygoogle || [];
                    window.adsbygoogle.push({});
                } catch (error) {
                    console.warn('AdSense interstitial failed to render', error);
                    setFallback('Anuncio indisponivel. Voce pode continuar.');
                }
            };

            const existingScript = document.getElementById(ADSENSE_SCRIPT_ID);
            if (existingScript) {
                injectAdSense();
                return;
            }

            const script = document.createElement('script');
            script.id = ADSENSE_SCRIPT_ID;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.AdSenseClientId)}`;
            script.onload = injectAdSense;
            script.onerror = function () {
                console.warn('AdSense script failed to load');
                setFallback('Falha ao carregar a propaganda. Voce pode continuar.');
            };
            document.head.appendChild(script);
        });
    });
}
