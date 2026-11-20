import test from "node:test";
import assert from "node:assert/strict";
import * as core from "../dist/index.js";

test("built public package exposes presentation primitives", () => {
  for (const name of ["Board", "Button", "IconButton", "PageHeader", "SectionHeader",
    "Surface", "Dialog", "StatusNotice"]) {
    assert.ok(core[name], name);
  }
  assert.equal(core.fitBoardSize(369, 380), 368);
});

test("packed public Board and Dialog honor the standalone consumer contract", {
  skip: !process.env.TEMPO_PLAYWRIGHT && "Set TEMPO_PLAYWRIGHT to run against Chrome.",
  timeout: 60_000,
}, async t => {
  const { checkPackedConsumer } = await import("./standalone.browser.mjs");
  await checkPackedConsumer(t);
});
