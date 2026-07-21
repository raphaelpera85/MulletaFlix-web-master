const ADSENSE_SCRIPT_ID = 'mulletaFlix-adsense-script';

interface BrandingConfiguration {
    AdSenseEnabled?: boolean;
    AdSenseClientId?: string;
    AdSenseSlotId?: string;
    AdSenseHoldSeconds?: number;
    AdSenseShowOnLogin?: boolean;
    AdSenseShowOnHome?: boolean;
    AdSenseShowAfterIntro?: boolean;
}

interface AdSenseApiClient {
    accessToken?: () => string | null;
    getNamedConfiguration?: (name: string) => Promise<BrandingConfiguration>;
}

type AdSensePlacement = 'login' | 'home' | 'playback';

function getBrandingConfiguration(apiClient: AdSenseApiClient): Promise<BrandingConfiguration> {
    if (!apiClient.getNamedConfiguration) {
        return Promise.resolve({});
    }

    return apiClient.getNamedConfiguration('branding').catch(() => ({}));
}

function isPlacementEnabled(config: BrandingConfiguration, placement: AdSensePlacement): boolean {
    switch (placement) {
        case 'login':
            return config.AdSenseShowOnLogin === true;
        case 'home':
            return config.AdSenseShowOnHome === true;
        default:
            return config.AdSenseShowAfterIntro !== false;
    }
}

function cleanupOverlay(overlay: HTMLDivElement, style: HTMLStyleElement): void {
    if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }

    if (style.parentNode) {
        style.parentNode.removeChild(style);
    }
}

export function showAdSenseInterstitial(apiClient: AdSenseApiClient, placement: AdSensePlacement = 'playback'): Promise<void> {
    return getBrandingConfiguration(apiClient).then(function (config) {
        const clientId = config.AdSenseClientId;
        const slotId = config.AdSenseSlotId;

        if (!config.AdSenseEnabled || !clientId || !slotId || !isPlacementEnabled(config, placement)) {
            return Promise.resolve();
        }

        if (!document.body) {
            return Promise.resolve();
        }

        return new Promise(function (resolve: () => void) {
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

            const continueButton = overlay.querySelector<HTMLButtonElement>('.btnContinueAdSense');
            const statusMessage = overlay.querySelector<HTMLElement>('.adsenseInterstitialStatus');

            if (!continueButton || !statusMessage) {
                resolve();
                return;
            }

            let timer: number | null = null;
            let fallbackTimer: number | null = null;

            const finish = function (): void {
                if (timer !== null) {
                    window.clearInterval(timer);
                    timer = null;
                }

                if (fallbackTimer !== null) {
                    window.clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                }

                cleanupOverlay(overlay, style);
                resolve();
            };

            const setFallback = function (message: string): void {
                statusMessage.textContent = message;

                if (timer !== null) {
                    window.clearInterval(timer);
                    timer = null;
                }

                if (fallbackTimer !== null) {
                    window.clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                }

                continueButton.disabled = false;
                continueButton.textContent = 'Continuar';
            };

            const countdownSeconds = Math.max(0, Number(config.AdSenseHoldSeconds || 8));
            let secondsLeft = countdownSeconds;
            const updateButtonLabel = function (): void {
                continueButton.textContent = secondsLeft > 0 ? `Continuar em ${secondsLeft}s` : 'Continuar';
            };

            document.head.appendChild(style);
            document.body.appendChild(overlay);

            updateButtonLabel();

            timer = window.setInterval(function (): void {
                secondsLeft -= 1;
                if (secondsLeft <= 0) {
                    secondsLeft = 0;
                    if (timer !== null) {
                        window.clearInterval(timer);
                        timer = null;
                    }
                    continueButton.disabled = false;
                }

                updateButtonLabel();
            }, 1000);

            if (countdownSeconds === 0) {
                continueButton.disabled = false;
                updateButtonLabel();
            } else {
                fallbackTimer = window.setTimeout(function (): void {
                    secondsLeft = 0;
                    continueButton.disabled = false;
                    updateButtonLabel();
                }, countdownSeconds * 1000);
            }

            continueButton.addEventListener('click', finish, { once: true });

            const injectAdSense = function (): void {
                try {
                    const adsbygoogle = (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle || [];
                    (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle = adsbygoogle;
                    adsbygoogle.push({});
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
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
            script.onload = injectAdSense;
            script.onerror = function (): void {
                console.warn('AdSense script failed to load');
                setFallback('Falha ao carregar a propaganda. Voce pode continuar.');
            };
            document.head.appendChild(script);
        });
    });
}
