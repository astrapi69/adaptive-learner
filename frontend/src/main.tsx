import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import App from "./App";
import "./styles/global.css";

/**
 * Phase 11+: when deployed to a sub-path (e.g. GitHub Pages at
 * ``/adaptive-learner/``) React Router must prefix every route
 * with that same path or links resolve to the wrong absolute
 * URL. ``import.meta.env.BASE_URL`` is Vite's runtime mirror of
 * the ``base`` build option — ``/`` in local dev, ``/foo/`` on
 * a sub-path build. React Router's ``basename`` wants the path
 * WITHOUT the trailing slash, so trim it.
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Phase 39 C6 — dev-only axe-core accessibility audit. Logs
 * WCAG violations to the browser console on every render while
 * the dev server is running. Vite tree-shakes this branch out
 * of the production bundle entirely: ``import.meta.env.DEV``
 * is replaced with the literal ``false`` at build time, so the
 * dynamic ``import("@axe-core/react")`` becomes dead code.
 *
 * Verified by ``scripts/verify-no-axe-in-prod-bundle.sh`` and
 * the C6 audit recipe: ``grep -r "axe" dist/assets/*.js`` is
 * empty after ``npm run build``.
 */
if (import.meta.env.DEV) {
    void import("@axe-core/react").then(({default: axe}) => {
        axe(React, ReactDOM, 1000);
    });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
