# Chat-Journal 2026-09-17: Release v2.15.0

## 1. Release v2.15.0 (Impressum und Datenschutz öffentlich)

- Original prompt: "Voller release", "vor dem release alle deps updaten vor allem die engine", "wir hatten doch vereinbart das alles auf gh-actions läuft".
- Optimized prompt: "v2.15.0 über release-prepare.yml und release-finish.yml auf Actions veröffentlichen, vorher den Patch/Minor-Dependency-Sweep mergen; Majors bewerten und als Issues ablegen, nicht bündeln."
- Goal: Die Rechtsseiten aus #3114 (Impressum, Datenschutzerklärung) erreichen die öffentliche Seite, die nur bei einem Release deployt.
- Result:
  - Dependency-Sweep #3144 (#3143): Patch/Minor in Backend, 14 Plugin-Locks, Launcher, Docs, Frontend; learn-content-engine war mit 0.26.0 bereits aktuell. Majors bewertet und abgelegt: anthropic 1.x (#3148), openai 3.x (#3149), TypeScript 7 (#3150), Tooling-Majors (#3151).
  - Test-Isolation #3146 (#3145): pytest pinnte `ADAPTIVE_LEARNER_CACHE_DIR` nicht und löschte bei jedem Lauf den echten `~/.cache/adaptive_learner/content-loader`; parallele Läufe brachen sich gegenseitig vier Tests. Neuer Guard `backend/tests/test_pytest_path_isolation.py`. Folge-Issues #3147 und #3152 (Tests mit echten Netzaufrufen).
  - Release-Branch mit Version-Bump, Notes (zwei unabhängige Prüfrunden gegen Code und Commits) und README-Status. Das Prepare-Gate fand zwei veraltete Dexie-Specs nach #3138/#3136 (#3153), gefixt auf dem Release-Branch.
  - release-finish.yml taggte main (921cc9a5a), veröffentlichte das Release aber sofort und ohne Back-Merge-PR (#3159); Release zurück auf Entwurf, Back-Merge #3154 von Hand.
  - Image-Publish vom Tag scheiterte an arm64-Size-Ceiling (#3156, PR #3158) und Page-Walker-Chunk `set-review` (#3155, PR #3157); danach von develop grün (Run 35203895138), Digest identisch zu `image-digest.txt`.
  - Release um 11:16 veröffentlicht, 7 Assets. Pages-Deploy: `/docs/legal/imprint/` und `/docs/legal/privacy/` (DE und EN) liefern 200.
- Commit: 921cc9a5a (Release v2.15.0)

## Summary

- Release v2.15.0, dazu 5 PRs (#3144, #3146, #3154, #3157, #3158) und 12 Issues (#3143, #3145, #3147 bis #3153, #3155, #3156, #3159).
- Testzahlen nach dem Release: Backend 1858, Plugins 1137, Vitest 10438 (`docs/audits/current-coverage.md`).
- Abweichung vom Ablauf: Die Gates liefen zuerst lokal statt auf Actions, das kostete Zeit; ab dem Prepare-Gate lief alles über die Workflows.
