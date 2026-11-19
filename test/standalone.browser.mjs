import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const contentTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

export async function checkPackedConsumer(t) {
  const { chromium } = await import(process.env.TEMPO_PLAYWRIGHT);
  const temporary = mkdtempSync(join(tmpdir(), "tempo-core-packed-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const consumer = join(temporary, "consumer");
  cpSync(join(packageRoot, "examples/standalone"), consumer, { recursive: true });
  const npm = (args, cwd) => execFileSync("npm", args, { cwd, encoding: "utf8" });
  const [packed] = JSON.parse(npm(["pack", "--json", "--pack-destination", temporary], packageRoot));
  const tarball = join(temporary, packed.filename);
  const sha256 = createHash("sha256").update(readFileSync(tarball)).digest("hex");
  t.diagnostic(`Installed Core ${packed.version}, SHA-256 ${sha256}`);
  npm([
    "install", "--ignore-scripts", "--no-audit", "--no-fund",
    ...(process.env.TEMPO_NPM_OFFLINE ? ["--offline"] : []),
    tarball,
  ], consumer);
  npm(["run", "build"], consumer);

  const publicDirectory = join(consumer, "public");
  const files = new Map(readdirSync(publicDirectory).map(file => [
    file, readFileSync(join(publicDirectory, file)),
  ]));
  const server = createServer((request, response) => {
    const file = request.url === "/" ? "index.html" : request.url.slice(1);
    const bytes = files.get(file);
    if (!bytes) return response.writeHead(404).end();
    response.writeHead(200, { "content-type": contentTypes[extname(file)] ?? "application/octet-stream" });
    response.end(bytes);
  });
  t.after(() => server.close());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);

  const board = page.locator("cg-board");
  await board.waitFor({ state: "visible" });
  const button = name => page.getByRole("button", { name, exact: true });
  const updateDuringInput = name => button(name).evaluate(element => element.click());
  const events = async () => JSON.parse(await page.locator("output").textContent());
  const position = async square => {
    const { x, y, width, height } = await board.boundingBox();
    return [
      x + (square.charCodeAt(0) - "a".charCodeAt(0) + 0.5) * width / 8,
      y + (8.5 - Number(square[1])) * height / 8,
    ];
  };
  const hold = async square => {
    const [x, y] = await position(square);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 10, y - 10);
  };
  const release = async square => {
    await page.mouse.move(...await position(square), { steps: 4 });
    await page.mouse.up();
  };
  const drag = async (from, to) => {
    await hold(from);
    await release(to);
  };
  const expectCount = count => page.waitForFunction(expected =>
    JSON.parse(document.querySelector("output").textContent).length === expected, count,
  );
  async function expectPiece(role, square) {
    const [x, y] = await position(square);
    await page.waitForFunction(({ role, x, y }) =>
      [...document.querySelectorAll(`cg-board piece.white.${role}`)].some(piece => {
        const rectangle = piece.getBoundingClientRect();
        return Math.abs(rectangle.x + rectangle.width / 2 - x) < 6 &&
          Math.abs(rectangle.y + rectangle.height / 2 - y) < 6;
      }), { role, x, y },
    );
  }

  await hold("e2");
  await updateDuringInput("Use equivalent destinations");
  await release("e4");
  await expectCount(1);
  await expectPiece("pawn", "e4");
  await button("Restore supplied position").click();
  await expectPiece("pawn", "e2");

  await hold("e2");
  await updateDuringInput("Change position identity");
  await release("e4");
  await expectPiece("pawn", "e2");
  await hold("e2");
  await updateDuringInput("Advance position revision");
  await release("e4");
  await expectPiece("pawn", "e2");

  for (const label of ["Lock board", "Read only"]) {
    await button(label).click();
    await drag("e2", "e4");
    await button("Select e2 and e4").click();
    await expectPiece("pawn", "e2");
    await button(label).click();
  }
  await button("Select e2 and e4").click();
  await expectCount(2);

  await button("Load promotion position").click();
  await expectPiece("pawn", "a7");
  await drag("a7", "a8");
  await expectCount(3);
  await expectPiece("pawn", "a8");
  await button("Preview knight promotion").click();
  await expectPiece("knight", "a8");
  assert.deepEqual(await events(), [
    { from: "e2", to: "e4", positionIdentity: "start", positionRevision: 0 },
    { from: "e2", to: "e4", positionIdentity: "new-position", positionRevision: 1 },
    { from: "a7", to: "a8", positionIdentity: "promotion", positionRevision: 0 },
  ]);

  const asset = page.getByRole("button", { name: "Info" }).locator("img");
  assert.ok(await asset.evaluate(image => image.complete && image.naturalWidth > 0));
  await button("Open").click();
  const dialog = page.getByRole("dialog", { name: "Choose" });
  await dialog.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.ok(await button("Open").evaluate(element => document.activeElement === element));
  assert.deepEqual(pageErrors, []);
}
