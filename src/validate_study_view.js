/** Validate version 1 replies without making grading or scheduling decisions. */
import { freeze, string } from "./wire_values.js";

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

/**
 * Use at the transport boundary before trusting a response as a Study view.
 * The server produces the wire value; rendering/controller code consumes the
 * immutable copy. Unknown fields (including accidental answer keys) are rejected.
 *
 * @example
 * const view = validateStudyView(JSON.parse(responseText));
 * // view.status selects the attempt, empty, or error presentation.
 */
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
