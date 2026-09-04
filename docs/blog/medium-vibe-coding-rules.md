# The Rules of Vibe Coding: How to Use AI Without Losing Control

Vibe coding is productive. You describe what you want, the AI writes it, and features ship fast. But without discipline,
you are building a codebase that nobody understands, nobody can maintain, and nobody has verified.

This is the follow-up
to [Your Code Coverage Is Lying to You](https://asterios-raptis.medium.com/your-code-coverage-is-lying-to-you-heres-how-to-fix-it-f3c4bcf00a66).
That article established that TDD is non-negotiable, even when AI writes the code. This one goes further: here are the
rules that make vibe coding sustainable, drawn from a real production project where every line of code is AI-assisted
and every rule exists because something went wrong without it.

These rules are public. You can read the full rule set in
the [adaptive-learner repository](https://github.com/astrapi69/adaptive-learner) under `.claude/rules/`. What follows is
the distilled version, with the reasoning behind each rule.

## Rule 1: Prompt Precision

The most common vibe coding failure is vague prompts that produce plausible but wrong code. The fix is not better AI
models. It is better prompts.

Reference existing patterns instead of letting the AI reinvent them. Name the file, the function, the expected behavior.
"Add a new endpoint" is a bad prompt. "Add a GET endpoint in `routes.py` that delegates to
`session_service.get_session()`, following the same pattern as `get_project_endpoint` in `project_routes.py`" is a good
one.

The AI does not know your codebase unless you tell it. Every prompt should anchor the AI in what already exists. This
prevents architectural drift, where the AI introduces a second way of doing something that already has an established
pattern.

## Rule 2: Layer Architecture Is Not Optional

AI loves to put everything in one place. Business logic in route handlers. Database queries in components. Fetch calls
scattered across the frontend. Without a strict architecture rule, vibe-coded projects degrade into unmaintainable
god-files within weeks.

Define your layers and enforce them:

- **Router** handles HTTP, validates input, delegates to a service, returns the response. No business logic.
- **Service** contains business logic, orchestration, validation. No HTTP concepts, no direct database access.
- **Repository** handles data access. No domain logic.
- **Models** define the data structure. Nothing else.

The dependency direction is always: Router -> Service -> Repository -> Models. The AI must follow this in every
generated file. If it produces a route handler with a database query inside, that is a rejection, not a shortcut.

## Rule 3: TDD Is Mandatory for Every Behavior Change

This was covered in the previous article, but the specifics matter for vibe coding.

Every code change with logic follows Red-Green-Refactor. "With logic" means a new behavior, a changed code path, a
condition, a calculation, a validation, a mapping. The test comes first. The implementation comes second. The
refactoring comes third.

The target for a real feature or fix is at least four tests:

1. **Reproduction test** - the Red test before the fix or feature exists
2. **Happy path** - the expected normal case
3. **Edge cases** - empty, missing, or unexpected inputs
4. **Boundary values** - the edges of the valid range

Bug fixes always start with a test that reproduces the bug. This test stays in the repo as a regression guard. No fix
without an understood cause.

### Parameterized Tests Close the Gaps

Four separate test methods for four cases is fine. But parameterized tests do it better: one method, many cases, less
boilerplate, and systematic boundary coverage instead of accidental coverage.

```java

@ParameterizedTest
@CsvSource({
        "0, true",
        "17, true",
        "18, false",
        "19, false",
        "-1, true"
})
void isMinor(int age, boolean expected) {
    assertEquals(expected, Person.isMinor(age));
}
```

```python
@pytest.mark.parametrize("age, expected", [
    (0, True),
    (17, True),
    (18, False),
    (19, False),
    (-1, True),
])
def test_is_minor(age, expected):
    assert is_minor(age) == expected
```

When mutation testing reveals surviving mutants, parameterized tests are the most efficient way to kill them. Adding a
new boundary case means adding one line, not copying a method.

### Exceptions to TDD

TDD is not enforced for pure documentation, pure configuration without logic, and mechanical refactors with existing
test coverage (file splits, re-exports). But even for exceptions, the existing test suite must stay green after every
change.

## Rule 4: No New Dependencies Without Review

AI will happily introduce a new library for something your existing stack already handles. Every new dependency is a
maintenance commitment: security updates, breaking changes, license implications, and one more thing that can go wrong.

The rule is simple: no new dependencies without a manual check on maintenance status and security. Prefer what already
exists. If the AI suggests `moment.js` when you already have date-fns, that is a rejection.

## Rule 5: Git Discipline

Vibe coding produces code fast. Without git discipline, it produces chaos just as fast.

- **Issue first.** Every task starts with a GitHub issue. No code without a tracked reason.
- **PR for every pushed change.** A pushed branch without a PR is unfinished work. "No PR, wasn't requested" is not
  valid.
- **One concern per PR.** Not three features, not a feature plus a refactoring.
- **Conventional Commits.** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`. With scope when clear.
- **Never amend and force-push on an open PR.** The force-push can desync GitHub's PR head. Always add a new commit.
- **Closes #XX in every commit.** Traceability from code back to the reason it exists.

This applies to AI-generated commits exactly the same way it applies to human ones.

## Rule 6: Priority Is Fixed

When AI can generate features in minutes, the temptation is to skip the boring infrastructure work and ship the exciting
stuff first. This is how codebases collapse.

The priority order is fixed and non-negotiable:

1. Merge open PRs
2. P0/P1 bugs
3. Infrastructure (CI, security, guards)
4. UI fixes
5. Cleanup and refactoring
6. Features
7. Release

Foundation before features. Measure first, then secure. A feature built on a broken CI pipeline is a feature you cannot
trust.

## Rule 7: Quality Gates in CI/CD

Tests and analysis must run automatically and regularly. The AI does not get to skip the build.

**Every commit/push:** unit tests, linting, formatting checks, pre-commit hooks.

**Every merge request:** coverage report, dead code analysis, integration and E2E tests.

**Nightly or weekly:** mutation testing (PIT for Java, mutmut for Python, Stryker for TypeScript). High runtime, but
essential for verifying that tests actually catch bugs.

Quality gates define minimum thresholds that break the build:

- Line coverage: at least 70 to 80 percent
- Mutation score: at least 60 to 70 percent
- Static analysis: no new findings allowed (baseline approach)

### PR Gates vs the Night Shift

Not everything belongs on every PR. Correctness gates (tests, linting, type checks) block merges. Informational checks
(coverage reports, security scans, mutation testing) run on schedule. If a job's failure should not block a merge, it
belongs on the night shift.

## Rule 8: AI-Specific Prohibitions

These rules exist because the AI will do these things if you let it:

- **No code "for later."** Only what is needed now. YAGNI applies to AI output even more than to human code, because the
  AI will happily generate entire modules for features nobody asked for.
- **No architectural decisions.** The AI does not replace SQLAlchemy with Prisma. It does not replace your editor
  library. It does not change the plugin structure. Those are human decisions.
- **Never weaken or delete existing tests** to make the build green. If a test fails after a change, the change is
  wrong, not the test.
- **No guessing.** When something is unclear, stop and document the uncertainty. Do not generate plausible-looking code
  that might be wrong.
- **No generic names.** `data`, `info`, `result`, `temp`, `item` are forbidden. Use `session_data`, `plugin_info`,
  `evaluation_result`. The AI defaults to generic names if you do not enforce this.

## Rule 9: Release Freeze

When a release branch is cut, everything stops except the release workflow:

- No new PRs against develop
- No merges to develop
- No new code, only release-test, release-finish, release-publish
- Exception: a P0 hotfix that blocks the release itself

Tag first, then continue working. The AI does not get to sneak in "just one more fix" during a release.

## Rule 10: Lessons Learned Is a Living Document

Every incident, every bug that made it to production, every rule that had to be added because something went wrong gets
documented. Not in a post-mortem that nobody reads, but in a lessons-learned file that the AI reads at the start of
every session.

This is how you prevent the same mistake twice. The AI has no memory between sessions unless you give it one. The
lessons file is that memory.

## Rule 11: Protect Your Rules from Erosion

This is the meta-rule, and it exists because of a real incident. A "cleanup" PR deleted 66 percent of the rule file and
silently inverted two policies. It never reached the main branch because an audit caught it, but nothing structural
would have prevented it.

The protection has three layers:

**Condensation PRs are content-neutral or declared.** A PR framed as cleanup, reflow, or formatting may not contain
content deletions or weakenings. If it does, it must be explicitly declared and reviewed as a content change.

**Normative changes are detected automatically.** A CI check diffs the rule surface and flags added or removed binding
keywords (MUST, NEVER, ALWAYS, MANDATORY). The change must be declared with a label or a commit message.

**Gate and rule stay coupled.** Every CI gate names the rule it enforces. Removing a rule without removing its gate (or
vice versa) fails the build.

This matters for vibe coding because the AI will "improve" your rules if you let it. It will condense, reformat, and
subtly weaken constraints while making the file look cleaner. Structural protection against this is not paranoia, it is
engineering.

## Rule 12: Fail Closed

Every quality gate must fail closed. If the analyzer is unavailable, the baseline is missing, or the helper script
crashes, the gate reports red, not green. "I could not check" is never "there is nothing to find."

Every gate carries five tests:

1. It detects the violation
2. It passes on a clean tree
3. It fails closed when its own basis is missing or broken
4. It reports what it measured (so an empty scan does not look like a clean one)
5. Its measurement means the same thing everywhere (no tool drift, no platform variance)

This exists because three fail-open findings occurred within a single day: a probe passed when its analyzer could not
run, a language gate passed because a glob matched almost no files, and a complexity ratchet reported "passed" when its
baseline was gone.

## Rule 13: Kill Dead Code Actively

AI generates dead code at a higher rate than humans. It creates a helper function, decides not to use it, and leaves it
in the file. It scaffolds a utility module "for later" despite being told not to. Over weeks, dead code accumulates and
inflates your coverage numbers with untested, unreferenced code.

Do not write tests for dead code. Delete it.

Use libraries to find it systematically:

**Java:** SpotBugs (bytecode analysis, finds unreachable code, dead variables, redundant null checks), UCDetector
(unused classes, methods, fields across the workspace), ProGuard (identifies and removes unreachable code), Checkstyle
(unused imports and local variables).

**Python:** vulture (finds unused functions, variables, imports, unreachable code), autoflake (automatically removes
unused imports and variables), dead (finds dead functions and classes across file boundaries).

**TypeScript:** ESLint with `no-unused-vars` and `no-unreachable`, ts-prune (finds unused exports across the project).

Run dead code analysis weekly or on every merge request. Integrate it into CI the same way you integrate linting. The
rule is simple: if nothing calls it, it does not exist. Delete it, git keeps the history.

This is especially important in vibe-coded projects because the AI has no memory of what it generated in previous
sessions. It cannot clean up after itself. That is your job, and the tools above make it mechanical rather than manual.

## Rule 14: Prompt Templates for Repeatable Quality

Prompt precision as a principle is good. Prompt templates as a practice is better.

Vibe coding produces consistent results only when the prompts are consistent. Every recurring task type should have a
template that anchors the AI in the right patterns, architecture, and constraints.

Examples of templates worth maintaining:

**New endpoint:** "Add a `GET /api/{resource}/{id}` endpoint in `routes.py`. Delegate to
`{resource}_service.get_{resource}()`. Follow the pattern in `project_routes.py`. The service throws `NotFoundError`,
the global exception handler maps it. Write a failing test first."

**Bug fix:** "Bug: {description}. Reproduce it with a failing test in `test_{module}.py` (Red). Then fix in
`{module}.py` (Green). The reproduction test stays as a regression guard. Reference: Closes #{issue}."

**New service function:** "Add `{function_name}` to `{service}.py`. Layer rules: no HTTP concepts, no direct DB access,
use the repository interface. Throw `{ErrorType}` on failure. Target: four tests (reproduction, happy path, edge case,
boundary value). Parameterize where possible."

Store these templates where the AI can read them. In your rules directory, in a prompts folder, or wherever your AI
agent picks up context at session start. If you already maintain prompt files, this is about curating and standardizing
them, not starting from scratch. The template does not replace thinking about the prompt, but it prevents forgetting the
constraints that matter.

## Rule 15: Measure AI Output Quality

You measure code quality (coverage, mutation score, static analysis). You should also measure AI quality: how good is
the generated code before review?

Track three things:

**Rejection rate:** How often does AI-generated code get rejected or substantially rewritten during review? A high
rejection rate means your prompts or constraints need work. Track it per task type (new feature, bug fix, refactoring)
to find where the AI struggles.

**Correction rounds:** How many iterations does it take from first prompt to merged code? One round (prompt, review,
merge) is the target. Three or more rounds means the prompt was too vague, the constraints were unclear, or the task was
too complex for a single prompt.

**Recurring mistakes:** Does the AI keep putting business logic in route handlers? Does it keep introducing generic
variable names? Does it keep generating code without tests? Track the patterns and turn them into explicit rules or
prompt templates. Every recurring mistake that gets codified into a rule is a mistake that stops recurring.

This is not about grading the AI. It is about closing the feedback loop. Without measurement, your prompts stay at
whatever level they were when you started. With measurement, they get better over time.

One honest caveat: quantitative tracking erodes in autonomous workflows. When the AI agent runs unattended, nobody logs
rejection rates. A lighter alternative is a qualitative journal entry per session, noting what went wrong and what
prompt adjustment fixed it. The point is not the format. The point is that some feedback mechanism exists, whatever form
it takes.

## Rule 16: Parity Guards for Every Synced Data Source

Whenever two representations of the same truth exist, they will drift. Different files, different repos, different
languages, different runtimes, it does not matter. If they must stay in sync, a parity test must enforce it.

AI-assisted development makes this worse, not better. Every prompt is local, but parity is global. When you prompt the
AI to add a new theme token, it updates the file it is working on. It does not update the other 11 theme files. When you
add a backend API endpoint, it does not add the matching offline storage handler. When you add a translation key in
German, it does not add it in English, French, and Spanish.

### Where Parity Tests Apply

**Theme tokens:** Every theme must define the exact same set of CSS custom properties. One missing token means one
broken theme.

**i18n catalogs:** Backend YAML and frontend JSON catalogs must have matching keys, values, and placeholder structures
across all supported languages. A parity test compares the key sets and fails on any mismatch.

**Schema mirrors:** A schema file mirrored from one repository to another. The source changes, the mirror does not, and
validation breaks downstream.

**Offline/online storage:** A PWA stores data locally and syncs with an API. Both must return the same data structure. A
parity test runs the same query against both and compares.

**Documentation:** Help pages in multiple languages where every page in one language must have a counterpart in the
others.

### Implementation

Parity tests are structurally simple. Load both sources, compare, fail on difference:

```python
def test_theme_token_parity():
    themes = load_all_theme_files("frontend/src/styles/themes/")
    reference_tokens = set(themes[0].keys())
    for theme_name, tokens in themes.items():
        assert set(tokens.keys()) == reference_tokens, (
            f"Theme {theme_name} has mismatched tokens: "
            f"missing={reference_tokens - set(tokens.keys())}, "
            f"extra={set(tokens.keys()) - reference_tokens}"
        )
```

```python
def test_i18n_key_parity():
    catalogs = load_all_catalogs("backend/i18n/")
    reference_keys = set(catalogs["en"].keys())
    for lang, catalog in catalogs.items():
        assert set(catalog.keys()) == reference_keys, (
            f"Language {lang} has key drift: "
            f"missing={reference_keys - set(catalog.keys())}, "
            f"extra={set(catalog.keys()) - reference_keys}"
        )
```

Run them on every merge request. They are fast (file comparisons, not runtime behavior) and they catch the cross-cutting
drift that unit tests, mutation testing, and code coverage will never find. Every synced data source without a parity
guard is a silent regression waiting to happen.

## Rule 17: Ratchets, Never Allow Quality to Slide Back

A quality gate with a fixed threshold (coverage at least 70 percent) allows silent regression. Your coverage can drop
from 92 to 71 percent and the gate stays green. That is a massive loss hidden behind a passing badge.

A ratchet fixes this. It records the current value as a baseline. The value may improve, never degrade. If coverage is
at 92 percent today, the ratchet ensures it stays at 92 or higher. Every improvement becomes the new floor.

### Why Ratchets Are Critical for Vibe Coding

AI-assisted development produces quality swings. One session generates clean, well-tested code. The next generates
something that compiles but drags your metrics down. Without ratchets, the bad sessions erode what the good sessions
built. Over weeks, the codebase trends toward the lowest common denominator of the AI's output quality.

Ratchets make this erosion impossible. The AI-generated code either maintains the current quality level or it does not
merge.

### What to Ratchet

Apply ratchets to every metric worth protecting:

- **Coverage:** may only increase
- **Mutation score:** may only increase
- **Complexity:** average cyclomatic complexity may not increase
- **Dead code findings:** may only decrease
- **Bundle/artifact size:** no uncontrolled growth
- **Rule corpus size:** project rules may not grow without a declared change
- **Design token allowlists:** may only shrink (hardcoded values get replaced, never added)

### Implementation

Store the baseline in a JSON file in the repository. The CI gate compares the current measurement against the baseline.
Worse means red, better means green.

```json
{
  "coverage": 92.3,
  "mutation_score": 84.1,
  "complexity_avg": 3.7,
  "spotbugs_findings": 12
}
```

```bash
CURRENT=$(extract_coverage)
BASELINE=$(jq '.coverage' .quality-baseline.json)
if (( $(echo "$CURRENT < $BASELINE" | bc -l) )); then
  echo "FAIL: coverage dropped from $BASELINE to $CURRENT"
  exit 1
fi
```

### Lessons Learned the Hard Way

Two pitfalls from production:

**Stale baselines on feature branches.** A ratchet baseline is itself a measurement. On a feature branch that has fallen
behind the main branch, the baseline is stale. The measurement reads different numbers against a stale tree than against
the merged tree. Rule: always merge the base branch first, then measure. A ratchet raise against a stale merge base is a
guess, not a measurement.

**Release back-merges bypass ratchets.** When a release branch is merged back into develop via direct push, the ratchet
gates never run against the back-merge. Version bumps and late fixes land ungated, and suddenly develop is red for every
branch. Rule: every ratchet-tripping change on a release branch must update the baseline in the same branch before the
back-merge. Route back-merges through a PR so the gates run.

Both of these were real incidents. The ratchet mechanism itself is simple. Keeping it honest across branches, merges,
and release flows is the engineering challenge.

## The Tooling Layer: Plugins and Skills That Enforce the Rules

Rules only work if the tooling supports them. The Claude Code ecosystem has matured into a plugin marketplace with
hundreds of extensions. Most are noise. A few directly reinforce the discipline described above.

### Token Efficiency: Caveman

The single most popular community plugin (99k+ GitHub stars). Caveman compresses Claude's output by stripping filler
words, articles, and pleasantries while keeping code and technical accuracy intact. Real-world token reduction is 4 to
10 percent on full sessions, not the marketed 75 percent, but on teams burning millions of tokens per month, that adds
up.

More importantly, compressed output is often more accurate. A March 2026 paper found that brevity constraints improved
accuracy by 26 percentage points on certain benchmarks. Less hedging means fewer weasel words that obscure whether the
AI is confident or guessing.

Install: `/plugin marketplace add JuliusBrussee/caveman && /plugin install caveman@caveman`

### Persistent Memory: Claude-Mem

Claude has no memory between sessions unless you give it one. Claude-mem (46k+ stars) automatically captures what
happens during coding sessions, compresses observations, and injects relevant context into future sessions via a local
SQLite database.

This directly supports Rule 10 (Lessons Learned). Instead of maintaining a manual lessons file, claude-mem captures
decisions, patterns, and mistakes automatically. The tradeoff: a February 2026 security audit rated it HIGH risk due to
an unauthenticated local API. Run it on personal dev machines only, not on shared servers or cloud VMs.

Install: `/plugin marketplace add thedotmack/claude-mem && /plugin install claude-mem@thedotmack`

### Code Quality: Anthropic's Official Plugins

Anthropic ships several first-party plugins that directly support the rules in this article:

**code-review** enforces structured code review. Instead of "looks good" rubber stamps, it runs through a checklist:
architecture compliance, test coverage, naming conventions, error handling. Supports Rule 2 (Layer Architecture) and
Rule 8 (AI-Specific Prohibitions).

**code-simplifier** runs a cleanup pass on modified code: removes duplication, flattens nested conditionals, rewrites
compact expressions into readable alternatives. The constraint is absolute: never change behavior, only how behavior is
expressed. Supports Rule 3 (TDD, the Refactor phase).

**security-guidance** flags security issues before they reach review. Supports Rule 7 (Quality Gates).

Install from the official marketplace: `/plugin marketplace add anthropics/claude-plugins-official`

### Workflow Orchestration: Superpowers

Superpowers (752k+ installs) turns Claude Code into a structured workflow engine. It ships workflows for brainstorming,
sub-agent driven development, systematic debugging, and red/green TDD. The TDD workflow directly enforces
Red-Green-Refactor as described in Rule 3.

It also lets you author and test your own skills, which means your project-specific rules (layer architecture, naming
conventions, test requirements) can be encoded as executable skills rather than just documentation.

### Testing: Playwright Plugin

The official Playwright plugin gives Claude Code direct access to E2E test execution. Instead of writing tests and
hoping someone runs them, the AI can run Playwright specs as part of the development cycle. This supports Rule 7
(Quality Gates) and makes E2E testing part of the feedback loop rather than a separate step.

### Documentation Context: Context7

Context7 (348k+ installs) injects current library documentation into the AI's context. This prevents a common vibe
coding failure: the AI generates code using deprecated APIs or outdated patterns because its training data is stale.
Particularly useful for fast-moving frameworks.

### Custom Skills: Your Own Rules as Executable Instructions

Beyond third-party plugins, Claude Code supports project-level skills via `.claude/rules/` and `.claude/skills/`. This
is where your own rules live as executable context, not just documentation that the AI might ignore.

Every rule in this article can be encoded as a skill file that Claude Code reads at session start. Layer architecture
constraints, TDD requirements, naming conventions, git workflow, priority order: all of these become instructions the AI
follows automatically rather than guidelines you hope it remembers.

This is the difference between "we have a coding standard document" and "the AI cannot generate code that violates the
coding standard." The rules directory is not a wiki. It is the AI's operating system.

### What Not to Install

More plugins is not better. Every plugin adds to the context window, which means more tokens per turn, which means
higher cost and slower responses. The rule corpus ceiling (Rule 11 in the adaptive-learner project) applies to plugins
too: every addition is a trade, not a free upgrade.

Start with the plugins that close your biggest gap. Add one at a time. Measure whether it actually changes your output
quality. Remove it if it does not.

## The Workflow in Practice

Here is how it all fits together for a single feature:

1. Open a GitHub issue describing the feature
2. Read the lessons-learned file
3. Pick the matching prompt template, adapt it to the task
4. Run `make test` to establish a green baseline
5. Write a failing test (Red)
6. Prompt the AI with the test as specification, referencing existing patterns
7. Review the generated code against layer architecture rules
8. Run the test (Green)
9. Refactor, keeping tests green
10. Add parameterized tests for edge cases and boundary values
11. Run mutation testing, close surviving mutants
12. Run dead code analysis, delete anything unreferenced
13. Commit with conventional format, `Closes #XX`
14. Push and open a PR against develop
15. CI runs all quality gates automatically
16. Log rejection rate and correction rounds for this task

The AI handles steps 6, 9, and parts of 11. The human handles everything else, especially the review in step 7 and the
quality measurement in step 16. That split is what makes vibe coding sustainable.

## Putting It All Together

| Rule                     | Prevents                                                        |
|--------------------------|-----------------------------------------------------------------|
| Prompt precision         | Architectural drift, reinvented patterns                        |
| Layer architecture       | God-files, tangled dependencies                                 |
| TDD mandatory            | Untested code, unverified behavior                              |
| Parameterized tests      | Weak boundary coverage, missed edge cases                       |
| No new dependencies      | Dependency bloat, security risk                                 |
| Git discipline           | Untraceable changes, merge chaos                                |
| Fixed priority           | Shiny features on a broken foundation                           |
| Quality gates in CI/CD   | Manual-only checks that get skipped                             |
| AI-specific prohibitions | Speculative code, weakened tests, architectural decisions by AI |
| Release freeze           | Last-minute breakage                                            |
| Lessons learned          | Repeating the same mistakes                                     |
| Rule erosion protection  | Silent policy changes in "cleanup" PRs                          |
| Fail closed              | Gates that look green while checking nothing                    |
| Kill dead code           | AI-generated ghost code inflating metrics                       |
| Prompt templates         | Inconsistent output, forgotten constraints                      |
| Measure AI output        | Stagnating prompt quality, untracked waste                      |
| Parity guards            | Silent cross-cutting drift between synced data sources          |
| Ratchets                 | Quality erosion across sessions, metrics sliding backward       |
| Plugins and skills       | Rules that exist only as documentation, not as enforcement      |

Vibe coding without rules is just outsourcing your technical debt to a machine that does not care about consequences.
With rules, it is a legitimate engineering practice that happens to be faster than typing everything yourself.

The rules are not restrictions on the AI. They are restrictions on the chaos that speed creates.

## What This Article Does Not Cover

These rules focus on the discipline of AI-assisted development. Several adjacent topics were left out because they each
warrant their own deep dive:

- **Multi-agent coordination:** rules for when multiple AI agents work on the same codebase simultaneously, including
  lock contention, PR conflicts, and session isolation.
- **Prompt engineering methodology:** systematic approaches to prompt construction beyond templates, including
  chain-of-thought prompting, few-shot examples, and context window management.
- **Cost management:** monitoring and optimizing token spend across AI-assisted workflows, including when to use cheaper
  models for simpler tasks.
- **Security review of AI output:** systematic security auditing beyond what plugins catch, including supply chain risks
  from AI-suggested dependencies.
- **Onboarding new team members:** how to introduce developers to a rule-governed AI workflow without overwhelming them
  with 17 rules on day one.
- **Property-based testing** (Hypothesis, jqwik): a natural extension of parameterized tests that generates hundreds of
  random inputs to find edge cases.

---

*The full rule set is public: [github.com/astrapi69/adaptive-learner](https://github.com/astrapi69/adaptive-learner),
directory `.claude/rules/`. Contributions and feedback welcome.*

*Previous article: [Your Code Coverage Is Lying to You. Here's How to Fix It.](link-to-part-1)*
