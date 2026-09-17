/**
 * TabBar — the shared tab bar of the Content, Dashboard and Progress hubs
 * (#3012).
 *
 * Before this component each of the three bars had its own behaviour when
 * the tabs ran out of room: Content wrapped (decided in #989 against a
 * viewport overflow), Progress and Dashboard squeezed their tabs, and only
 * Content's behaviour had ever been chosen on purpose. The other two were
 * unauffällig by luck: a longer translation or one more tab tipped them
 * with no defined way out.
 *
 * Measured on the German labels (the app's default language, and the
 * longest set), Chromium at phone widths:
 *
 * | padding / font | 3 tabs  | 4 tabs  | 3 fit from | 4 fit from |
 * |----------------|---------|---------|------------|------------|
 * | 32px / 14px    | 354,4px | 451,6px | 390px      | never      |
 * | 16px / 12px    | 270,6px | 343,1px | 320px      | 390px      |
 *
 * Hence: compact on phones (``px-2 text-xs``), roomy from ``sm`` up. Three
 * tabs then fit on one line at EVERY phone width — today the Content bar
 * wraps at 375px and below, unnoticed, because a clean second line looks
 * like intent.
 *
 * The gap is narrow on phones too: four tabs at 375px land within 0,1px of
 * the available width at ``gap-1``, which is inside rounding and font-metric
 * noise. ``gap-0.5`` buys ~6px of headroom exactly where it is needed.
 *
 * Where even the compact bar runs out of room (four tabs at 320px) it
 * wraps, per #989 — never scrolls: tabs you can only reach by swiping are
 * worse than a second line. The bar carries no ``overflow-x``, so the
 * no-horizontal-scroll gate keeps measuring it rather than skipping it.
 *
 * @example
 * <TabBar
 *   tabs={[{id: "my", label: "Meine Inhalte"}]}
 *   active={active} onSelect={selectTab}
 *   ariaLabel={t("nav.tab.content", "Content")}
 *   testId="content-hub-tabs" tabTestIdPrefix="content-tab-"
 * />
 */

export interface TabBarEntry<T extends string = string> {
  id: T;
  label: string;
}

export interface TabBarProps<T extends string = string> {
  tabs: readonly TabBarEntry<T>[];
  /** The selected tab; exactly one tab reports ``aria-selected``. */
  active: T;
  onSelect: (id: T) => void;
  /** Accessible name of the tablist. */
  ariaLabel: string;
  testId: string;
  /** Each tab's testid is this prefix plus its id. */
  tabTestIdPrefix: string;
  /** Outer spacing owned by the host (e.g. ``mb-4``, ``px-4 pt-3``). */
  className?: string;
}

export default function TabBar<T extends string = string>({
  tabs,
  active,
  onSelect,
  ariaLabel,
  testId,
  tabTestIdPrefix,
  className = "",
}: TabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-testid={testId}
      className={`flex flex-wrap gap-0.5 border-b border-border sm:gap-1 ${className}`.trim()}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.id)}
            data-testid={`${tabTestIdPrefix}${tab.id}`}
            className={`min-h-[44px] rounded-t-app px-2 text-xs font-medium sm:px-4 sm:text-sm ${
              isActive
                ? "border-b-2 border-accent text-accent"
                : "text-fg-muted hover:text-fg-primary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
