/// <reference types="vite/client" />

// Build-time literal injected by Vite (see frontend/vite.config.ts
// `define`). Single source of truth: frontend/package.json.
declare const __APP_VERSION__: string;
declare const __BUILD_HASH__: string;
declare const __BUILD_DATE__: string;
// #1172 — deployment-strand provenance (branch built + explicit strand).
declare const __BUILD_BRANCH__: string;
declare const __BUILD_STRANG__: string;
