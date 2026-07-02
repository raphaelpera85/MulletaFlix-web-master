import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

let originalCreateElement: any;
let originalCreateElementNS: any;
let originalHTMLDocCreateElement: any;
let originalHTMLDocCreateElementNS: any;
let originalDocCreateElement: any;
let originalDocCreateElementNS: any;

const mockCreateElement = vi.fn().mockImplementation(function (tagName: string, options?: any) {
    return { tagName, options };
});
const mockCreateElementNS = vi.fn().mockImplementation(function (namespace: string, tagName: string, options?: any) {
    return { namespace, tagName, options };
});

describe('patchCreateElement polyfill patch', () => {
    beforeAll(async () => {
        originalCreateElement = Document.prototype.createElement;
        originalCreateElementNS = Document.prototype.createElementNS;
        
        Document.prototype.createElement = mockCreateElement;
        Document.prototype.createElementNS = mockCreateElementNS;

        if (typeof HTMLDocument !== 'undefined') {
            originalHTMLDocCreateElement = HTMLDocument.prototype.createElement;
            originalHTMLDocCreateElementNS = HTMLDocument.prototype.createElementNS;
            HTMLDocument.prototype.createElement = mockCreateElement;
            HTMLDocument.prototype.createElementNS = mockCreateElementNS;
        }

        originalDocCreateElement = document.createElement;
        originalDocCreateElementNS = document.createElementNS;
        document.createElement = mockCreateElement;
        document.createElementNS = mockCreateElementNS;

        await import('./patchCreateElement');
    });

    beforeEach(() => {
        mockCreateElement.mockImplementation((tagName: string, options?: any) => {
            return { tagName, options };
        });
        mockCreateElementNS.mockImplementation((namespace: string, tagName: string, options?: any) => {
            return { namespace, tagName, options };
        });
    });

    afterAll(() => {
        Document.prototype.createElement = originalCreateElement;
        Document.prototype.createElementNS = originalCreateElementNS;

        if (typeof HTMLDocument !== 'undefined') {
            HTMLDocument.prototype.createElement = originalHTMLDocCreateElement;
            HTMLDocument.prototype.createElementNS = originalHTMLDocCreateElementNS;
        }

        document.createElement = originalDocCreateElement;
        document.createElementNS = originalDocCreateElementNS;
    });

    it('should intercept createElement and normalize options parameter', () => {
        mockCreateElement.mockClear();

        // Test normal call
        document.createElement('div');
        expect(mockCreateElement).toHaveBeenCalledWith('div');

        // Test call with string parameter (Custom Elements V0)
        document.createElement('div', 'emby-scroller' as any);
        expect(mockCreateElement).toHaveBeenCalledWith('div', 'emby-scroller');

        // Test call with object parameter (React 18 / Custom Elements V1)
        const result = document.createElement('div', { is: 'emby-scroller' });
        expect(mockCreateElement).toHaveBeenCalledWith('div', 'emby-scroller');
        expect(result).toEqual({ tagName: 'div', options: 'emby-scroller' });
    });

    it('should intercept createElementNS and normalize options parameter', () => {
        mockCreateElementNS.mockClear();

        // Test normal call
        document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        expect(mockCreateElementNS).toHaveBeenCalledWith('http://www.w3.org/1999/xhtml', 'div');

        // Test call with object parameter
        const result = document.createElementNS('http://www.w3.org/1999/xhtml', 'div', { is: 'emby-scroller' });
        expect(mockCreateElementNS).toHaveBeenCalledWith('http://www.w3.org/1999/xhtml', 'div', 'emby-scroller');
        expect(result).toEqual({ namespace: 'http://www.w3.org/1999/xhtml', tagName: 'div', options: 'emby-scroller' });
    });
});
