import type { StudyView } from "./study_view.js";
import type { StudyCommand } from "./study_command.js";

export interface RenderState {
  readonly busy: boolean;
  readonly canRetry: boolean;
}
export interface ControllerState extends RenderState {
  readonly view: StudyView | null;
}
/** Adapter implemented by the host, e.g. stdio in the application demo. */
export interface StudyTransport {
  send(command: StudyCommand): Promise<unknown>;
}
/** New actions are blocked while a command is busy or awaiting recovery. */
export interface StudyController {
  getState(): ControllerState;
  next(): Promise<StudyView | null>;
  resume(attemptId: string): Promise<StudyView | null>;
  answer(uci: string): Promise<StudyView | null>;
  abandon(): Promise<StudyView | null>;
  retry(): Promise<StudyView | null>;
}
/** Bind intents to a transport and render callback; the server owns domain decisions. */
export function createStudyController(options: {
  transport: StudyTransport;
  render(view: StudyView | null, state: RenderState): void;
  makeSubmissionId(): string;
}): StudyController;
