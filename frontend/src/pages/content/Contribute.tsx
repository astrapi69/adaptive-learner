/**
 * /contribute — legacy redirect to /content (#1494, #1504).
 *
 * The community-contribution surface used to have its own page + primary-nav
 * entry (#1149), then the gap suggestions moved inline onto /content
 * (#1494). #1504 removed the dynamic gap list entirely (it surfaced language
 * pairs unrelated to the learner); helping the library grow is now a static
 * block in Settings > About. /content still hosts the user's own
 * contribution history.
 *
 * This route is kept ONLY so old links / bookmarks / shared URLs resolve:
 * it redirects to /content (``replace`` so /contribute leaves no history
 * entry the back button lands on).
 */

import { Navigate } from "react-router-dom";

export default function Contribute() {
  return <Navigate to="/content" replace />;
}
