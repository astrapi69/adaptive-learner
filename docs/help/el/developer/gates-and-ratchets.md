# Πύλες, ratchets και προστασία κλάδων

Αυτό το έργο είναι ασυνήθιστα αυστηρό: δεκάδες πύλες CI, μια οικογένεια
ratchets με παγωμένα baselines, υποχρεωτικά issues και pull requests,
ένα συμβόλαιο δοκιμών πυλών, και προστασία κλάδων που δεσμεύει και τους
admins. Σχεδόν τίποτα από αυτά δεν γράφτηκε εκεί όπου το διαβάζει
άνθρωπος - βρίσκεται στα αρχεία κανόνων για agents κάτω από το
[`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).
Αυτή η σελίδα είναι ο χάρτης για ανθρώπους: τι είναι κάθε μηχανισμός,
γιατί υπάρχει, και - το κομμάτι που μετράει πραγματικά όταν μπλοκάρεις -
τι κάνεις γι' αυτό.

Τίποτα εδώ δεν επαναδιατυπώνει έναν κανόνα. Όπου ένας κανόνας φέρει τη
δεσμευτική διατύπωση, αυτή η σελίδα παραπέμπει σε αυτόν και τον εξηγεί.
Οι κανόνες είναι η πηγή αλήθειας· ένα δεύτερο αντίγραφο θα απέκλινε, και
αυτό το codebase το έχει πιάσει να συμβαίνει περισσότερες από μία φορές.

## Δύο ρυθμοί: πύλες PR έναντι νυχτερινής βάρδιας

Ένα πράσινο pull request **δεν** σημαίνει ότι το `develop` είναι πράσινο.
Το CI των PR τρέχει μόνο τις πύλες ορθότητας - εκείνες των οποίων η
αποτυχία πρέπει να μπλοκάρει ένα merge. Ό,τι είναι ενημερωτικό, μόνο
προειδοποιητικό ή εξαρτάται από εξωτερική κατάσταση τρέχει στη νυχτερινή
βάρδια (ένα νυχτερινό πρόγραμμα συν `workflow_dispatch`).

| Τρέχει σε κάθε PR | Τρέχει νυχτερινά + στο release |
|---|---|
| backend / plugin / frontend tests, ruff + mypy, pre-commit, docs-drift verifier | security scan (pip-audit / bun audit / bandit) |
| complexity ratchet, φύλακες μεγέθους φακέλων + αρχείων | αναφορά coverage (αναφορά, όχι πύλη) |
| visual-baseline gate, testid-reference gate | Dexie-mode E2E, visual regression, mutation testing |
| docker-build-smoke (με φίλτρο διαδρομών) | content-stats drift, WebKit gate |

Η συνέπεια: μια αλλαγή σε επιφάνεια που καλύπτει μόνο η νυχτερινή βάρδια
μπορεί να περάσει καθαρά ένα PR και να κάνει κόκκινη την επόμενη νυχτερινή
εκτέλεση. Αυτή είναι μια γνωστή, επαναλαμβανόμενη κατηγορία κινδύνου, όχι
μεμονωμένο περιστατικό. Ο έγκυρος πίνακας και το σκεπτικό βρίσκονται στο
[`quality-checks.md` -> "CI cadence: PR gates vs the night shift"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

## Τι είναι μια πύλη - και τι δεν είναι

Μια πύλη είναι ένας έλεγχος που **αποτυγχάνει κλειστά** (fail closed). Το
συμβόλαιο δοκιμών πυλών του έργου (πέντε τεστ ανά πύλη) περιγράφεται στο
[`quality-checks.md` -> "Gate test contract"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).
Οι δύο κανόνες που θα νιώσεις ως συνεισφέρων:

- **Μια πύλη που δεν μπορεί να ελέγξει δεν πρέπει ποτέ να αναφέρει
  πράσινο.** Το «δεν μπόρεσα να τρέξω» δεν είναι «δεν υπάρχει τίποτα να
  βρεθεί». Αν λείπει η βάση μιας πύλης (απόν baseline, helper που
  κατέρρευσε, frontend χωρίς build), αποτυγχάνει, δεν περνάει.
- **Μια πύλη αναφέρει τι μέτρησε.** Τα «0 ευρήματα» και «0 αρχεία
  εξετάστηκαν» δεν είναι το ίδιο αποτέλεσμα, και η πύλη είναι φτιαγμένη
  ώστε να μπορείς να τα ξεχωρίσεις.

Έτσι, όταν μια πύλη σε μπλοκάρει, διάβασε τι λέει ότι μέτρησε πριν
υποθέσεις ότι κάνει λάθος. Οι περισσότερες «ψευδείς» αποτυχίες πυλών είναι
η πύλη που σωστά αναφέρει μια πραγματική απόκλιση που δεν περίμενες.

## Ratchets και baselines

Ένα **ratchet** συγκρίνει μια τρέχουσα μέτρηση με ένα παγωμένο baseline
που βρίσκεται στο δέντρο. Η μέτρηση μπορεί να βελτιώνεται ελεύθερα· δεν
μπορεί να χειροτερεύει σιωπηλά. Και τα δύο μισά - ο αριθμός και το
baseline - γίνονται commit, άρα και τα δύο μπορούν να αποκλίνουν.

Η οικογένεια ratchets και πού βρίσκεται κάθε baseline:

| Ratchet | Αρχείο baseline | Τοπικό target |
|---|---|---|
| Κυκλωματική πολυπλοκότητα | `.complexity-baseline` | `make check-complexity-gate` |
| Μέγεθος αρχείου (γραμμές) | `.filesize-baseline` | `make check-file-sizes` |
| Μέγεθος φακέλου (επίπεδα αρχεία/κατάλογο) | `.dirsize-baseline` | `make check-folder-size` |
| Μέγεθος `global.css` | `.css-size-baseline` | `make check-css-size` |
| Theme tokens / αντίθεση | `.theme-baseline.json` | `make verify-theme` |
| Μέγεθος σώματος κανόνων | `.claude/rules/.corpus-baseline.json` | `make verify-rule-corpus-size` |
| Υποκατάστατα umlaut στην τεκμηρίωση | `docs/.docs-hygiene-baseline.json` | `make verify-docs-hygiene` |
| Σπασμένες αναφορές τεκμηρίωσης | `docs/.doc-refs-baseline.json` | `make verify-doc-refs` |
| Μέγεθος δημοσιευμένου image | (στο `verify-image-size`) | `make verify-image-size` |

### Όταν ένα ratchet σε μπλοκάρει

1. **Κάνε πρώτα merge το `develop`, μετά ξαναμέτρησε.** Ένα ratchet
   συγκρίνει το τρέχον δέντρο με ένα baseline· ένας κλάδος που υστερεί
   της βάσης του φέρει *παλιό* baseline απέναντι σε *νέο* συγχωνευμένο
   περιεχόμενο, οπότε ο αριθμός που διαβάζεις τοπικά δεν είναι ο αριθμός
   που διαβάζει το CI. Ενημέρωσε τον κλάδο σου πριν αγγίξεις οτιδήποτε.
   Γιατί αυτό δαγκώνει τεκμηριώνεται στο
   [`lessons/ci-gates.md` -> "A ratchet baseline is itself a
   measurement"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md).

2. **Αν η αύξηση είναι θεμιτή, ανέβασε το baseline σκόπιμα - και πες
   γιατί.** Κάθε ratchet έχει ρητό target ανύψωσης/ενημέρωσης ώστε το νέο
   ανώτατο όριο να καταλήγει στο diff σου, ελέγξιμο, με αιτιολόγηση στο
   μήνυμα commit:

   ```bash
   make check-complexity-gate-update      # regenerate .complexity-baseline
   make check-folder-size-update          # show offenders to whitelist
   make verify-theme-baseline-update      # re-record .theme-baseline.json
   make verify-rule-corpus-size-raise     # raise the corpus ceiling
   make verify-image-size-raise           # raise the image ceiling
   ```

3. **Μην περιμένεις ένα ratchet να χαμηλώσει μόνο του.** Ορισμένα ratchets
   κατοχυρώνουν αυτόματα μια πραγματική μείωση (ένας μετρητής σφαλμάτων
   που θα έπρεπε να είναι μηδέν)· ένα ratchet *προϋπολογισμού* κρατά τη
   μείωση ως περιθώριο και μετακινείται μόνο με σκόπιμη πράξη· ένα ratchet
   *ολισθαίνοντος oracle* (πολυπλοκότητα, το χτισμένο Tailwind CSS) δεν
   χαμηλώνει ποτέ αυτόματα, επειδή μια πτώση μπορεί να είναι ολίσθηση του
   εργαλείου και όχι πραγματικό κέρδος. Η τριπλή επιλογή εξηγείται στο
   συμβόλαιο δοκιμών πυλών, σημείο 5. Αν ένα ratchet απέτυχε επειδή ένας
   αριθμός *μίκρυνε*, αυτό είναι κι αυτό εύρημα, όχι δωρεάν πάσο.

Μη χαμηλώνεις ποτέ ένα ανώτατο όριο για να γίνει πράσινο ένα τοπικό
κόκκινο. Ο αριθμός σημαίνει το ίδιο πράγμα παντού εκ σχεδιασμού· η σιωπηλή
μετακίνησή του είναι ακριβώς η αποτυχία που το ratchet υπάρχει για να
αποτρέψει.

### Ένα αναλυτικό παράδειγμα: το ratchet του σώματος κανόνων

Ας πούμε ότι προσθέτεις μια ενότητα σε ένα αρχείο κανόνων κάτω από το
`.claude/rules/`. Κάθε τέτοιο αρχείο εισάγεται σε κάθε prompt, οπότε το
ratchet του σώματος φυλάει το συνολικό του μέγεθος. Το τρέχεις και
μπλοκάρει:

```
$ make verify-rule-corpus-size
rule corpus: 24 files, 292314 chars (~73078 tokens per prompt)
rule corpus is 58 chars over the ceiling (292314 > 292256).
  - condense or delete elsewhere in the corpus (see the condensation rule
  - raise the ceiling deliberately:
      make verify-rule-corpus-size-raise
    and say in the commit what the corpus bought for the space.
make: *** [Makefile:899: verify-rule-corpus-size] Error 1
```

Η πύλη τυπώνει τις δύο θεμιτές διεξόδους, και μόνο αυτές τις δύο:
συμπύκνωσε ή διάγραψε κάτι άλλο ώστε το σύνολο να χωράει ξανά, ή ανέβασε
το ανώτατο όριο σκόπιμα με `make verify-rule-corpus-size-raise` και
αιτιολόγησέ το στο commit. Τερματίζει με μη μηδενικό κωδικό (`Error 1`),
οπότε αποτυγχάνει το build μέχρι να κάνεις ένα από τα δύο - δεν υπάρχει
τρίτος δρόμος όπου η προσθήκη απλώς γλιστράει μέσα. Κάθε ratchet του
παραπάνω πίνακα μπλοκάρει με την ίδια μορφή: μια γραμμή που ονομάζει τι
μέτρησε, την τρέχουσα τιμή απέναντι στο ανώτατο όριο, και το δικό του
target ανύψωσης/ενημέρωσης.

Μια πύλη που δαγκώνει μόνο μετά το push κοστίζει έναν κύκλο. Τρέξε τις
πύλες που δεν χρειάζονται build με τη σειρά του CI με μία εντολή:

```bash
make ci        # every build-free gate, in CI order (BASE=<ref> for diff gates)
make ci-full   # the above plus gates that need a built frontend
```

Το `make ci` τρέχει, με τη σειρά: docs drift, docs hygiene, αναφορές
τεκμηρίωσης, συνδέσεις gate<->rule, απογραφή ελέγχων, απογραφή lessons,
κανονιστικές αλλαγές, μέγεθος σώματος κανόνων, complexity ratchet,
αναφορές testid, docker context, μεγέθη αρχείων και το snapshot OpenAPI.
Δύο πύλες χρειάζονται εγκατεστημένο + χτισμένο frontend (χτίζουν το
Tailwind class oracle), οπότε βρίσκονται στο `make ci-full`, όχι στο
`make ci`. Οι σουίτες δοκιμών είναι ξεχωριστές: `make test`.

## Οι πύλες είναι συνδεδεμένες με κανόνες, και οι αλλαγές δηλώνονται

Δύο manifests κρατούν την επιβολή έντιμη, και μπορείς να ενεργοποιήσεις
οποιοδήποτε από τα δύο επεξεργαζόμενος ένα αρχείο κανόνων ή ένα workflow:

- Το [`.claude/rules/gates.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/gates.yaml)
  συνδέει κάθε πύλη που επιβάλλει κανόνα με την ενότητα κανόνα που
  επιβάλλει. Το `make verify-gate-rule-links` αποτυγχάνει και προς τις
  δύο κατευθύνσεις: μια πύλη χωρίς κανόνα, ή ένας κανόνας που παραπέμπει
  σε workflow που δεν υπάρχει πια. Κάθε συνδεδεμένη πύλη φέρει επίσης ένα
  `body_sha` της ενότητας κανόνα, οπότε πιάνεται το άδειασμα του σώματος
  ενός κανόνα με διατήρηση της επικεφαλίδας του.
- Το [`.claude/rules/checks.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/checks.yaml)
  απογράφει κάθε έλεγχο. Το `make verify-check-inventory` αποδεικνύει ότι
  ένας `active` έλεγχος είναι πράγματι συνδεδεμένος και δεν έχει
  εκφυλιστεί σε no-op. Η απενεργοποίηση ενός ελέγχου επιτρέπεται μόνο
  δηλώνοντας `status: disabled` με αιτιολόγηση - το diff το δείχνει. Η
  σιωπηλή απενεργοποίηση είναι αυτό που γίνεται αδύνατο.

Αν το PR σου προσθέτει ή αφαιρεί δεσμευτική διατύπωση σε αρχείο κανόνων,
ή αλλάζει την κατάσταση μιας πύλης, το `make verify-normative-changes` θα
σου ζητήσει να το **δηλώσεις**: το label `rule-change-declared`, ή μια
γραμμή `RULE-CHANGE DECLARED: <what and why>` στο σώμα του PR ή σε μήνυμα
commit. Η δήλωση είναι περάσιμη σκόπιμα, ποτέ κατά λάθος, και συγκλίνει
στο
[`docs/rule-change-log.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/rule-change-log.md)
μηχανικά. Το πλήρες σκεπτικό: η σειρά #2075 / #2077 / #2079 / #2081 /
#2087 στο
[`quality-checks.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

Το σώμα κανόνων έχει ανώτατο όριο για συγκεκριμένο λόγο: κάθε αρχείο
`.claude/rules/**/*.md` εισάγεται σε κάθε prompt κάθε συνεδρίας agent,
οπότε μια νέα ενότητα κανόνα είναι ανταλλαγή, όχι προσθήκη - συμπύκνωσε ή
αφαίρεσε κάτι πρώτα, ή πες στο commit τι αγόρασε το σώμα με τον χώρο.

## Η προστασία κλάδων δεσμεύει και τους admins

Το `develop` απαιτεί ενημερωμένο κλάδο και πράσινους υποχρεωτικούς ελέγχους
πριν από ένα merge. Από τις 2026-08-06 το `enforce_admins` είναι **ενεργό**
για το `develop`, οπότε οι υποχρεωτικοί έλεγχοι δεσμεύουν και τους admins
του repository - η απενεργοποίησή τους είναι σκόπιμη, ορατή πράξη, ποτέ
μέρος ενός συνηθισμένου merge. Αυτό υπάρχει επειδή back-merges από release
και hotfix κάποτε έφτασαν στο `develop` χωρίς πύλη και το άφησαν κόκκινο
για κάθε κλάδο μέχρι να το προσέξει κάποιος άνθρωπος· το ιστορικό βρίσκεται
στο
[`lessons/ci-gates.md` -> "Release/hotfix back-merges land
ratchet-tripping changes on develop ungated"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
και στο
[`docs/development/release-ratchet-gap.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/development/release-ratchet-gap.md).

Πρακτικό αποτέλεσμα: κανείς δεν κάνει merge παρακάμπτοντας μια κόκκινη
πύλη. Αν το PR σου υστερεί του `develop`, ενημέρωσέ το ώστε το CI να
ξανατρέξει πάνω στη συνδυασμένη κατάσταση πριν μπορέσει να γίνει merge.

## Οι υποχρεώσεις: issue, PR, testplan, ένα θέμα

Τέσσερις μόνιμες υποχρεώσεις στέκονται πάνω από τις πύλες. Είναι κανόνες,
όχι έλεγχοι CI, και είναι δεσμευτικές ανεξάρτητα από το αν τις ζήτησε μια
εργασία:

- **Πρώτα issue** (`GITHUB-ISSUE-PFLICHT`): κάθε bug ή αλλαγή χρειάζεται
  ένα GitHub issue *πριν* από τη διόρθωση, και το commit/PR το αναφέρει με
  λέξη-κλειδί κλεισίματος (`Closes #NN`).
- **Πάντα PR** (`PR-PFLICHT`): κάθε αλλαγή κώδικα που γίνεται push ανοίγει
  pull request προς το `develop`, είτε ζητήθηκε είτε όχι. Ένας κλάδος με
  push αλλά χωρίς PR είναι ημιτελής δουλειά.
- **Testplan για ορατή αλλαγή** (`TESTPLAN-PFLICHT`): μια αλλαγή σε
  συμπεριφορά ορατή στον χρήστη ενημερώνει το χειροκίνητο πλάνο δοκιμών
  (γερμανικά και αγγλικά) στο ίδιο PR. Καθαρά refactors, υποδομή και
  τεκμηρίωση εξαιρούνται.
- **Ένα θέμα ανά PR**: κάθε PR φέρει μία ενιαία, συνεκτική αλλαγή.

Η δεσμευτική διατύπωση βρίσκεται στο
[`.claude/rules/ai-workflow/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules/ai-workflow)
(`github-issue-policy.md`, `pr-policy.md`, `testplan-policy.md`) και στο
[`vibe-coding.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/vibe-coding.md).

## Πού εντάσσεται αυτό

Αυτή η σελίδα είναι ο σύντροφος «γιατί υπάρχει η πύλη» της
[Περιήγησης ένταξης](onboarding.md), που είναι η διαδρομή βήμα προς βήμα
από το clone ως το συγχωνευμένο PR. Για την ίδια τη ροή δοκιμών
(Red-Green-Refactor και αναλυτικό παράδειγμα) δες τις
[Δοκιμές](testing.md). Για τις πύλες της στιγμής του release δες τη
[Ροή εργασίας release](release.md).
