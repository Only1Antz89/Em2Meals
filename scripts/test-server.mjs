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
        // Route handlers run outside a Next.js request scope in unit tests.
        b.onResolve({ filter: /^next\/server$/ }, () => ({
          path: resolve("tests/next-server-stub.ts"),
        }));
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
