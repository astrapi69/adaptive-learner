// Parent barrel for components/exercises (grouped by concern, #809). Re-export only.
// Public surface of the exercise UI: dispatcher + controlled-exercise contract
// (shell), the five type renderers (renderers), and answer/feedback affordances
// (feedback). Consumers import from "components/exercises", not deep paths.
export * from "./shell";
export * from "./renderers";
export * from "./feedback";
