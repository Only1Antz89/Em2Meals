import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
await build({
  entryPoints: ["tests/server.test.ts", "tests/access.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: ".sites-runtime/tests",
  outExtension: { ".js": ".mjs" },
  plugins: [
    {
      name: "local-test-runtime",
      setup(b) {
        b.onResolve(
          { filter: /^(cloudflare:workers|@\/app\/chatgpt-auth)$/ },
          () => ({ path: resolve("tests/runtime-fixture.ts") }),
        );
        // Team management talks to Clerk; tests use a local stand-in.
        b.onResolve({ filter: /^@\/lib\/clerk-admin$/ }, () => ({
          path: resolve("tests/clerk-admin-stub.ts"),
        }));
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
    [
      "--test",
      ".sites-runtime/tests/server.test.mjs",
      ".sites-runtime/tests/access.test.mjs",
    ],
    { stdio: "inherit" },
  ).status ?? 1,
);
