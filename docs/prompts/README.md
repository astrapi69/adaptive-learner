# Prompt-Bibliothek (#2742)

Wiederverwendbare Auftrags-Vorlagen für Claude-Code-Sessions. Eine Vorlage
verdrahtet die Pflichten (GITHUB-ISSUE-PFLICHT, PR-PFLICHT,
TESTPLAN-PFLICHT) und die Reihenfolge aus
`.claude/rules/ai-workflow/implementation-workflow.md` vor, damit ein
Auftrag auf den Schienen startet statt sie pro Session neu zu erfinden.

## Nutzung

1. Vorlage kopieren, `{Platzhalter}` ausfüllen, als Session-Prompt geben.
2. Nichts aus der Vorlage streichen: die Pflicht-Blöcke SIND der Zweck.
3. Fehlt eine Vorlage für eine wiederkehrende Aufgabenform: hier ergänzen
   (eigene Docs-PR, #2578-Scope).

## Vorlagen (wiederkehrende Aufgabenformen)

| Datei | Aufgabenform |
|---|---|
| [template-bugfix.md](template-bugfix.md) | Bug beheben (Issue-first, Red-Green, Regressions-Pin) |
| [template-neuer-endpoint.md](template-neuer-endpoint.md) | Neuer API-Endpoint im Core |
| [template-neuer-plugin-service.md](template-neuer-plugin-service.md) | Neue Funktion in einem bestehenden Plugin |
| [template-i18n-batch.md](template-i18n-batch.md) | Übersetzungs-Batch über alle Kataloge |

## Einmal-Prompts (projektspezifische Großaufträge)

| Datei | Inhalt |
|---|---|
| [cc-prompt-adaptive-learner-feature-strategy.md](cc-prompt-adaptive-learner-feature-strategy.md) | @astrapi69/feature-strategy-Integration |
| [cc-prompt-clean-code-refactoring.md](cc-prompt-clean-code-refactoring.md) | God-File-/Tech-Debt-Abbau nach Audit |

## Archiv

`archive/` hält historische Session-Handover (Zeitpunkt-Dokumente, keine
Vorlagen). Nicht als Startpunkt neuer Aufträge verwenden.
