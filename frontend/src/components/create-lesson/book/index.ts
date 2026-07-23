/**
 * #1927 — barrel for the book-text wizard concern (paste + file upload
 * + review), grouped out of ``create-lesson/`` per the god-folder rule.
 */
export {default as BookSteps} from "./BookSteps";
export {default as BookTextStep, type BookFields} from "./BookTextStep";
export {default as BookFileUpload} from "./BookFileUpload";
