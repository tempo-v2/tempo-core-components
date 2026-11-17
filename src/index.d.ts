export type Assessment = "good" | "again" | null;
export interface Prompt {
  readonly fen: string;
  readonly instruction: string;
  readonly decision_index: number;
  readonly decision_count: number;
}
export interface Feedback {
  readonly correct: boolean;
  readonly message: string;
  readonly autoplay: readonly { readonly uci: string }[];
}
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
export interface ReadyView extends AttemptViewBase {
  readonly status: "ready";
  readonly prompt: Prompt;
}
export interface FinishedView extends AttemptViewBase {
  readonly status: "complete" | "abandoned";
  readonly prompt: null;
}
export interface EmptyView {
  readonly schema_version: 1;
  readonly status: "empty";
  readonly dataset_id: string;
}
export interface ErrorView {
  readonly schema_version: 1;
  readonly status: "error";
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}
export type StudyView = ReadyView | FinishedView | EmptyView | ErrorView;
export interface AttemptCommandBase {
  readonly dataset_id: string;
  readonly attempt_id: string;
  readonly submission_id: string;
  readonly expected_revision: number;
}
export type StudyCommand =
  | { readonly command: "next" }
  | { readonly command: "resume"; readonly attempt_id: string }
  | (AttemptCommandBase & {
      readonly command: "answer";
      readonly answer: { readonly uci: string };
    })
  | (AttemptCommandBase & { readonly command: "abandon" });
export interface RenderState {
  readonly busy: boolean;
  readonly canRetry: boolean;
}
export interface ControllerState extends RenderState {
  readonly view: StudyView | null;
}
export interface StudyTransport {
  send(command: StudyCommand): Promise<unknown>;
}
export interface StudyController {
  getState(): ControllerState;
  next(): Promise<StudyView | null>;
  resume(attemptId: string): Promise<StudyView | null>;
  answer(uci: string): Promise<StudyView | null>;
  abandon(): Promise<StudyView | null>;
  retry(): Promise<StudyView | null>;
}
/** Reject malformed data and return an immutable copy of a version 1 view. */
export function validateStudyView(value: unknown): StudyView;
/** Pure escaped HTML; consumers attach events using the data-action attributes. */
export function renderStudy(view: StudyView | null, state?: Partial<RenderState>): string;
export function createStudyController(options: {
  transport: StudyTransport;
  render(view: StudyView | null, state: RenderState): void;
  makeSubmissionId(): string;
}): StudyController;
