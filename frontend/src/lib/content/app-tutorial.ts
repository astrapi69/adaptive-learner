/**
 * The bundled "Adaptive Learner — App-Tutorial" set (#1572 follow-up).
 *
 * A single source for the tutorial set's id + its in-app deep-link route,
 * so UI surfaces (Settings › About, and any future entry points) link to
 * the tutorial without hardcoding the slug. The set is official/bundled, so
 * the direct ``/content/set/:setId`` deep link opens it with no repo to add.
 */

/** Id of the bundled App-Tutorial set (source of truth: the content repo manifest). */
export const APP_TUTORIAL_SET_ID = "adaptive-learner-app-from-de";

/** In-app route that opens the App-Tutorial set directly. */
export const APP_TUTORIAL_PATH = `/content/set/${APP_TUTORIAL_SET_ID}`;
