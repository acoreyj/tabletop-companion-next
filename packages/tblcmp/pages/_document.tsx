import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Add cache control meta tag for browsers that respect it */}
        <meta
          httpEquiv="Cache-Control"
          content="public, max-age=86400, stale-while-revalidate=86400"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
