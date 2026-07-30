# Chat-Journal Session 2026-07-30 - Launcher image mode (CC lane)

Lane: launcher / publishing chain (#2110). Parallel session (CCW) owns content-update guard, translations, ja/ko/zh recovery - untouched here.

## 1. Migration proof repeated with REAL volumes (release condition for Teil 4)

- Original prompt: repeat the dockerfile->image migration proof after #2155 changed the volume name; prove volume names via the actual volume list, prove the conflict guard against a real docker client.
- Goal: release Teil 4 of #2110.
- Result: GREEN, documented in #2110 (comment). Phase A: real conflict case with production volume names - the shipped #2154 guard stops and quantifies both sides (7 vs 2 entries), reads volumes ro, June volume checksum byte-identical before/after. Phase B: probe compose project -> compose creates the prefixed volume (observed via `docker volume ls` diff, exactly one new volume) -> dockerfile-mode `actions.install` (real build, health-verified) -> image-mode install from a throwaway registry:2; same named volume mounted in every step (docker inspect), marker + Fernet secret.key + secrets.yaml byte-identical, no second volume ever. Run on docker-app-launcher 0.23.0 AND repeated on 0.24.0 after the upstream release landed mid-session.
- Noted: one anonymous volume appeared mid-proof; inspected ro it is a docker-in-docker `/var/lib/docker` artifact of a concurrent process, not from the proof chain (nothing mounts it, no VOLUME in backend/Dockerfile).
- Commit: none (operational proof, no code change - documented as issue comment).

## 2. image-size-measure.yml could never measure (#2163, PR #2164)

- Original prompt: (own lane leftover) seed the arm64 ceiling; the measurement workflow existed but had never run.
- Result: first-ever dispatch (run 30531619694) landed on amd64 for arch=arm64 - the native assert refused, fail-closed. Cause: `runs-on: ${{ inputs.arch == 'arm64' && 'ubuntu-24.04-arm' && 'ubuntu-latest' }}` - two `&&`, no `||`; GitHub expressions return the last truthy operand, so every arch got ubuntu-latest (and amd64 evaluated to `false`). Fix: `|| 'ubuntu-latest'`. Regression test evaluates the expression with GitHub's operator semantics and asserts the EFFECT (which runner each arch reaches), RED against the broken form. Merged.
- Commit: 15849953 (PR #2164, squash-merged).

## 3. arm64 ceiling seeded (PR #2166)

- Result: measurement re-dispatched from the fixed branch - run 30532123506, native ubuntu-24.04-arm (aarch64 asserted), 124716686 bytes gzip -1 (~119 MB; amd64 ceiling 125602358). Entered as `per_arch.arm64` in `.image-size-baseline.json` in its own commit citing the run (#2140 separation: the workflow reports, a human enters). `_per_arch_note` updated - it truthfully said arm64 was unmeasured. 18 gate tests green. Merged.
- Commit: b35a9732 (PR #2166, squash-merged).

## 4. Teil 4: launcher switched to image mode (#2165, PR #2167)

- launcher.json: `deployment_mode: "image"`, `image_reference: ghcr.io/astrapi69/adaptive-learner:2.6.1`, build-path fields removed. Tag-vs-digest decided: TAG (the digest does not exist at commit time - publish pushes after the release commit; tags are pushed once and never moved; digest recorded by the publish run). Documented in `_image_reference_note`.
- Wrapper: frozen standalone image-mode run downloads NO source tree (the #2054 bootstrap stays for dockerfile/compose) and anchors in the launcher's config dir; `deployment_assets` learns image mode incl. the optional `image_archive` resolution base (upstream #78).
- Pin `docker-app-launcher ^0.24.0` + relock (0.24.0 landed on PyPI mid-session: compose --force-recreate fix, --update, CLI contract, wizard).
- sync-versions now rewrites the image_reference tag alongside app_version; `--check` fails on a drifted tag (proven red against 0.0.0).
- Tests: launcher suite 82 passed (was 73).
- Frozen contract on the built artifact: `--version` 2.6.1, `--verify-bundle` complete, `--status` from an empty dir with isolated HOME answers with NO source download and creates the anchor dir.
- Binary size honestly: 23012776 -> 28188864 bytes. The expected shrink from dropping the build context did not materialize because the bundle never carried the context (it was a runtime download, which image mode removes); the +5.2 MB is the 0.24.0 engine (wizard, CLI contract, docs). What image mode removes is the ~200 MB runtime source download and the on-device build.
- Commits: 6dc1f632 + 4391fd6d (PR #2167, squash-merged as 6760596d).
- Follow-up on Aster's review mid-session ("errors and exceptions are being swallowed, or at least log them"): every fail-soft path in the wrapper now names its reason on stderr - unreadable/malformed/non-object bundled config, uncreatable anchor dir (falls back to CWD instead of a raw traceback), crashed volume-conflict guard ("no conflict found" and "could not look" printed identically before), failed anchored-config write. Six pinning tests; suite at 88. Commit: 4391fd6d (same PR, new commit - no amend on an open PR).

## 5. Engine issue registered (learn-content-engine#90)

- From the prepared basis (#2130 + EXP-045), no new invention: schema-enforced, author-owned, version-stable `stable_id` on exercises/cards (present, set-wide unique, version-stable) + validation; retrofit need named per content class (author sets: mechanical backfill; AI/book sets: positional ids -> generators must mint stable ids, estimated separately); app-side #2128 mitigation named as tourniquet, not solution. Implementation explicitly out of scope there.

## Housekeeping

- 27 stale worktrees of merged branches pruned (wt-*); 6 kept deliberately (unmerged or dirty: wt-bump20, wt-consolidate, wt-ghcr, wt-hotfix, wt-mode, wt-oldengine, wt-quarantine).
- June volume (`adaptive-learner_adaptive-learner-data`) untouched, checksum-verified twice.

## Questions and assumptions

- The Teil-4 prompt expected a measurable binary shrink; evidence contradicted the premise (bundle never carried the context). Reported honestly instead of forcing a shrink.
- Anonymous dind volume left in place - possibly the parallel session's; not mine to delete.
- GHCR feedback to the launcher repo (reference + digest) is pending the FIRST real publish, which happens with the next release - noted in the final report, not actionable earlier.

## Session statistics

- PRs: #2164 (runs-on fix, merged), #2166 (arm64 ceiling, merged), #2167 (Teil 4, squash-merged as 6760596d), journal PR.
- Issues: #2163 filed + closed, #2165 filed + closed, learn-content-engine#90 filed; proof documented on #2110.
- Tests: launcher suite 73 -> 88; backend gate tests 18 green against the seeded baseline; RED proofs for the runs-on regression test and the sync drift check.
- Binaries (develop, merge commit 6760596d): launcher-linux run 30533859877, launcher-windows run 30533860201, launcher-macos run 30533860154; artifact retention 14 days.
- Pending for the next release: first real GHCR publish (publish-image.yml on release: created) - after it, feed the published reference + digest back to the launcher repo (docker-app-launcher upstream measurement waits on it).
