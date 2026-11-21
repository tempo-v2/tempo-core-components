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

async function checkButtonHints(page, url) {
  await page.goto(url);
  const tip = page.getByRole("tooltip");
  const info = page.getByRole("button", { name: "Info", exact: true });
  const activations = page.getByLabel("Info activations");
  await info.evaluate(button => {
    button.addEventListener("pointerenter", () => { window.infoEnteredAt = performance.now(); }, { once: true });
    button.nextElementSibling.addEventListener("beforetoggle", event => {
      if (event.newState === "open") window.infoOpenedAt = performance.now();
    });
  });
  await info.hover();
  assert.equal(await tip.count(), 0);
  await tip.waitFor();
  assert.equal(await tip.innerText(), "Info");
  assert.ok(await page.evaluate(() => window.infoOpenedAt - window.infoEnteredAt >= 495));
  await tip.hover();
  await page.waitForTimeout(160);
  assert.ok(await tip.isVisible(), "the pointer can reach the tooltip");
  assert.equal(await activations.innerText(), "0");
  await page.mouse.move(0, 0);
  await tip.waitFor({ state: "hidden" });

  const open = page.getByRole("button", { name: "Open", exact: true });
  await open.focus();
  await page.keyboard.press("Tab");
  assert.ok(await info.evaluate(button => document.activeElement === button));
  assert.ok(await tip.isVisible(), "keyboard focus shows the tooltip immediately");
  await page.keyboard.press("Escape");
  await tip.waitFor({ state: "hidden" });
  assert.ok(await info.evaluate(button => document.activeElement === button));
  await page.keyboard.press("Space");
  assert.equal(await activations.innerText(), "1");

  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await tip.waitFor();
  await info.evaluate(button => {
    document.body.style.minHeight = "250vh";
    window.scrollBy(0, button.getBoundingClientRect().bottom + 32);
  });
  assert.ok(await info.evaluate(button => button.getBoundingClientRect().bottom < 0));
  await tip.waitFor({ state: "hidden" });
  assert.ok(await info.evaluate(button => document.activeElement === button));

  await open.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Choose" });
  await dialog.evaluate(node => Object.assign(node.style, { width: "80px", padding: "4px", overflow: "hidden" }));
  const close = dialog.getByRole("button", { name: "Close" });
  await close.hover();
  await tip.waitFor();
  assert.equal(await tip.innerText(), "Close this dialog Esc");
  assert.equal(await close.getAttribute("aria-keyshortcuts"), "Escape");
  assert.equal(await close.getAttribute("aria-describedby"), await tip.getAttribute("id"));
  const placement = await tip.evaluate(node => {
    const { left, right, top, height } = node.getBoundingClientRect();
    const dialogBounds = node.closest("dialog").getBoundingClientRect();
    const x = left + 8 < dialogBounds.left ? left + 8 : right - 8;
    const hit = document.elementFromPoint(x, top + height / 2);
    return { outsideDialog: x < dialogBounds.left || x > dialogBounds.right, hitTooltip: node.contains(hit) };
  });
  assert.deepEqual(placement, { outsideDialog: true, hitTooltip: true });
  await page.keyboard.press("Escape");
  await tip.waitFor({ state: "hidden" });
  assert.ok(await dialog.isVisible());
  assert.ok(await close.evaluate(button => document.activeElement === button));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.ok(await open.evaluate(button => document.activeElement === button));

  // A top-right anchor must have room for the tooltip at a narrow width.
  await page.setViewportSize({ width: 320, height: 600 });
  await info.evaluate(button => Object.assign(button.style, { position: "fixed", right: "0", top: "0" }));
  await info.hover();
  await tip.waitFor();
  assert.ok(await tip.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight &&
      bounds.top >= node.previousElementSibling.getBoundingClientRect().bottom;
  }));
}

