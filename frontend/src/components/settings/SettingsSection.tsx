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
 * restore).
 */
import { forwardRef } from "react";
import type { ReactNode, CSSProperties } from "react";

export interface SettingsSectionProps {
  /** Heading text/content. Omit for the rare section with no title. */
  title?: ReactNode;
  /** `data-testid` on the `<section>` root. */
  testid?: string;
  /** Extra classes merged onto the `<section>` root (e.g. `mt-6`). */
  className?: string;
  /** Extra inline styles merged onto the `<section>` root. */
  style?: CSSProperties;
  /** Extra classes merged onto the `<h2>` title. */
  titleClassName?: string;
  /** Extra inline styles merged onto the `<h2>` title. */
  titleStyle?: CSSProperties;
  /** Passed straight through to the `<section>` (e.g. the Dexie-only gate). */
  hidden?: boolean;
  /** `id` on the `<section>` root, when a consumer needs to anchor to it. */
  id?: string;
  children?: ReactNode;
}

/**
 * Renders a Settings card: `<section class="settings-section">` with an
 * optional `<h2 class="settings-section-title">` and the given children.
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
    {
      title,
      testid,
      className,
      style,
      titleClassName,
      titleStyle,
      hidden,
      id,
      children,
    },
    ref,
  ) {
    const sectionClassName = className
      ? `settings-section ${className}`
      : "settings-section";
    const titleClass = titleClassName
      ? `settings-section-title ${titleClassName}`
      : "settings-section-title";

    return (
      <section
        ref={ref}
        id={id}
        className={sectionClassName}
        style={style}
        data-testid={testid}
        hidden={hidden}
      >
        {title !== undefined && (
          <h2 className={titleClass} style={titleStyle}>
            {title}
          </h2>
        )}
        {children}
      </section>
    );
  },
);
