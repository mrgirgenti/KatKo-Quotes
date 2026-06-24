// Type declaration for the platform-split htmlToPdf module.
// Metro resolves htmlToPdf.web.ts on web and htmlToPdf.native.ts on native at
// bundle time; TypeScript resolves the bare `@/utils/htmlToPdf` import here.
export declare function htmlToPdf(html: string, filename: string): Promise<void>;
