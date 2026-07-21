declare module 'headroom.js' {
    class Headroom {
        constructor(element: HTMLElement, options?: Record<string, unknown>);
        init(): void;
        destroy(): void;
    }
    export default Headroom;
}
