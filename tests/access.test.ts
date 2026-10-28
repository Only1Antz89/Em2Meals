import test from "node:test";
import assert from "node:assert/strict";
import { resetDB, signInAs, env } from "./runtime-fixture";
import { clerkCalls } from "./clerk-admin-stub";
import { emptyState, type State } from "../lib/domain";
import { commitState, loadState } from "../lib/server";
import {
  can,
  commandPermission,
  sectionPermission,
  visibleState,
} from "../lib/access";
import { GET as team, POST as teamAction } from "../app/api/admin/team/route";
import { GET as state } from "../app/api/admin/state/route";
import { POST as action } from "../app/api/admin/action/route";
import { GET as exportBackup } from "../app/api/admin/export/route";

type Body = {
  error: string;
  message: string;
  link: string;
  access: { role: string };
  state: State;
  enquiries: unknown[];
  members: unknown[];
  events: { action: string }[];
  deploymentOwners: string[];
};
const json = (r: Response) => r.json() as Promise<Body>;
function post(body: unknown) {
  return new Request("http://localhost/api/admin/team", {
    method: "POST",
    headers: { Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const stateRequest = () =>
  new Request("http://localhost/api/admin/state?mode=live");
async function run(type: string, payload: unknown) {
  const { revision } = await loadState("live");
  return action(
    new Request("http://localhost/api/admin/action", {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "live",
        revision,
        command: { id: crypto.randomUUID(), type, payload },
      }),
    }),
  );
}
async function add(email: string, role: string) {
  signInAs("owner@example.com");
  const r = await teamAction(post({ action: "invite", email, role }));
  assert.equal(r.status, 200, await r.clone().text());
}

test("role permissions follow the documented matrix", () => {
  assert.ok(can("owner", "team"));
  assert.ok(can("owner", "data"));
  assert.ok(can("manager", "finance"));
  assert.ok(!can("manager", "team"));
  assert.ok(!can("manager", "data"));
  assert.ok(can("kitchen", "kitchen"));
  assert.ok(!can("kitchen", "orders"));
  assert.ok(!can("viewer", "kitchen"));
  assert.ok(!can(null, "view"));
  assert.equal(commandPermission("stage", { status: "cooked" }), "kitchen");
  assert.equal(commandPermission("stage", { status: "confirmed" }), "orders");
  assert.equal(commandPermission("stage", { status: "cancelled" }), "orders");
  assert.equal(commandPermission("invoice-issue"), "finance");
  assert.equal(commandPermission("menu-publish"), "menu-publish");
  assert.equal(commandPermission("customer-erase"), "data");
  // Anything new or unknown needs settings access, never just "view".
  assert.equal(commandPermission("something-new"), "settings");
  assert.equal(sectionPermission("business"), "finance");
  assert.equal(sectionPermission("crm"), "crm");
});

test("people not on the team are refused", async () => {
  resetDB();
  signInAs("stranger@example.com");
  const r = await state(stateRequest());
  assert.equal(r.status, 403);
  assert.match((await json(r)).error, /Workspace access required/);
  signInAs(null);
  assert.equal((await state(stateRequest())).status, 403);
});

test("kitchen staff can do kitchen work but not orders, settings or finances", async () => {
  resetDB();
  const s = emptyState();
  s.customers.push({
    id: "c1",
    name: "Client",
    company: "Co",
    email: "client@example.com",
    phone: "0123",
    notes: "Private",
  });
  await commitState("live", s, (await loadState("live")).revision);
  await add("chef@example.com", "kitchen");
  signInAs("chef@example.com");

  const r = await state(stateRequest());
  assert.equal(r.status, 200);
  const body = await json(r);
  assert.equal(body.access.role, "kitchen");
  assert.equal(body.state.customers[0].name, "Client");
  assert.equal(body.state.customers[0].email, "");
  assert.equal(body.state.customers[0].notes, "");
  assert.deepEqual(body.enquiries, []);

  const settings = await run("settings", {});
  assert.equal(settings.status, 403);
  assert.match((await json(settings)).error, /Kitchen role/);
  assert.equal((await run("stage", { orderId: "x", status: "confirmed" })).status, 403);
  assert.equal((await run("customer", {})).status, 403);
  assert.equal((await run("invoice-issue", {})).status, 403);
  // Allowed past the role check: fails only because the order doesn't exist.
  const stage = await run("stage", { orderId: "missing", status: "cooked" });
  assert.equal(stage.status, 400);
  assert.match((await json(stage)).error, /Order not found/);
  assert.equal((await exportBackup(stateRequest())).status, 403);
  assert.equal((await team()).status, 403);
});

test("viewers are read-only and managers can't manage the team", async () => {
  resetDB();
  await add("viewer@example.com", "viewer");
  await add("manager@example.com", "manager");
  signInAs("viewer@example.com");
  assert.equal((await state(stateRequest())).status, 200);
  assert.equal(
    (await run("stage", { orderId: "missing", status: "cooked" })).status,
    403,
  );
  signInAs("manager@example.com");
  const settings = await run("settings", {});
  assert.equal(settings.status, 400, "managers may change settings");
  assert.equal((await team()).status, 403);
  assert.equal(
    (await teamAction(post({ action: "invite", email: "x@example.com", role: "owner" }))).status,
    403,
  );
});

test("owners manage roles, suspension and removal with an access history", async () => {
  resetDB();
  await add("Sam@Example.com", "viewer");
  signInAs("owner@example.com");
  const duplicate = await teamAction(
    post({ action: "invite", email: "sam@example.com", role: "kitchen" }),
  );
  assert.equal(duplicate.status, 400);

  let r = await teamAction(post({ action: "role", email: "sam@example.com", role: "manager" }));
  assert.equal(r.status, 200);
  signInAs("sam@example.com");
  assert.equal((await state(stateRequest())).status, 200);
  assert.equal((await state(stateRequest()).then(json)).access.role, "manager");

  signInAs("owner@example.com");
  r = await teamAction(post({ action: "suspend", email: "sam@example.com" }));
  assert.equal(r.status, 200);
  signInAs("sam@example.com");
  assert.equal((await state(stateRequest())).status, 403);

  signInAs("owner@example.com");
  await teamAction(post({ action: "reactivate", email: "sam@example.com" }));
  signInAs("sam@example.com");
  assert.equal((await state(stateRequest())).status, 200);

  signInAs("owner@example.com");
  r = await teamAction(post({ action: "remove", email: "sam@example.com" }));
  assert.equal(r.status, 200);
  const data = await json(await team());
  assert.deepEqual(data.members, []);
  assert.deepEqual(
    data.events.map((e) => e.action).sort(),
    ["invite", "reactivate", "remove", "role", "suspend"],
  );
  assert.deepEqual(data.deploymentOwners, ["owner@example.com"]);
});

test("nobody can lock themselves or a deployment owner out", async () => {
  resetDB();
  await add("second@example.com", "owner");
  signInAs("second@example.com");
  const self = await teamAction(post({ action: "suspend", email: "second@example.com" }));
  assert.equal(self.status, 400);
  assert.match((await json(self)).error, /your own access/);
  const deployment = await teamAction(
    post({ action: "role", email: "owner@example.com", role: "viewer" }),
  );
  assert.equal(deployment.status, 400);
  assert.match((await json(deployment)).error, /OWNER_EMAILS/);
});

test("password reset links need Clerk and go to the right person", async () => {
  resetDB();
  await add("chef@example.com", "kitchen");
  signInAs("owner@example.com");
  const off = await teamAction(post({ action: "reset", email: "chef@example.com" }));
  assert.equal(off.status, 400);
  assert.match((await json(off)).error, /AUTH_MODE=clerk/);

  const previous = {
    mode: process.env.AUTH_MODE,
    key: env.CLERK_SECRET_KEY,
    smtp: env.SMTP2GO_API_KEY,
  };
  process.env.AUTH_MODE = "clerk";
  env.CLERK_SECRET_KEY = "sk_test";
  delete env.SMTP2GO_API_KEY;
  try {
    clerkCalls.length = 0;
    const r = await teamAction(post({ action: "reset", email: "chef@example.com" }));
    assert.equal(r.status, 200);
    const body = await json(r);
    assert.match(body.link, /__clerk_ticket=/);
    assert.deepEqual(clerkCalls, ["reset:chef@example.com"]);

    const invite = await teamAction(
      post({ action: "invite", email: "new@example.com", role: "viewer" }),
    );
    assert.match((await json(invite)).message, /invitation email/);
    await teamAction(post({ action: "suspend", email: "new@example.com" }));
    assert.ok(clerkCalls.includes("invite:new@example.com"));
    assert.ok(clerkCalls.includes("revoke:new@example.com"));
  } finally {
    if (previous.mode === undefined) delete process.env.AUTH_MODE;
    else process.env.AUTH_MODE = previous.mode;
    env.CLERK_SECRET_KEY = previous.key;
    env.SMTP2GO_API_KEY = previous.smtp;
  }
});

test("visibleState trims finance, CRM and contact details by role", () => {
  const s = emptyState();
  s.customers.push({
    id: "c",
    name: "N",
    company: "",
    email: "e@example.com",
    phone: "1",
    notes: "n",
  });
  s.drafts.push({ id: "d", to: "x@example.com", subject: "s", body: "b", at: "" });
  assert.equal(visibleState(s, "owner"), s);
  assert.equal(visibleState(s, "manager"), s);
  const viewer = visibleState(s, "viewer");
  assert.equal(viewer.customers[0].email, "");
  assert.deepEqual(viewer.drafts, []);
  assert.equal(s.customers[0].email, "e@example.com", "original untouched");
});
