/// <reference types="vite/client" />

// No custom VITE_* keys: analytics is the Cloudflare beacon tag (SPA
// tracking) injected just before </body> by vite.config.ts for the
// production build only, and the share URL is derived from window.location at runtime.
