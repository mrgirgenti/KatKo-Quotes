import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const FOCUS_RESET_CSS =
  '*{outline:none!important;-webkit-tap-highlight-color:transparent!important;}' +
  '*:focus,*:focus-visible,*:focus-within{outline:none!important;box-shadow:none!important;}' +
  '*:not(input):not(textarea):not(select):hover{box-shadow:none!important;}' +
  '::-moz-focus-inner{border:0!important;}' +
  // Explicit targets: root containers, RN-web div wrappers, ScrollViews, and any
  // element with tabIndex. These are all already covered by the *:focus rule above
  // but adding them by name ensures specificity wins even if an injected stylesheet
  // adds a more-specific rule later. Keep real form controls (input/textarea/select)
  // out of these to preserve their native/custom focus styling.
  'html,body,#root,#__next{height:100%;margin:0;padding:0;}' +
  'html,body,#root,#__next{outline:none!important;box-shadow:none!important;}' +
  'div:focus,div:focus-visible,[tabindex]:focus,[tabindex]:focus-visible{outline:none!important;box-shadow:none!important;}' +
  '[data-rnw-scrollview]:focus,[data-rnw-scrollview]:focus-visible{outline:none!important;box-shadow:none!important;}' +
  // Safari does not support scrollbar-width:none (Firefox/Chrome only).
  // Suppress WebKit scrollbar tracks here — in the SSR <head> so it applies
  // before first paint, preventing any blue scrollbar track flash.
  '*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}' +
  '*::-webkit-scrollbar-track{background:transparent!important;}' +
  '*::-webkit-scrollbar-thumb{background:transparent!important;}' +
  '*::-webkit-scrollbar-corner{background:transparent!important;}';

// App-wide 90% zoom. This MUST live in the SSR <head> so it applies on the very
// first paint. Previously it was set in a post-hydration useEffect
// (document.documentElement.style.zoom = '0.9'), which made every page render at
// 100% and then visibly snap down to 90% — most noticeable on the portal's
// single centered login card ("large → small" resize flash). Declaring it here
// removes the flash entirely.
const APP_ZOOM_CSS = 'html{zoom:0.9;}';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: APP_ZOOM_CSS }} />
        <style dangerouslySetInnerHTML={{ __html: FOCUS_RESET_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
