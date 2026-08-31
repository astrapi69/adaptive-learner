/**
 * Speech-recording rows + namespace (engine#68 idea 3: speak-and-record).
 *
 * Parallel to ``lesson-progress.ts`` but one level deeper (``exercise_id``,
 * not just the lesson): a lesson can carry several speak-and-record
 * exercises, each with its own clip. Re-recording overwrites the existing
 * row - there is no history, unlike ``LessonProgress.attempt_history``.
 */

export interface SpeechRecording {
  id: string;
  user_id: string;
  source: string;
  set_id: string;
  lesson_filename: string;
  exercise_id: string;
  /** Base64-encoded audio clip (the app's established convention for
   *  user-media-like fields, mirroring ``UserSettings.avatar`` - no
   *  multipart/file-upload endpoint exists). */
  audio_base64: string;
  mime_type: string;
  duration_ms: number;
  recorded_at: string;
  updated_at: string;
}

export interface SpeechRecordingUpsertBody {
  source: string;
  set_id: string;
  lesson_filename: string;
  exercise_id: string;
  audio_base64: string;
  mime_type: string;
  duration_ms: number;
}

/**
 * Per-user x per-exercise recorded-clip storage. Ungraded by design (no
 * SRS/ElementError row for this exercise type): this namespace IS the
 * exercise's entire persisted state.
 */
export interface ISpeechRecordingsNamespace {
  get(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
    exerciseId: string,
  ): Promise<SpeechRecording | null>;
  save(userId: string, body: SpeechRecordingUpsertBody): Promise<SpeechRecording>;
  delete(
    userId: string,
    source: string,
    setId: string,
    lessonFilename: string,
    exerciseId: string,
  ): Promise<void>;
}
