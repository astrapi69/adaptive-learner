# Frozen official content (#3745)

The visual run serves these files instead of the live official content
repository (`raw.githubusercontent.com/astrapi69/adaptive-learner-content/main/`),
through `pinOfficialContent` in `../../helpers.ts`. Every surface used to
request them live: the root `manifest.yaml` and `search-index.json` on every
surface, and the `en/fr-a1` set that `seedLearner` downloads. So a content
change outside this repository changed baselines (the content-discover drift
of #3745).

- Source: `astrapi69/adaptive-learner-content`
- Commit: `5962a1588d6206e38e4a0802e9abd0398aabcbd2` (2026-10-13, "chore(engine):
  pin 0.42.0; LESSON-FORMAT documents the evaluation block (#256)")
- Taken: 2026-10-28, byte for byte with `git show <commit>:<path>`. Nothing is
  hand-edited, so the files keep the producer's real shape.

A request to that repository for a file not in this folder is not answered
here. It reaches the external-request guard (`guardExternalRequests`), which
aborts it and fails the test, naming the URL. A new file the app starts to
fetch therefore fails its first visual run instead of drifting.

To move to a newer content state (a deliberate baseline change, reviewed like
any other):

```bash
SHA=<commit of adaptive-learner-content>
cd e2e/visual/fixtures/official-content
for p in $(find . -type f ! -name SOURCE.md | sed 's#^\./##'); do
  git -C <path-to>/adaptive-learner-content show "$SHA:$p" > "$p"
done
```

Then update the commit above, regenerate the baselines in CI (label
`refresh-visual-baselines`) and review every changed PNG.
