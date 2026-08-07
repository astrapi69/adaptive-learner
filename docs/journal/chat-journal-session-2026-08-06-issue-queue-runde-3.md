# Chat-Journal 2026-08-06 - Issue-Queue Runde 3 (#2128-Schließung + Dead-CSS-Tranche)

Fortsetzung der Nachmittags-Session nach der #2182-Schließung (eigenes
Journal). Zwei Aufträge per Issue-Link: „dann weiter mit #2128" und
„dann weiter mit #1485".

## 1. #2128 geschlossen - der Set-Update-Datenverlust ist auf beiden Ebenen zu (17:50)

- Original prompt: „dann weiter mit: #2128" (Link auf das
  Data-Loss-Issue Set-Update verwaist Fortschritt/SRS).
- Ziel: den letzten offenen Stand des Issues abarbeiten.
- Ergebnis: Prämissen-Prüfung ergab, dass der Schließungs-Vorschlag vom
  Vormittag (10:06, „Rest unter #2130 führen") bereits überholt war:
  #2130 wurde um 12:13 selbst geschlossen - der Schlüsselwechsel
  Progress/SRS auf stable_id mit lokalem Remap ist gemergt (5f5269fd,
  PR #2455), dazu retired_ids-Konsum (#2458) und der Recovery-Fix für
  beide Schlüssel (#2469). Vor der Schließung im Code gegengelesen:
  syncUserRepo hält brechende Sets fail-closed zurück
  (content-repos.ts:391-399), die #2130-Migration schreibt exercise_id
  alt→neu um (element-errors-dexie.ts:282), Wächter + Remap-Angebot
  existieren. Schließungs-Kommentar mit Inventar-Tabelle; geschlossen
  als completed mit Wiedereröffnungs-Hinweis (Recurrence-Regel). Kein
  Code geändert, kein PR.
- Commit: keiner (Status-/Schließungsvorgang).

## 2. Dead-CSS-Tranche auf dem EXP-044-Umbrella (#1485 -> #2476, PR #2477) (18:20)

- Original prompt: „dann weiter mit: #1485".
- Ziel: nächste aktionierbare Tranche des Umbrellas ausführen - die am
  Mittag hinterlegte Dead-CSS-Karte aus #2452 (~305 Zeilen).
- Ergebnis: Karte vollständig abgearbeitet, -313 Zeilen,
  .css-size-baseline 7648 → 7335 (squash 64ba149c). Entfernt:
  26-auto-loop.css + 40-api-key-validation.css komplett samt Imports,
  der api-key/configured-provider-Block in 10-settings.css (331-493),
  Einzelregeln .metric-grid (bar), .onboarding-skip-top,
  .api-key-row-input/.model-override-row-input mobile,
  .chat-message-cursor. Grep-Pin mit 35 Selektoren in
  dead-selectors-removed.test.ts. Zwei Karten-Korrekturen aus der
  Re-Verifikation: nav-mode-badge-content/-ai-augmented sind LIVE via
  dynamischem Stamm nav-mode-badge-${mode} (NavIndicators.tsx:25);
  legacy-wrap-accepted ist die Allowlist-Datei, keine Klasse.
- Folgefund: das dead-classnames-Gate meldete nach der Entfernung
  is-invalid (CardEditor.tsx:333) als tot - zu Recht. Sein einziges
  CSS-Vorkommen war die entfernte Compound-Regel
  .api-key-test-result.is-invalid, die das Element nie treffen konnte;
  das Gate prüft Token-Existenz im gebauten CSS, nicht Treffbarkeit.
  Token entfernt, echtes Styling (border-[var(--error)]) + data-valid
  bleiben. Beleg, dass das Gate wirklich prüft.
- Gates: volle Frontend-Suite 8427/8427, styles 1177/1177, tsc +
  eslint clean; dispatchter Visual-Run 31114162478 = 0 Diffs als
  visual-baselines-unaffected-Evidenz (CSS-Inhalt zwischen Run-Commit
  und Merge-Head byte-identisch). Ein Plugin-Tests-Rot unterwegs war
  Runner-Infra (Set-up-job-Schritt), per Rerun grün. Zwischendrin
  mergte GitHub develop automatisch in den Branch (#2475, strict-Modus)
  - per Pull integriert, kein Force-Push.
- Commits: bc3ca19d + b3eac593 (PR #2477, squash 64ba149c);
  Umbrella-Vermerk auf #1485.

## Fragen und Annahmen

- Annahme bei #2128: der Nutzer-Auftrag per Issue-Link nach dem
  RM-Entscheidungsvorbehalt im letzten Kommentar wurde als Freigabe der
  vorgeschlagenen Schließung gelesen; die Schließung stützt sich
  zusätzlich auf den seit dem Vorschlag geschlossenen #2130.
- Karten-Korrektur #1485: die #2452-Karte ist mit dieser Tranche
  verbraucht; weitere Dead-CSS-Tranchen brauchen eine neue Audit-Karte.
