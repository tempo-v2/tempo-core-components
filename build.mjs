import { build } from "esbuild";
import { copyFile, cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/index.js"],
  outfile: "dist/index.js",
  bundle: true,
  jsx: "automatic",
  format: "esm",
  platform: "browser",
  external: ["react", "react/jsx-runtime"],
});
await copyFile("src/index.d.ts", "dist/index.d.ts");
await copyFile("board/src/types.ts", "dist/board-types.d.ts");

// Redistribute the exact corresponding source of bundled Chessground.
await mkdir("dist/corresponding-sources/chessground", { recursive: true });
await cp(
  "node_modules/@lichess-org/chessground/src",
  "dist/corresponding-sources/chessground/src",
  { recursive: true },
);
await copyFile(
  "node_modules/@lichess-org/chessground/LICENSE",
  "dist/corresponding-sources/chessground/LICENSE",
);
await copyFile(
  "node_modules/@lichess-org/chessground/package.json",
  "dist/corresponding-sources/chessground/package.json",
);
