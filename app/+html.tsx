import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: [
              '*{-webkit-tap-highlight-color:transparent!important;outline:none!important;}',
              '*:focus,*:focus-visible,*:focus-within{outline:none!important;box-shadow:none!important;}',
              '::-moz-focus-inner{border:0!important;}',
              'html,body{outline:none!important;}',
            ].join(''),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
