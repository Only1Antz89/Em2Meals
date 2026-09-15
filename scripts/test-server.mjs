import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
await build({
  entryPoints: ["tests/server.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".sites-runtime/tests/server.test.mjs",
  plugins: [
    {
      name: "local-test-runtime",
      setup(b) {
        b.onResolve(
          { filter: /^(cloudflare:workers|@\/app\/chatgpt-auth)$/ },
          () => ({ path: resolve("tests/runtime-fixture.ts") }),
        );
      },
    },
  ],
});
process.exit(
  spawnSync(
    process.execPath,
    ["--test", ".sites-runtime/tests/server.test.mjs"],
    { stdio: "inherit" },
  ).status ?? 1,
);
