/** Whole-attempt result supplied by the application; never computed by the UI. */
export type Assessment = "good" | "again" | null;
/** The displayed learner decision, with no expected move or answer key. */
export interface Prompt {
  readonly fen: string;
  readonly instruction: string;
  readonly decision_index: number;
  readonly decision_count: number;
}
/** Feedback and automatic replies produced by the server-side grader. */
export interface Feedback {
  readonly correct: boolean;
  readonly message: string;
  readonly autoplay: readonly { readonly uci: string }[];
}
/** Server identities copied into later answer/abandon commands. */
export interface AttemptViewBase {
  readonly schema_version: 1;
  readonly dataset_id: string;
  readonly attempt_id: string;
  readonly target_id: string;
  readonly content_version: number;
  readonly revision: number;
  readonly feedback: Feedback | null;
  readonly assessment: Assessment;
}
/** Use the prompt to render the current decision and accept a user move. */
export interface ReadyView extends AttemptViewBase {
  readonly status: "ready";
  readonly prompt: Prompt;
}
/** No further answer is accepted through this displayed attempt. */
export interface FinishedView extends AttemptViewBase {
  readonly status: "complete" | "abandoned";
  readonly prompt: null;
}
/** Nothing eligible now; Next can be requested again after conditions change. */
export interface EmptyView {
  readonly schema_version: 1;
  readonly status: "empty";
  readonly dataset_id: string;
}
/** Whether to retain a command for retry is supplied by the application. */
export interface ErrorView {
  readonly schema_version: 1;
  readonly status: "error";
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}
/** Branch on status when consuming the validated application reply. */
export type StudyView = ReadyView | FinishedView | EmptyView | ErrorView;
