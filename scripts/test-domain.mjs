import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".sites-runtime/tests", { recursive: true });
const tests = ["domain", "ingredient-reference"];
await build({
  entryPoints: tests.map((name) => `tests/${name}.test.ts`),
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: ".sites-runtime/tests",
  outExtension: { ".js": ".mjs" },
});
process.exit(
  spawnSync(
    process.execPath,
    ["--test", ...tests.map((name) => `.sites-runtime/tests/${name}.test.mjs`)],
    { stdio: "inherit" },
  ).status ?? 1,
);