export async function checkPackedConsumer(t) {
  const { chromium, devices, webkit } = await import(process.env.TEMPO_PLAYWRIGHT);
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
  const url = `http://127.0.0.1:${server.address().port}/`;
  await page.goto(url);

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

  const handle = page.locator(".tempo-board-resize-handle");
  const expectSize = width => page.waitForFunction(width => {
    const bounds = document.querySelector("cg-board")?.getBoundingClientRect();
    return bounds?.width === width && bounds.height === width;
  }, width);
  const startResize = async () => {
    const { x, y, width, height } = await handle.boundingBox();
    const point = [x + width / 2, y + height / 2];
    await page.mouse.move(...point);
    await page.mouse.down();
    return point;
  };
  const resize = async delta => {
    const [x, y] = await startResize();
    await page.mouse.move(x + delta, y + delta / 2, { steps: 4 });
    await page.mouse.up();
  };
  await expectSize(320);
  await handle.click();
  await expectSize(320);
  await resize(-300);
  await expectSize(240);
  const [cornerX, cornerY] = await position("h1");
  assert(await board.evaluate((element, [x, y]) => element.contains(document.elementFromPoint(x, y)), [cornerX, cornerY]));
  await resize(40);
  await expectSize(280);
  await resize(400);
  await expectSize(320);
  await resize(-45);
  await expectSize(272);

  await handle.evaluate(element => {
    element.addEventListener("pointerdown", event => {
      element.dataset.pointerId = event.pointerId;
    }, { once: true });
  });
  const [x, y] = await startResize();
  await handle.evaluate(element => {
    element.dispatchEvent(new PointerEvent("pointercancel", {
      bubbles: true, pointerId: Number(element.dataset.pointerId),
    }));
  });
  await page.mouse.move(x - 70, y - 35);
  await page.mouse.up();
  await expectSize(272);
  assert.deepEqual(await events(), []);
  assert.equal(await page.locator("output").getAttribute("data-surface-pointer-arguments"), null);

  const [toggleX, toggleY] = await startResize();
  await updateDuringInput("Toggle board resizing");
  await handle.waitFor({ state: "hidden" });
  await expectSize(320);
  await page.mouse.move(toggleX - 60, toggleY - 30);
  await page.mouse.up();
  await button("Toggle board resizing").click();
  await handle.waitFor();
  await expectSize(272);

  await hold("e2");
  assert.equal(await page.locator("output").getAttribute("data-surface-pointer-arguments"), "0");
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
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const trigger = button("Show confirmation");
  const toast = page.locator(".ui-toast");
  const message = toast.getByText("Saved.", { exact: true });
  await toast.waitFor({ state: "attached" });
  assert.equal(await toast.getAttribute("role"), "status");
  assert.equal(await toast.getAttribute("aria-atomic"), "true");
  await trigger.click();
  await message.waitFor();
  assert.ok(await trigger.evaluate(element => document.activeElement === element));
  assert.equal(await message.evaluate(element => getComputedStyle(element).transitionDuration), "0.2s");

  const firstMessage = await message.elementHandle();
  const triggerElement = await trigger.elementHandle();
  await toast.evaluate((element, trigger) => {
    const events = [];
    window.toastEvents = events;
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "attributes") {
          events.push({ kind: "fade", time: performance.now() });
          if (events.length === 1) trigger.click();
        } else if (record.addedNodes.length) {
          events.push({
            kind: "replace",
            time: performance.now(),
            opacity: getComputedStyle(record.addedNodes[0]).opacity,
          });
        } else {
          events.push({ kind: "dismiss", time: performance.now() });
        }
      }
    }).observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-fading"] });
  }, triggerElement);
  await page.waitForFunction(element => !element.isConnected, firstMessage);
  await message.waitFor({ state: "detached" });
  const toastEvents = await page.evaluate(() => window.toastEvents);
  assert.deepEqual(toastEvents.map(event => event.kind), ["fade", "dismiss", "replace", "fade", "dismiss"]);
  assert.equal(toastEvents[2].opacity, "1");
  assert.ok(toastEvents[3].time - toastEvents[2].time >= 3900);
  assert.ok(toastEvents[4].time - toastEvents[3].time >= 175);
  assert.equal(await toast.count(), 1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await message.waitFor();
  assert.equal(await message.evaluate(element => getComputedStyle(element).transitionDuration), "0s");
  await message.waitFor({ state: "detached" });
  assert.deepEqual(await page.evaluate(() => window.toastEvents.slice(-2).map(event => event.kind)),
    ["replace", "dismiss"]);
  assert.deepEqual(pageErrors, []);

  const chromeHints = await browser.newPage();
  chromeHints.on("pageerror", error => pageErrors.push(error.message));
  await checkButtonHints(chromeHints, url);
  const safari = await webkit.launch();
  t.after(() => safari.close());
  const safariHints = await safari.newPage();
  safariHints.on("pageerror", error => pageErrors.push(error.message));
  await checkButtonHints(safariHints, url);
  const phone = await safari.newPage({ ...devices["iPhone 15"], viewport: { width: 375, height: 600 } });
  phone.on("pageerror", error => pageErrors.push(error.message));
  await phone.goto(url);
  const info = phone.getByRole("button", { name: "Info", exact: true });
  const hitTarget = await info.boundingBox();
  assert.ok(hitTarget?.width >= 44 && hitTarget?.height >= 44);
  await info.tap();
  assert.equal(await phone.getByLabel("Info activations").innerText(), "1");
  await phone.waitForTimeout(550);
  assert.equal(await phone.getByRole("tooltip").count(), 0);
  assert.deepEqual(pageErrors, []);
}
