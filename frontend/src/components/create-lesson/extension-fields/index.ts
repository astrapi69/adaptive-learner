/**
 * Barrel for the extension sub-question authoring fields (#1852, editors 3+4;
 * #1887 added dictation, editor 5): the shared {@link SubQuestionEditor} and
 * the type-specific field surfaces (reading-comprehension, graded-quiz,
 * dictation).
 */

export {default as SubQuestionEditor} from "./SubQuestionEditor";
export {default as ReadingComprehensionFields} from "./ReadingComprehensionFields";
export {default as GradedQuizFields} from "./GradedQuizFields";
export {default as DictationFields} from "./DictationFields";
