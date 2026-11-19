import { build } from "esbuild";
import { copyFile } from "node:fs/promises";

await build({
  entryPoints: ["main.jsx"],
  bundle: true,
  format: "esm",
  outdir: "public",
  loader: { ".svg": "file" },
});
await copyFile("index.html", "public/index.html");
