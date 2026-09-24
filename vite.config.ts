import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

// Privacy-safe analytics injection: the Cloudflare beacon token lives only in
// the CF_BEACON_TOKEN repository variable (never in source). When unset
// (local dev, forks, PRs from outside), the whole beacon tag is left out.
function cfBeacon(): Plugin {
  return {
    name: 'cf-beacon',
    transformIndexHtml(html) {
      const raw = (process.env.CF_BEACON_TOKEN ?? '').trim();
      if (!/^[A-Za-z0-9]{1,128}$/.test(raw)) {
        return html.replace(/<script[^>]*static\.cloudflareinsights\.com\/beacon\.min\.js[^>]*><\/script>\n?/, '');
      }
      return html.replace('%%CF_BEACON_TOKEN%%', raw);
    },
  };
}

// GitHub Pages: served from /wick/ until a custom domain is set,
// then switch base to '/'.
export default defineConfig({
  plugins: [preact(), cfBeacon()],
  base: '/wick/',
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
});
