import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

// Cloudflare Web Analytics beacon (SPA tracking). Injected just before
// </body> on every HTML page of the production build ONLY — never in
// local dev (`vite`) or non-production builds (`--mode development`,
// `--mode preview`). Source index.html must stay beacon-free.
const CF_BEACON =
  "<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{\"token\": \"519b97ca534c48e6aff6d6298a48187f\", \"spa\": true}'></script><!-- End Cloudflare Web Analytics -->";

function cfBeaconProdOnly(): Plugin {
  let isProdBuild = false;
  return {
    name: 'cf-beacon-prod-only',
    apply: 'build',
    configResolved(config) {
      isProdBuild = config.command === 'build' && config.mode === 'production';
    },
    transformIndexHtml(html) {
      if (!isProdBuild) return html;
      if (html.includes('beacon.min.js')) return html; // exactly one beacon per page
      return html.replace('</body>', `${CF_BEACON}\n</body>`);
    },
  };
}

// GitHub Pages: served from /Wick/ until a custom domain is set,
// then switch base to '/'.
export default defineConfig({
  plugins: [preact(), cfBeaconProdOnly()],
  base: '/Wick/',
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
});
