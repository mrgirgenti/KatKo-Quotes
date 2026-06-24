// Native stub. On iOS/Android the app uses expo-print + expo-sharing instead of
// the browser-based html2canvas/jsPDF pipeline, so this should never be called.
export async function htmlToPdf(_html: string, _filename: string): Promise<void> {
  throw new Error('htmlToPdf is web-only; use expo-print on native platforms.');
}
