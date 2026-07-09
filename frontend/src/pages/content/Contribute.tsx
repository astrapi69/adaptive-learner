/**
 * /contribute — legacy redirect to /content (#1494).
 *
 * The community-contribution surface (the "Missing Lessons" gap section)
 * used to have its own page + primary-nav entry (#1149). Its normal state
 * was a single empty sentence, so a whole nav slot pointed at a mostly
 * blank page. The gap section ({@link ContentGapsSection}) now renders
 * inline on the {@link Content} page, in context with the downloaded sets
 * the gaps are derived from, and vanishes when there are no gaps.
 *
 * This route is kept ONLY so old links / bookmarks / shared URLs resolve:
 * it redirects to /content (``replace`` so /contribute leaves no history
 * entry the back button lands on).
 */

import { Navigate } from "react-router-dom";

export default function Contribute() {
  return <Navigate to="/content" replace />;
}
