/**
 * Self-contained content fixture for the manual-automation suite (#616).
 *
 * The Content Browser sources sets from the bundled tree
 * (``/content/adaptive-learner-content/...``) + the official GitHub repo.
 * Neither is reachable deterministically in CI/sandbox (the bundled tree
 * needs a content-repo checkout; GitHub needs egress), so the suite mocks
 * both with this fixture — exactly the recommended-repos.spec approach —
 * giving a stable lesson that exercises all five exercise types + a theory
 * step with markdown and an example link.
 */

export const FIXTURE_SET_ID = "qa-fr-a1";
/** Set ``path`` (source-language tree): ``sets/{src}/{tgt-level}``. */
export const FIXTURE_SET_PATH = "sets/en/qa-fr-a1";

/** Root manifest listing the one fixture set (EN source → "other" group
 *  when the app language is German; primary group when it is English —
 *  the Page Object handles both). */
export const ROOT_MANIFEST = `
schema_version: "1.3"
sets:
  - id: ${FIXTURE_SET_ID}
    title: "QA French A1"
    target_language: fr
    source_language: en
    level: A1
    version: "1.0.0"
    lesson_count: 1
    domain: language
    path: ${FIXTURE_SET_PATH}
`;

/** An empty manifest for the official GitHub source (the bundled fixture
 *  provides the set; this stops the real GitHub fetch). */
export const EMPTY_MANIFEST = `
schema_version: "1.3"
sets: []
`;

export const SET_MANIFEST = `
metadata:
  lessons:
    - "01.json"
`;

/** A lesson with a theory step (markdown + example link) and one of each
 *  exercise type, meeting the content-quality minimums. */
export const LESSON = JSON.stringify({
  schema_version: "1.3",
  id: "01",
  title: "QA Greetings",
  target_language: "fr",
  source_language: "en",
  domain: "language",
  estimated_minutes: 5,
  cards: [
    { id: "c1", front: "bonjour", back: "hello", tags: [] },
    { id: "c2", front: "merci", back: "thank you", tags: [] },
    { id: "c3", front: "au revoir", back: "goodbye", tags: [] },
    { id: "c4", front: "Je suis ici", back: "I am here", tags: [] },
    { id: "c5", front: "rouge", back: "red", tags: [] },
  ],
  steps: [
    {
      id: "s-theory",
      type: "theory",
      title: "Greetings",
      body: "Some **bold** intro.\n\n- un\n- deux\n\n1. premier\n2. deuxieme",
      example_url: "https://example.com/greetings",
      example_label: "View example",
    },
    {
      id: "e-match",
      type: "exercise",
      exercise: {
        id: "e-match",
        type: "matching",
        prompt: "Match the pairs",
        card_ids: ["c1", "c2", "c3"],
        pairs: [
          { left: "bonjour", right: "hello" },
          { left: "merci", right: "thank you" },
          { left: "au revoir", right: "goodbye" },
        ],
        distractors: [],
      },
    },
    {
      id: "e-free",
      type: "exercise",
      exercise: {
        id: "e-free",
        type: "free_text",
        prompt: "Type 'hello' in French",
        card_ids: ["c1"],
        accept: ["Bonjour", "bonjour"],
        distractors: ["salut"],
      },
    },
    {
      id: "e-tiles",
      type: "exercise",
      exercise: {
        id: "e-tiles",
        type: "word_tiles",
        prompt: "Arrange: I am here",
        card_ids: ["c4"],
        tiles: ["Je", "suis", "ici"],
        accept_orderings: [[0, 1, 2]],
        distractors: [],
      },
    },
    {
      id: "e-cloze",
      type: "exercise",
      exercise: {
        id: "e-cloze",
        type: "cloze",
        prompt: "Fill the blank",
        card_ids: ["c4"],
        sentence: "Je ___ ici",
        blanks: [{ accept: ["suis"] }],
        cloze_mode: "type",
        distractors: [],
      },
    },
    {
      id: "e-pic",
      type: "exercise",
      exercise: {
        id: "e-pic",
        type: "picture_choice",
        prompt: "Which is 'red'?",
        card_ids: ["c5"],
        images: [
          { src: "img/rouge.png", label: "rouge", is_correct: "true" },
          { src: "img/bleu.png", label: "bleu", is_correct: "false" },
          { src: "img/vert.png", label: "vert", is_correct: "false" },
        ],
        distractors: [],
      },
    },
  ],
});
