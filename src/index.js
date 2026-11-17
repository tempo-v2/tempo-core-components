/** The UI boundary consumes views and emits intent. It never decides grades. */

const ASSESSMENTS = new Set([null, "good", "again"]);
const ATTEMPT_STATUSES = new Set(["ready", "complete", "abandoned"]);

function object(value, keys, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new TypeError(`${name} has missing or unexpected fields`);
  }
}

function string(value, name, nonempty = false) {
  if (typeof value !== "string" || (nonempty && value.length === 0)) {
    throw new TypeError(`${name} must be ${nonempty ? "a nonempty" : "a"} string`);
  }
  return value;
}

function integer(value, minimum, name) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name} must be a safe integer >= ${minimum}`);
  }
  return value;
}

function boolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
  return value;
}

function freeze(value) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Validate and copy external wire data before handing it to presentation code. */
export function validateStudyView(value) {
  if (value === null || typeof value !== "object" || value.schema_version !== 1) {
    throw new TypeError("Expected a Study wire view with schema_version 1");
  }
  if (value.status === "empty") {
    object(value, ["schema_version", "status", "dataset_id"], "empty view");
    return freeze({
      schema_version: 1,
      status: "empty",
      dataset_id: string(value.dataset_id, "dataset_id", true),
    });
  }
  if (value.status === "error") {
    object(value, ["schema_version", "status", "code", "message", "retryable"], "error view");
    return freeze({
      schema_version: 1,
      status: "error",
      code: string(value.code, "code", true),
      message: string(value.message, "message"),
      retryable: boolean(value.retryable, "retryable"),
    });
  }
  if (!ATTEMPT_STATUSES.has(value.status)) throw new TypeError("Unknown Study view status");
  object(value, [
    "schema_version", "status", "dataset_id", "attempt_id", "target_id",
    "content_version", "revision", "prompt", "feedback", "assessment",
  ], "attempt view");
  if (!ASSESSMENTS.has(value.assessment)) throw new TypeError("Invalid assessment");

  let prompt = null;
  if (value.prompt !== null) {
    object(value.prompt, ["fen", "instruction", "decision_index", "decision_count"], "prompt");
    const index = integer(value.prompt.decision_index, 0, "decision_index");
    const count = integer(value.prompt.decision_count, 1, "decision_count");
    if (index >= count) throw new TypeError("decision_index must be less than decision_count");
    prompt = {
      fen: string(value.prompt.fen, "fen", true),
      instruction: string(value.prompt.instruction, "instruction"),
      decision_index: index,
      decision_count: count,
    };
  }
  if ((value.status === "ready") !== (prompt !== null)) {
    throw new TypeError("Only a ready view may contain a prompt, and it must contain one");
  }
  let feedback = null;
  if (value.feedback !== null) {
    object(value.feedback, ["correct", "message", "autoplay"], "feedback");
    if (!Array.isArray(value.feedback.autoplay)) throw new TypeError("autoplay must be an array");
    feedback = {
      correct: boolean(value.feedback.correct, "feedback.correct"),
      message: string(value.feedback.message, "feedback.message"),
      autoplay: value.feedback.autoplay.map((move) => {
        object(move, ["uci"], "autoplay move");
        return { uci: string(move.uci, "autoplay.uci", true) };
      }),
    };
  }
  return freeze({
    schema_version: 1,
    status: value.status,
    dataset_id: string(value.dataset_id, "dataset_id", true),
    attempt_id: string(value.attempt_id, "attempt_id", true),
    target_id: string(value.target_id, "target_id", true),
    content_version: integer(value.content_version, 1, "content_version"),
    revision: integer(value.revision, 0, "revision"),
    prompt,
    feedback,
    assessment: value.assessment,
  });
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

/** Pure HTML presentation; event binding and transport remain with the caller. */
export function renderStudy(input, { busy = false, canRetry = false } = {}) {
  const view = input === null ? null : validateStudyView(input);
  const disabled = busy || canRetry ? " disabled" : "";
  const status = view?.status ?? "initial";
  let body = "<p>Select Next to begin.</p>";
  if (status === "ready") {
    body = `<p>${escape(view.prompt.instruction)}</p>`
      + `<p>Decision ${view.prompt.decision_index + 1} of ${view.prompt.decision_count}</p>`
      + `<figure><figcaption>Position (board rendering placeholder)</figcaption>`
      + `<pre aria-label="Position FEN">${escape(view.prompt.fen)}</pre></figure>`
      + `<form data-action="answer"><label>Move (UCI) `
      + `<input name="uci" autocomplete="off" required${disabled}></label>`
      + `<button type="submit"${disabled}>Submit move</button></form>`
      + `<button type="button" data-action="abandon"${disabled}>Abandon exercise</button>`;
  } else if (status === "complete") {
    body = "<p>Exercise complete.</p>";
  } else if (status === "abandoned") {
    body = "<p>Exercise abandoned.</p>";
  } else if (status === "empty") {
    body = "<p>No eligible exercises right now.</p>";
  } else if (status === "error") {
    body = `<p role="alert">${escape(view.message)}</p>`;
  }
  if (view?.feedback) {
    body += `<p role="status">${escape(view.feedback.message)}</p>`;
    if (view.feedback.autoplay.length) {
      body += `<p>Autoplay: ${view.feedback.autoplay.map((move) => escape(move.uci)).join(", ")}</p>`;
    }
  }
  if (view?.assessment) body += `<p>Assessment: ${escape(view.assessment)}</p>`;
  if (canRetry) {
    body += "<p>The previous request needs recovery. Retry sends the same request.</p>"
      + `<button type="button" data-action="retry"${busy ? " disabled" : ""}>Retry</button>`;
  }
  return `<section aria-label="Study" aria-busy="${Boolean(busy)}" data-status="${status}">`
    + `<h2>Study</h2>${body}`
    + `<button type="button" data-action="next"${disabled}>Next exercise</button></section>`;
}

/**
 * UI state consists of the current view, a busy flag and an unresolved command.
 * No learning, queue or grading decisions occur here. The caller supplies IDs.
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
