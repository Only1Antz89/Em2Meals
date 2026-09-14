import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".sites-runtime/tests", { recursive: true });
await build({
  entryPoints: ["tests/domain.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".sites-runtime/tests/domain.test.mjs",
});
process.exit(
  spawnSync(
    process.execPath,
    ["--test", ".sites-runtime/tests/domain.test.mjs"],
    { stdio: "inherit" },
  ).status ?? 1,
);
