// Usage scenarios for src/validate_study_view.js, exercised through the public package barrel.
import assert from "node:assert/strict";
import test from "node:test";
import { validateStudyView } from "./index.js";
import { ready, complete } from "./view_fixtures.js";

test("external replies have a strict versioned schema and become immutable copies", () => {
  const original = ready();
  const view = validateStudyView(original);
  assert.deepEqual(view, original);
  assert.notEqual(view, original);
  assert.ok(Object.isFrozen(view.prompt));
  original.prompt.instruction = "changed elsewhere";
  assert.equal(view.prompt.instruction, "Find the move");
  assert.deepEqual(validateStudyView({ schema_version: 1, status: "empty", dataset_id: "d" }), {
    schema_version: 1, status: "empty", dataset_id: "d",
  });
  assert.equal(validateStudyView(complete()).status, "complete");
  assert.equal(validateStudyView(complete({ status: "abandoned", assessment: null })).status, "abandoned");
  assert.equal(validateStudyView({ schema_version: 1, status: "error", code: "offline", message: "Retry", retryable: true }).retryable, true);
});

test("malformed or unsupported replies are rejected, including extra solution fields", () => {
  const malformed = [
    null, [], {}, ready({ schema_version: 2 }), ready({ status: "unknown" }),
    ready({ dataset_id: 1 }), ready({ revision: -1 }), ready({ revision: 0.5 }),
    ready({ content_version: 0 }), ready({ prompt: null }),
    ready({ prompt: { ...ready().prompt, decision_index: 2 } }),
    ready({ feedback: { correct: "true", message: "x", autoplay: [] } }),
    ready({ feedback: { correct: true, message: "x", autoplay: ["e7e5"] } }),
    ready({ assessment: "partial" }), ready({ solution: ["e2e4"] }),
    complete({ prompt: ready().prompt }),
    { schema_version: 1, status: "empty" },
    { schema_version: 1, status: "error", code: "bad", message: "x", retryable: "yes" },
  ];
  malformed.forEach((value) => assert.throws(() => validateStudyView(value), TypeError));
});
