import assert from "node:assert/strict";
import test from "node:test";
import { createStudyController, renderStudy, validateStudyView } from "../src/index.js";

const ready = (changes = {}) => ({
  schema_version: 1, status: "ready", dataset_id: "dataset-1",
  attempt_id: "attempt-1", target_id: "tactic-1", content_version: 1, revision: 0,
  prompt: { fen: "fixture FEN", instruction: "Find the move", decision_index: 0, decision_count: 2 },
  feedback: null, assessment: null, ...changes,
});
const complete = (changes = {}) => ready({ status: "complete", prompt: null, assessment: "good", ...changes });

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

test("rendering escapes external strings and exposes intent controls without solution data", () => {
  const attack = '<img src=x onerror="alert(1)">&\'';
  const html = renderStudy(ready({
    prompt: { ...ready().prompt, instruction: attack, fen: attack },
    feedback: { correct: false, message: attack, autoplay: [{ uci: attack }] },
    assessment: "again",
  }));
  assert.equal(html.includes("<img"), false);
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;"));
  assert.ok(html.includes('data-action="answer"'));
  assert.ok(html.includes('data-action="abandon"'));
  assert.ok(html.includes("Decision 1 of 2"));
  assert.ok(html.includes("Assessment: again"));
  assert.equal(renderStudy(complete()).includes('data-action="answer"'), false);
  assert.ok(renderStudy(null).includes("Select Next"));
  assert.ok(renderStudy({ schema_version: 1, status: "empty", dataset_id: "d" }).includes("No eligible"));
});

test("busy and retry presentation disable new intents", () => {
  assert.ok(renderStudy(ready(), { busy: true }).includes('aria-busy="true"'));
  const html = renderStudy(ready(), { canRetry: true });
  assert.ok(html.includes('data-action="next" disabled'));
  assert.ok(html.includes('data-action="retry">Retry'));
});

test("controller forwards only command data with the server's expected revision", async () => {
  const sent = [];
  const rendered = [];
  let id = 0;
  const controller = createStudyController({
    transport: { send: async (command) => {
      sent.push(command);
      return command.command === "answer" ? complete({ revision: 8 }) : ready({ revision: 7 });
    } },
    render: (view, state) => rendered.push({ view, state }),
    makeSubmissionId: () => `submission-${++id}`,
  });
  await controller.next();
  await controller.answer("e2e4");
  assert.deepEqual(sent, [
    { command: "next" },
    { command: "answer", dataset_id: "dataset-1", attempt_id: "attempt-1",
      submission_id: "submission-1", expected_revision: 7, answer: { uci: "e2e4" } },
  ]);
  assert.equal(controller.getState().view.assessment, "good");
  assert.ok(rendered.some(({ state }) => state.busy));
  await assert.rejects(controller.answer("d2d4"), /ready exercise/);
  assert.equal(sent.length, 2);
});

test("resume and abandonment are separate commands with no client-side assessment", async () => {
  const sent = [];
  const controller = createStudyController({
    transport: { send: async (command) => {
      sent.push(command);
      return command.command === "abandon"
        ? complete({ status: "abandoned", assessment: null, revision: 4 })
        : ready({ revision: 3 });
    } },
    render: () => {}, makeSubmissionId: () => "abandon-1",
  });
  await controller.resume("attempt-1");
  await controller.abandon();
  assert.deepEqual(sent, [
    { command: "resume", attempt_id: "attempt-1" },
    { command: "abandon", dataset_id: "dataset-1", attempt_id: "attempt-1",
      submission_id: "abandon-1", expected_revision: 3 },
  ]);
  assert.equal(controller.getState().view.status, "abandoned");
});

test("transport failure retries the identical command and submission ID", async () => {
  const sent = [];
  let fail = true;
  let ids = 0;
  const controller = createStudyController({
    transport: { send: async (command) => {
      sent.push(command);
      if (command.command === "next") return ready();
      if (fail) { fail = false; throw new Error("response lost after commit"); }
      return complete({ revision: 1 });
    } },
    render: () => {}, makeSubmissionId: () => `s-${++ids}`,
  });
  await controller.next();
  await assert.rejects(controller.answer("e2e4"), /response lost/);
  assert.equal(controller.getState().canRetry, true);
  await assert.rejects(controller.next(), /unresolved command/);
  await controller.retry();
  assert.equal(sent[1], sent[2]);
  assert.ok(Object.isFrozen(sent[1].answer));
  assert.equal(ids, 1);
  assert.equal(controller.getState().canRetry, false);
  await assert.rejects(controller.retry(), /no unresolved command/);
});

test("a malformed reply retains the original command because its commit is unknown", async () => {
  let invalid = false;
  const sent = [];
  const controller = createStudyController({
    transport: { send: async (command) => {
      sent.push(command);
      if (command.command === "next") return ready();
      if (!invalid) { invalid = true; return { broken: true }; }
      return complete();
    } }, render: () => {}, makeSubmissionId: () => "s-1",
  });
  await controller.next();
  await assert.rejects(controller.answer("e2e4"), TypeError);
  await controller.retry();
  assert.equal(sent[1], sent[2]);
});

test("retryable application errors retain the command; final errors release it", async () => {
  const commands = [];
  const responses = [
    { schema_version: 1, status: "error", code: "busy", message: "Try again", retryable: true },
    { schema_version: 1, status: "error", code: "stale", message: "Request is stale", retryable: false },
    ready(),
  ];
  const controller = createStudyController({
    transport: { send: async (command) => { commands.push(command); return responses.shift(); } },
    render: () => {}, makeSubmissionId: () => "s-1",
  });
  await controller.next();
  assert.equal(controller.getState().canRetry, true);
  await controller.retry();
  assert.equal(commands[0], commands[1]);
  assert.equal(controller.getState().canRetry, false);
  await controller.next();
  assert.equal(controller.getState().view.status, "ready");
});

test("busy guard suppresses concurrent submission without allocating another ID", async () => {
  let release;
  let ids = 0;
  const commands = [];
  const controller = createStudyController({
    transport: { send: (command) => {
      commands.push(command);
      if (command.command === "next") return Promise.resolve(ready());
      return new Promise((resolve) => { release = () => resolve(complete()); });
    } }, render: () => {}, makeSubmissionId: () => `s-${++ids}`,
  });
  await controller.next();
  const first = controller.answer("e2e4");
  assert.equal(controller.getState().busy, true);
  assert.equal(await controller.answer("d2d4"), null);
  assert.equal(await controller.retry(), null);
  assert.equal(ids, 1);
  assert.equal(commands.length, 2);
  release();
  await first;
  assert.equal(controller.getState().busy, false);
});
