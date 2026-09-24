/// <reference types="vite/client" />

// No custom VITE_* keys: the Cloudflare beacon token is injected at build
// time from the CF_BEACON_TOKEN repository variable (see vite.config.ts),
// and the share URL is derived from window.location at runtime.
