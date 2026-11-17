/** Coordinate intent delivery and recovery without interpreting answers. */
import { validateStudyView } from "./validate_study_view.js";
import { freeze, string } from "./wire_values.js";

/**
 * UI state consists of the current view, a busy flag and an unresolved command.
 * Use this to bind Next/Answer/Abandon actions to an injected transport. The
 * application supplies IDs once per new action; retries reuse the frozen command.
 * Rendering receives the validated view plus busy/canRetry state. Domain rules
 * stay behind transport.send. See src/study_controller.scenarios.js for a full
 * answer, a lost reply, and a busy double-click.
 *
 * A transport rejection or malformed response rejects the action promise and
 * keeps the command unresolved. Recover it with retry() before a new intent.
 */
export function createStudyController({ transport, render, makeSubmissionId }) {
  if (typeof transport?.send !== "function" || typeof render !== "function"
      || typeof makeSubmissionId !== "function") {
    throw new TypeError("transport.send, render and makeSubmissionId must be functions");
  }
  let view = null;
  let busy = false;
  let pending = null;
  const getState = () => ({ view, busy, canRetry: pending !== null && !busy });
  const notify = () => render(view, { busy, canRetry: pending !== null && !busy });

  async function send(command) {
    busy = true;
    pending = command;
    try {
      notify();
      const response = validateStudyView(await transport.send(command));
      view = response;
      pending = response.status === "error" && response.retryable ? command : null;
      return response;
    } finally {
      busy = false;
      notify();
    }
  }

  function begin(build) {
    if (busy) return Promise.resolve(null);
    if (pending !== null) {
      return Promise.reject(new Error("Retry the unresolved command before sending a new intent"));
    }
    try { return send(freeze(build())); } catch (error) { return Promise.reject(error); }
  }

  function attemptCommand(command) {
    if (view?.status !== "ready") throw new Error("This action requires a ready exercise");
    return {
      command,
      dataset_id: view.dataset_id,
      attempt_id: view.attempt_id,
      submission_id: string(makeSubmissionId(), "submission_id", true),
      expected_revision: view.revision,
    };
  }

  return Object.freeze({
    getState,
    next: () => begin(() => ({ command: "next" })),
    resume: (attemptId) => begin(() => ({
      command: "resume", attempt_id: string(attemptId, "attempt_id", true),
    })),
    answer: (uci) => begin(() => ({
      ...attemptCommand("answer"), answer: { uci: string(uci, "answer.uci", true) },
    })),
    abandon: () => begin(() => attemptCommand("abandon")),
    retry: () => {
      if (busy) return Promise.resolve(null);
      if (pending === null) return Promise.reject(new Error("There is no unresolved command to retry"));
      return send(pending);
    },
  });
}
