import assert from "node:assert/strict";
const base = process.env.EM2_TEST_URL || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
  throw Error("This test creates fixtures and only runs against localhost.");
const headers = {
  Cookie: "__sites_local_auth=1",
  Origin: base,
  "Content-Type": "application/json",
};
async function request(path, body, options = {}) {
  const r = await fetch(base + path, {
    headers,
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    ...options,
  });
  return { status: r.status, json: await r.json() };
}
for (const path of [
  "/api/admin/state",
  "/api/admin/action",
  "/api/admin/analysis",
  "/api/admin/assistant",
  "/api/admin/route",
  "/api/admin/places",
  "/api/admin/send",
  "/api/admin/research",
  "/api/admin/delivery",
]) {
  const r = await request(path, path.endsWith("state") ? null : {}, {
    headers: { Origin: base, "Content-Type": "application/json" },
  });
  assert.equal(r.status, 403, path);
}
const forged = await request("/api/admin/state", null, {
  headers: {
    "oai-authenticated-user-id": "local_seedy",
    "oai-authenticated-user-email": "seedy@sites.test",
  },
});
assert.equal(forged.status, 403);
console.log("PASS: owner APIs reject anonymous and forged local identities");
const details = {
  service: "corporate",
  eventType: "Office lunch",
  attendees: 10,
  date: "",
  eventTime: "12:30",
  arrivalTime: "12:00",
  requests: "Pilot smoke fixture",
  dietary: "One sesame allergy",
  requirements: [
    {
      reference: "Guest test",
      requirements: "Sesame allergy",
      meal: "untrusted",
      reviewed: true,
    },
  ],
  name: "Pilot Test",
  company: "Local test only",
  email: "pilot@example.com",
  phone: "020 0000 0000",
  venue: "Test venue",
  address: "",
  postcode: "",
  access: "Confirm lift access",
  unknownDetails: "Date and venue to confirm",
};
const body = { details, requestKey: crypto.randomUUID(), website: "" };
const first = await request("/api/enquiries", body);
assert.equal(first.status, 201);
const again = await request("/api/enquiries", body);
assert.equal(again.json.reference, first.json.reference);
const mismatch = await request("/api/enquiries", {
  ...body,
  details: { ...details, attendees: 11 },
});
assert.equal(mismatch.status, 400);
const invalid = await request("/api/enquiries", {
  ...body,
  requestKey: crypto.randomUUID(),
  details: { ...details, attendees: 0 },
});
assert.equal(invalid.status, 400);
console.log("PASS: enquiry persistence, validation and duplicate protection");
const live = await request("/api/admin/state?mode=live");
assert.equal(live.status, 200);
const enq = live.json.enquiries.find(
  (e) => e.details.requests === "Pilot smoke fixture",
);
assert.equal(enq.details.requirements[0].reviewed, false);
assert.equal(enq.details.requirements[0].meal, "");
const imported = live.json.state.orders.filter(o=>o.enquiryId===enq.id);
assert.equal(imported.length,1);
assert.equal(imported[0].status,"enquiry");
assert.ok(live.json.state.customers.some(c=>c.id===imported[0].customerId));
assert.equal(imported[0].reservations.length,0);
const sample = await request("/api/admin/state?mode=sample");
assert.equal(sample.status, 200);
assert.equal(sample.json.enquiries.length, 0);
assert.ok(sample.json.state.orders.length >= 2);
console.log(
  "PASS: guest review cannot be pre-approved by submission; sample records isolated",
);
const cmd = {
  mode: "sample",
  revision: sample.json.revision,
  command: {
    id: crypto.randomUUID(),
    type: "settings",
    payload: {
      ...sample.json.state.settings,
      ownerNotes: "Local API verification",
    },
  },
};
const noOrigin = await request("/api/admin/action", cmd, {
  headers: {
    Cookie: "__sites_local_auth=1",
    "Content-Type": "application/json",
  },
});
assert.equal(noOrigin.status, 400);
const [a, b] = await Promise.all([
  request("/api/admin/action", cmd),
  request("/api/admin/action", {
    ...cmd,
    command: { ...cmd.command, id: crypto.randomUUID() },
  }),
]);
assert.equal([a.status, b.status].filter((x) => x === 200).length, 1);
assert.equal([a.status, b.status].filter((x) => x === 400).length, 1);
const latest = await request("/api/admin/state?mode=sample");
const saved = latest.json.state.commands.includes(cmd.command.id)
  ? cmd.command.id
  : latest.json.state.commands.at(-1);
const retry = await request("/api/admin/action", {
  ...cmd,
  command: { ...cmd.command, id: saved },
});
assert.equal(retry.status, 200);
console.log(
  "PASS: origin validation, concurrent save conflict and idempotent retry",
);
for (const [path, payload] of [
  ["analysis", { orderId: "sample-upcoming" }],
  ["assistant", { question: "What needs restocking?" }],
  [
    "route",
    {
      orderId: "sample-upcoming",
      departure: new Date(Date.now() + 86400000).toISOString(),
      returnTrip: false,
      extraCost: 0,
    },
  ],
  ["places", { query: "London meeting venue" }],
  ["send", { draftId: "missing", confirm: true }],
]) {
  const r = await request("/api/admin/" + path, { mode: "sample", ...payload });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /setup required/i);
}
console.log(
  "PASS: unconfigured integrations fail clearly without losing records",
);
