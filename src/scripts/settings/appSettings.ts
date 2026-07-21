import browser from 'scripts/browser';
import Events from '../../utils/events';
import { toBoolean } from '../../utils/string';

class AppSettings {
    #getKey(name: string, userId?: string | null): string {
        if (userId) {
            name = userId + '-' + name;
        }

        return name;
    }

    enableAutoLogin(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableAutoLogin', val.toString());
        }

        return toBoolean(this.get('enableAutoLogin'), true);
    }

    /**
     * Get or set 'Enable Gamepad' state.
     * @param val - Flag to enable 'Enable Gamepad' or undefined.
     * @return 'Enable Gamepad' state.
     */
    enableGamepad(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableGamepad', val.toString());
            return toBoolean(this.get('enableGamepad'), false);
        }

        return toBoolean(this.get('enableGamepad'), false);
    }

    /**
     * Get or set 'Enable smooth scroll' state.
     * @param val - Flag to enable 'Enable smooth scroll' or undefined.
     * @return 'Enable smooth scroll' state.
     */
    enableSmoothScroll(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableSmoothScroll', val.toString());
            return toBoolean(this.get('enableSmoothScroll'), !!browser.tizen);
        }

        return toBoolean(this.get('enableSmoothScroll'), !!browser.tizen);
    }

    enableSystemExternalPlayers(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableSystemExternalPlayers', val.toString());
        }

        return toBoolean(this.get('enableSystemExternalPlayers'), false);
    }

    enableAutomaticBitrateDetection(isInNetwork: boolean, mediaType: string, val?: boolean): boolean {
        const key = 'enableautobitratebitrate-' + mediaType + '-' + isInNetwork;
        if (val !== undefined) {
            if (isInNetwork && mediaType === 'Audio') {
                val = true;
            }

            this.set(key, (val as boolean).toString());
        }

        if (isInNetwork && mediaType === 'Audio') {
            return true;
        } else {
            return toBoolean(this.get(key), true);
        }
    }

    maxStreamingBitrate(isInNetwork: boolean, mediaType: string, val?: number | string): number {
        const key = 'maxbitrate-' + mediaType + '-' + isInNetwork;
        if (val !== undefined) {
            if (isInNetwork && mediaType === 'Audio') {
                //  nothing to do, this is always a max value
            } else {
                this.set(key, val as string);
            }
        }

        if (isInNetwork && mediaType === 'Audio') {
            // return a huge number so that it always direct plays
            return 150000000;
        } else {
            return parseInt(this.get(key) || '0', 10) || 1500000;
        }
    }

    maxStaticMusicBitrate(val?: number | string): number {
        if (val !== undefined) {
            this.set('maxStaticMusicBitrate', val as string);
        }

        const defaultValue = 320000;
        return parseInt(this.get('maxStaticMusicBitrate') || defaultValue.toString(), 10) || defaultValue;
    }

    maxChromecastBitrate(val?: number | string): number | null {
        if (val !== undefined) {
            this.set('chromecastBitrate1', val as string);
        }

        const stored = this.get('chromecastBitrate1');
        return stored ? parseInt(stored, 10) : null;
    }

    /**
     * Get or set 'Maximum video width'
     * @param val - Maximum video width or undefined.
     * @return Maximum video width.
     */
    maxVideoWidth(val?: number): number {
        if (val !== undefined) {
            this.set('maxVideoWidth', val.toString());
            return parseInt(this.get('maxVideoWidth') || '0', 10) || 0;
        }

        return parseInt(this.get('maxVideoWidth') || '0', 10) || 0;
    }

    /**
     * Get or set 'Limit maximum supported video resolution' state.
     * @param val - Flag to enable 'Limit maximum supported video resolution' or undefined.
     * @return 'Limit maximum supported video resolution' state.
     */
    limitSupportedVideoResolution(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('limitSupportedVideoResolution', val.toString());
            return toBoolean(this.get('limitSupportedVideoResolution'), false);
        }

        return toBoolean(this.get('limitSupportedVideoResolution'), false);
    }

    /**
     * Get or set preferred transcode video codec.
     * @param val - Preferred transcode video codec or undefined.
     * @return Preferred transcode video codec.
     */
    preferredTranscodeVideoCodec(val?: string): string {
        if (val !== undefined) {
            this.set('preferredTranscodeVideoCodec', val);
            return this.get('preferredTranscodeVideoCodec') || '';
        }
        return this.get('preferredTranscodeVideoCodec') || '';
    }

    /**
     * Get or set preferred transcode audio codec in video playback.
     * @param val - Preferred transcode audio codec or undefined.
     * @return Preferred transcode audio codec.
     */
    preferredTranscodeVideoAudioCodec(val?: string): string {
        if (val !== undefined) {
            this.set('preferredTranscodeVideoAudioCodec', val);
            return this.get('preferredTranscodeVideoAudioCodec') || '';
        }
        return this.get('preferredTranscodeVideoAudioCodec') || '';
    }

    /**
     * Get or set 'Always burn in subtitle when transcoding' state.
     * @param val - Flag to enable 'Always burn in subtitle when transcoding' or undefined.
     * @return 'Always burn in subtitle when transcoding' state.
     */
    alwaysBurnInSubtitleWhenTranscoding(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('alwaysBurnInSubtitleWhenTranscoding', val.toString());
            return toBoolean(this.get('alwaysBurnInSubtitleWhenTranscoding'), false);
        }

        return toBoolean(this.get('alwaysBurnInSubtitleWhenTranscoding'), false);
    }

    /**
     * Get or set 'Enable DTS' state.
     * @param val - Flag to enable 'Enable DTS' or undefined.
     * @return 'Enable DTS' state.
     */
    enableDts(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableDts', val.toString());
            return toBoolean(this.get('enableDts'), false);
        }

        return toBoolean(this.get('enableDts'), false);
    }

    /**
     * Get or set 'Enable TrueHD' state.
     * @param val - Flag to enable 'Enable TrueHD' or undefined.
     * @return 'Enable TrueHD' state.
     */
    enableTrueHd(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableTrueHd', val.toString());
            return toBoolean(this.get('enableTrueHd'), false);
        }

        return toBoolean(this.get('enableTrueHd'), false);
    }

    /**
     * Get or set 'Enable H.264 High 10 Profile' state.
     * @param val - Flag to enable 'Enable H.264 High 10 Profile' or undefined.
     * @return 'Enable H.264 High 10 Profile' state.
     */
    enableHi10p(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableHi10p', val.toString());
            return toBoolean(this.get('enableHi10p'), false);
        }

        return toBoolean(this.get('enableHi10p'), false);
    }

    /**
     * Get or set 'Disable VBR audio encoding' state.
     * @param val - Flag to enable 'Disable VBR audio encoding' or undefined.
     * @return 'Disable VBR audio encoding' state.
     */
    disableVbrAudio(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('disableVbrAudio', val.toString());
            return toBoolean(this.get('disableVbrAudio'), false);
        }

        return toBoolean(this.get('disableVbrAudio'), false);
    }

    /**
     * Get or set 'Always remux FLAC audio files' state.
     * @param val - Flag to enable 'Always remux FLAC audio files' or undefined.
     * @return 'Always remux FLAC audio files' state.
     */
    alwaysRemuxFlac(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('alwaysRemuxFlac', val.toString());
            return toBoolean(this.get('alwaysRemuxFlac'), false);
        }

        return toBoolean(this.get('alwaysRemuxFlac'), false);
    }

    /**
     * Get or set 'Always remux MP3 audio files' state.
     * @param val - Flag to enable 'Always remux MP3 audio files' or undefined.
     * @return 'Always remux MP3 audio files' state.
     */
    alwaysRemuxMp3(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('alwaysRemuxMp3', val.toString());
            return toBoolean(this.get('alwaysRemuxMp3'), false);
        }

        return toBoolean(this.get('alwaysRemuxMp3'), false);
    }

    /**
     * Get or set the preferred video aspect ratio.
     * @param val - The aspect ratio or undefined.
     * @returns The saved aspect ratio state.
     */
    aspectRatio(val?: string): string {
        if (val !== undefined) {
            this.set('aspectRatio', val);
            return this.get('aspectRatio') || '';
        }

        return this.get('aspectRatio') || '';
    }

    set(name: string, value: string, userId?: string | null): void {
        const currentValue = this.get(name, userId);
        localStorage.setItem(this.#getKey(name, userId), value);

        if (currentValue !== value) {
            Events.trigger(this, 'change', [name]);
        }
    }

    get(name: string, userId?: string | null): string | null {
        return localStorage.getItem(this.#getKey(name, userId));
    }
}

export default new AppSettings();
