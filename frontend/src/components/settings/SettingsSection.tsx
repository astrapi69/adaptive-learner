/**
 * SettingsSection — the shared Settings card wrapper (EXP-044 Option C, #1485).
 *
 * Every Settings tab renders its groups as a `.settings-section` card with a
 * `.settings-section-title` heading. Before this component the JSX for that
 * shell (`<section className="settings-section" data-testid="...">` +
 * `<h2 className="settings-section-title">`) was hand-duplicated across ~30
 * files. This component centralizes it so the shell can't be dropped or
 * drift per-file again (the class of bug #1465/#1484 fixed one at a time).
 *
 * Deliberately still emits the legacy `.settings-section` / `.settings-
 * section-title` classnames underneath. They cannot be deleted or replaced
 * with inline utilities: `@astrapi69/ai-key-vault-react` renders BOTH
 * classnames from `node_modules` (headless-styled pattern, the #2477
 * incident class — found by the package-aware consumer check, #2725), so
 * they are a styling contract with that package until it ships its own
 * styles. Their rules live in `styles/legacy/10-settings.css` inside
 * `@layer legacy` (#2725), so Tailwind utilities passed via `className`
 * win over them. `className`/`style` on the section and
 * `titleClassName`/`titleStyle` on the heading exist so today's few
 * consumer-specific overrides (DangerZoneSection's red border, HelpBrowser's
 * inline-flex title) keep working unchanged through the extraction. Forwards
 * its ref to the `<section>` root (BackupSection scrolls to it after a
 * restore); every other `<section>` attribute (`style`, `hidden`, `id`,
 * `aria-busy`, ...) passes straight through via rest props.
 *
 * The title's heading level is `<h2>` on its own, `<h3>` inside a
 * `SettingsCluster` (read from `SettingsHeadingLevelContext`, #2966) and
 * whatever an explicit `headingLevel` prop says; the classname contract
 * above is the same at every level.
 */
import { forwardRef, useContext } from "react";
import type { ComponentPropsWithoutRef, ReactNode, CSSProperties } from "react";

import { SettingsHeadingLevelContext } from "./settings-heading-level";
import type { SettingsHeadingLevel } from "./settings-heading-level";

export interface SettingsSectionProps
  extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  /** Heading text/content. Omit for the rare section with no title. */
  title?: ReactNode;
  /** `data-testid` on the `<section>` root. */
  testid?: string;
  /** Extra classes merged onto the `<h2>` title. */
  titleClassName?: string;
  /** Extra inline styles merged onto the `<h2>` title. */
  titleStyle?: CSSProperties;
  /** Title heading level; defaults to the surrounding cluster's level (2 outside a cluster, 3 inside). */
  headingLevel?: SettingsHeadingLevel;
}

/**
 * Renders a Settings card: `<section class="settings-section">` with an
 * optional `<h2 class="settings-section-title">` (an `<h3>` inside a
 * cluster) and the given children.
 *
 * @example
 * ```tsx
 * <SettingsSection title={t("settings.section_profile", "Profile")} testid="settings-section-profile">
 *   <ProfileForm />
 * </SettingsSection>
 * ```
 */
export const SettingsSection = forwardRef<HTMLElement, SettingsSectionProps>(
  function SettingsSection(
    { title, testid, className, titleClassName, titleStyle, headingLevel, children, ...rest },
    ref,
  ) {
    const contextLevel = useContext(SettingsHeadingLevelContext);
    const Heading = (headingLevel ?? contextLevel) === 3 ? "h3" : "h2";
    const sectionClassName = className
      ? `settings-section ${className}`
      : "settings-section";
    const titleClass = titleClassName
      ? `settings-section-title ${titleClassName}`
      : "settings-section-title";

    return (
      <section
        ref={ref}
        className={sectionClassName}
        data-testid={testid}
        {...rest}
      >
        {title !== undefined && (
          <Heading className={titleClass} style={titleStyle}>
            {title}
          </Heading>
        )}
        {children}
      </section>
    );
  },
);
