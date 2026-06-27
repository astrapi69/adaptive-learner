// Parent barrel for hooks/lesson (grouped by concern, #809). Re-export only.
// modes (lesson-mode variants), session (core playback/nav), interaction
// (keyboard/hints), audio (read-aloud). Re-exports the full hook surface.
export * from "./modes";
export * from "./session";
export * from "./interaction";
export * from "./audio";
