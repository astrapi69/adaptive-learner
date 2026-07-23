# The six learning methods

Each method has a stance, a strength, a weakness, and a
characteristic style for the AI to take during sessions. The
42-cell prompt matrix (6 methods × 7 steps) implements these
stances per cycle step.

## Deductive

**Stance**: Theory first. State the rule completely, then
demonstrate with examples, then ask the learner to apply.

**Strong when**: the topic has clean, statable rules (formal
grammar, mathematical proofs, type systems). The learner
already accepts that rules govern the domain and wants to
internalise them efficiently.

**Weak when**: the rules are fuzzy, contested, or context-
dependent. Pure deductive teaching of "good taste" or
"clarity" lands flat — the learner needs to see many
examples before the implicit pattern crystallises.

**AI's style**: precise, structured, complete. Spells out the
rule in plain language, demonstrates with prototypical
worked examples, then asks the learner to solve a fresh
instance.

## Inductive

**Stance**: Examples first. Show three to four carefully
chosen examples of the same phenomenon and let the learner
derive the rule themselves. Reveal the rule only after the
learner has formed a hypothesis.

**Strong when**: pattern recognition is exactly the cognitive
skill the learner needs to develop. Language learning,
music theory, chess tactics, machine learning intuition —
all benefit from inductive practice.

**Weak when**: speed matters. The inductive route is slower
than deductive when the rule is simple and unambiguous.
"Always free your memory" doesn't need three examples; just
state it.

**AI's style**: presents examples side-by-side, holds back
from explaining, asks "what pattern do you see?" or "what's
the next item in this series?".

## Error-based

**Stance**: Provoke mistakes, then learn from them. Pose
tasks specifically designed to trip the learner into the
topic's classic pitfalls. Then explain *why* the trap is so
tempting.

**Strong when**: the topic has well-known traps (subject-
verb agreement in long sentences, off-by-one errors in
loops, common fallacies in argumentation). The learner
benefits from feeling the trap pull before they understand
the corrective mechanism.

**Weak when**: the learner is fragile, anxious, or new. The
"productive frustration" can tip into "I'm bad at this"
without a careful framing. The AI's `step 3 (Error)` prompt
in this method explicitly says "diagnose precisely without
padding" — that's a teaching choice, not a personality
defect.

**AI's style**: confrontational about the mistake, then
deeply explanatory about its mechanism. "That's the classic
trap X — you fell into it because Y. Here's why it's so
tempting."

## Dialogic

**Stance**: conversational exchange, low pressure. Frame
tasks as invitations, not tests. Affirm what's right
explicitly before delivering corrections. Let the learner
co-steer.

**Strong when**: the learner has anxiety, fragile confidence,
or has hit a wall. The relaxed tone restores agency. Also
strong when the topic itself is conversational (rhetoric,
debate, presentation skills).

**Weak when**: the learner wants direct instruction and is
frustrated by "want to give it a try?" framing. Some
learners read dialogic prompts as evasive.

**AI's style**: warm, curious, low-density. Asks "what led
you there?" before correcting. Affirms partial correctness
explicitly. Suggests tempo or focus shifts.

## Contextual

**Stance**: real-world scenarios first. Set up a concrete
situation where the topic is immediately needed; theory
comes only after the learner has tried to act in the
scenario.

**Strong when**: the topic is applied or domain-specific
(business communication, clinical reasoning, engineering
trade-offs). The learner needs to feel the situational
pressure to understand which theoretical knob actually
matters.

**Weak when**: the topic is genuinely abstract (set theory,
formal logic, music theory in a vacuum). Forcing a scenario
makes the lesson feel contrived.

**AI's style**: scene-setting. "You're at the door of a
client meeting and they ask…". Asks for the learner's next
concrete action. Shows consequences inside the scenario.

## AI-adaptive

**Stance**: the AI picks per turn. Reads the profile and the
session history; selects whichever of the other five methods
fits *this exchange*. Justifies the choice in one sentence.

**Strong when**: the learner has a balanced profile (no
dominant method) or is in a session where multiple methods
might work. Also strong for advanced learners who can
articulate when a method isn't landing.

**Weak when**: the learner wants a stable, predictable
teaching style. The constant method-switching can feel
jittery if not justified well per turn.

**AI's style**: meta-aware. Names the method it's choosing
("Let me try inductively..."), executes that method
faithfully, and switches when the signal says it's not
working.

## How the app implements each

The six methods are not just labels. Each one drives a
distinct AI personality via the **42-cell prompt matrix**
in `plugins/.../session/prompts.py`: one prompt per
(method, step) pair, six methods × seven steps. A deductive
Input prompt opens with the rule and asks for examples; a
contextual Input prompt opens with a real-world scenario
and asks how the learner would tackle it. Same step,
completely different texture.

The matrix is exported verbatim to
`frontend/src/data/session-prompts.json` for Dexie-mode
parity — no drift possible between Server and Local modes.

## Choosing among them

Your assessment gives you a 6-method profile. The dominant
method is what new sessions start in. But:

- The **step evaluator** (dual-prompt) may suggest
  staying, advancing, or — rarely — stepping back per
  cycle step.
- The **method-switch heuristic** detects stagnation
  (three sessions of flat understanding + high stress) and
  surfaces a "want to try [other method]?" banner in both
  storage modes.
- You can **manually pick** a method on the Session page's
  start button. Useful when you know the topic calls for
  one specific method.

Method-switching is the goal, not method-loyalty. A learner
who has used five of the six methods across their
Adaptive Learner history has a richer mental toolkit than
one who's locked into deductive forever.
