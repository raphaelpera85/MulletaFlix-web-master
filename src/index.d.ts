declare module 'jquery';

declare module '*.png' {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value: any;
    export = value;
}

declare module '*.html' {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value: any;
    export default value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const ApiClient: any;
