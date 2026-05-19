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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
