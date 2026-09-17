/**
 * Shared prop contract of the game-mode detail blocks (#2959).
 */

export interface PlayfulBlockProps {
    /**
     * The master "Playful lessons" switch is OFF: every control in the
     * block renders disabled (#335 visible-but-disabled, never hidden).
     * The pref gates (``playful*Active()``) AND ``readPlayfulMode()``, so
     * the controls would have no effect anyway; disabling says so.
     */
    disabled: boolean;
}
