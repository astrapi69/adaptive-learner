/**
 * Heading level for Settings cards (#2966).
 *
 * A `SettingsSection` card renders its title as `<h2>` when it stands on
 * its own tab; inside a `SettingsCluster` (whose group heading is the
 * `<h2>`) the card title has to step down to `<h3>` so the outline stays
 * a tree. The cluster provides this context and every card inside reads
 * it, so the ~20 controls that render a `SettingsSection` never have to
 * know whether they sit in a cluster. An explicit `headingLevel` prop on
 * the card wins over the context.
 */
import { createContext } from "react";

/** The heading levels a Settings card title can render as. */
export type SettingsHeadingLevel = 2 | 3;

/** Default heading level for a card: `<h2>` outside any cluster. */
export const SettingsHeadingLevelContext = createContext<SettingsHeadingLevel>(2);
