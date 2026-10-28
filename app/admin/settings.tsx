"use client";
import { useCallback, useEffect, useState } from "react";
import { UserProfile } from "@clerk/nextjs";
import { CheckCircle2, Circle, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Pick } from "@/components/form-controls";
import { GridTable, Panel, Tag } from "./admin-client";
import { useOps, type Spec } from "./ops-context";
import {
  can,
  permissionLabels,
  permissions,
  roleInfo,
  roles,
  type Permission,
  type Role,
} from "@/lib/access";
import type { State } from "@/lib/domain";

export const settingsNavigation = [
  ["", "Business", "settings"],
  ["kitchen", "Kitchen & travel", "settings"],
  ["preferences", "Stock & preferences", "settings"],
  ["team", "Team & access", "team"],
  ["account", "My account", "view"],
  ["services", "Data & services", "settings"],
] as const satisfies readonly (readonly [string, string, Permission])[];

type Settings = State["settings"];

const businessFields: Spec[] = [
  { key: "businessName", label: "Business legal name" },
  { key: "businessAddress", label: "Business address" },
  { key: "vatNumber", label: "VAT registration number" },
  { key: "vatRate", label: "Configured VAT rate (%)", type: "number" },
  {
    key: "priceMode",
    label: "Default price entry",
    options: [
      { value: "exclusive", label: "Add VAT to price" },
      { value: "inclusive", label: "Price includes VAT" },
    ],
  },
  {
    key: "paymentInstructions",
    label: "Invoice payment instructions",
    type: "textarea",
  },
];
const kitchenFields: Spec[] = [
  { key: "kitchen", label: "Kitchen address / postcode" },
  { key: "vehicle", label: "Vehicle" },
  { key: "mpg", label: "Measured fuel economy (UK MPG)", type: "number" },
  { key: "fuelPrice", label: "Fuel price (£ per litre)", type: "number" },
  {
    key: "bufferMinutes",
    label: "Loading / preparation buffer (minutes)",
    type: "number",
  },
  { key: "ownerNotes", label: "Kitchen notes", type: "textarea" },
];
const preferenceFields: Spec[] = [
  { key: "warningDays", label: "Expiry warning (days)", type: "number" },
  { key: "urgentDays", label: "Urgent use-by warning (days)", type: "number" },
  {
    key: "recipeEditorMode",
    label: "Recipe editor layout",
    options: [
      { value: "workspace", label: "Single workspace" },
      { value: "wizard", label: "Three-step wizard" },
    ],
  },
];

function display(settings: Settings, key: string): string {
  const value = settings[key as keyof Settings];
  switch (key) {
    case "vatRate":
      return `${settings.vatRate}%`;
    case "priceMode":
      return settings.priceMode === "inclusive"
        ? "Prices include VAT"
        : "VAT added to prices";
    case "mpg":
      return settings.mpg ? `${settings.mpg} UK MPG` : "";
    case "fuelPrice":
      return settings.fuelPrice ? `£${settings.fuelPrice.toFixed(2)} / litre` : "";
    case "bufferMinutes":
      return `${settings.bufferMinutes} minutes`;
    case "warningDays":
      return `${settings.warningDays ?? 7} days before expiry`;
    case "urgentDays":
      return `${settings.urgentDays ?? 3} days before use-by`;
    case "recipeEditorMode":
      return settings.recipeEditorMode === "wizard"
        ? "Three-step wizard"
        : "Single workspace";
    default:
      return value === undefined || value === null ? "" : String(value);
  }
}

function SettingsGroup({
  title,
  fields,
  note,
}: {
  title: string;
  fields: Spec[];
  note?: string;
}) {
  const { s, open, role } = useOps();
  return (
    <Panel
      title={title}
      action={
        can(role, "settings") ? (
          <Button
            onClick={() =>
              open({ title, action: "settings", values: s.settings, fields })
            }
          >
            Edit
          </Button>
        ) : undefined
      }
    >
      <dl className="settings-list">
        {fields.map((f) => (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd>{display(s.settings, f.key) || "Not set"}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="panel-note">{note}</p>}
    </Panel>
  );
}

function SetupProgress() {
  const { s, href } = useOps();
  const steps: [string, boolean, string][] = [
    ["Business legal name", !!s.settings.businessName, ""],
    ["Invoice payment instructions", !!s.settings.paymentInstructions, ""],
    ["Kitchen address", !!s.settings.kitchen, "kitchen"],
    ["Vehicle fuel economy", !!s.settings.mpg, "kitchen"],
    ["Fuel price", !!s.settings.fuelPrice, "kitchen"],
  ];
  const done = steps.filter(([, ok]) => ok).length;
  if (done === steps.length) return null;
  return (
    <Panel
      title="Finish setting up"
      action={<Tag tone="amber">{`${done} of ${steps.length} done`}</Tag>}
    >
      <ul className="setup-steps">
        {steps.map(([label, ok, tab]) => (
          <li key={label} className={ok ? "done" : ""}>
            {ok ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            {ok ? (
              label
            ) : (
              <a href={href(tab ? `settings/${tab}` : "settings")}>{label}</a>
            )}
          </li>
        ))}
      </ul>
      <p className="panel-note">
        Quotes, invoices and travel costs use these details, so fill them in
        before going live.
      </p>
    </Panel>
  );
}

export default function SettingsPage({ view }: { view: string }) {
  const { role, href } = useOps();
  const allowed = settingsNavigation.filter(([, , p]) => can(role, p));
  const current =
    allowed.find(([path]) => path === view) ||
    allowed.find(([path]) => path === "account")!;
  const page = current[0];
  return (
    <>
      <nav className="crm-tabs" aria-label="Settings sections">
        {allowed.map(([path, label]) => (
          <a
            key={path || "business"}
            href={href(path ? `settings/${path}` : "settings")}
            className={page === path ? "active" : ""}
          >
            {label}
          </a>
        ))}
      </nav>
      {page === "" ? (
        <>
          <SetupProgress />
          <SettingsGroup
            title="Business details"
            fields={businessFields}
            note="These appear on quotes and invoices. VAT is configurable; this workspace does not decide tax treatment or file tax returns."
          />
        </>
      ) : page === "kitchen" ? (
        <SettingsGroup
          title="Kitchen & travel"
          fields={kitchenFields}
          note="Used for delivery routes and travel cost estimates. Fill in the kitchen and vehicle figures before relying on live cost estimates."
        />
      ) : page === "preferences" ? (
        <SettingsGroup
          title="Stock alerts & preferences"
          fields={preferenceFields}
          note="The urgent warning must fall inside the expiry warning window."
        />
      ) : page === "team" ? (
        <TeamAccess />
      ) : page === "account" ? (
        <MyAccount />
      ) : (
        <DataServices />
      )}
    </>
  );
}

type TeamMember = {
  email: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  invitedBy: string;
  createdAt: string;
  lastSeenAt: string | null;
};
type AccessEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};
type TeamData = {
  me: { email: string; source: string };
  authMode: "demo" | "clerk" | "chatgpt";
  accountService: boolean;
  emailReady: boolean;
  deploymentOwners: string[];
  members: TeamMember[];
  events: AccessEvent[];
};

const roleOptions = roles.map((r) => ({ value: r, label: roleInfo[r].label }));
const eventLabels: Record<string, string> = {
  invite: "Added",
  role: "Role changed",
  suspend: "Suspended",
  reactivate: "Reactivated",
  remove: "Removed",
  reset: "Reset link sent",
};

function when(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function TeamAccess() {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ message: string; link?: string } | null>(
    null,
  );
  const [working, setWorking] = useState(false);
  const [invite, setInvite] = useState({ email: "", name: "", role: "kitchen" });

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/team", { cache: "no-store" });
      const j = (await r.json()) as TeamData & { error?: string };
      if (!r.ok) throw Error(j.error);
      setData(j);
      setError("");
    } catch (e) {
      setError((e as Error).message || "Couldn't load the team");
    }
  }, []);
  useEffect(() => {
    // Loads the team list once when the tab opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(payload: Record<string, string>) {
    setWorking(true);
    setError("");
    setNotice(null);
    try {
      const r = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as {
        error?: string;
        message: string;
        link?: string;
        members: TeamMember[];
        events: AccessEvent[];
      };
      if (!r.ok) throw Error(j.error);
      setNotice({ message: j.message, link: j.link });
      setData((d) => (d ? { ...d, members: j.members, events: j.events } : d));
      return true;
    } catch (e) {
      setError((e as Error).message || "That didn't work. Please try again.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  if (!data)
    return (
      <Panel title="Team & access">
        {error ? (
          <p role="alert" className="error-message">
            {error}
          </p>
        ) : (
          <p className="panel-note">Loading the team…</p>
        )}
      </Panel>
    );

  const canReset = data.accountService;
  const rows = [
    ...data.deploymentOwners.map((email) => [
      <span key="p" className="team-person">
        <b>{email}</b>
        {email === data.me.email && <small>You</small>}
      </span>,
      <Tag key="r" tone="green">
        Owner
      </Tag>,
      <span key="s">Set in deployment</span>,
      "—",
      <span key="a" className="team-actions">
        {canReset && email !== data.me.email && (
          <Button
            size="sm"
            variant="outline"
            disabled={working}
            onClick={() => void act({ action: "reset", email })}
          >
            <KeyRound size={14} /> Reset password
          </Button>
        )}
      </span>,
    ]),
    ...data.members.map((m) => {
      const self = m.email === data.me.email;
      return [
        <span key="p" className="team-person">
          <b>{m.name || m.email}</b>
          {m.name && <small>{m.email}</small>}
          {self && <small>You</small>}
        </span>,
        self ? (
          <Tag key="r">{roleInfo[m.role].label}</Tag>
        ) : (
          <select
            key="r"
            className="team-role"
            aria-label={`Role for ${m.email}`}
            value={m.role}
            disabled={working}
            onChange={(e) =>
              void act({ action: "role", email: m.email, role: e.target.value })
            }
          >
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ),
        m.status === "active" ? (
          <Tag key="s" tone="green">
            Active
          </Tag>
        ) : (
          <Tag key="s" tone="amber">
            Suspended
          </Tag>
        ),
        when(m.lastSeenAt),
        self ? (
          <span key="a" className="panel-note">
            Another owner can change your access
          </span>
        ) : (
          <span key="a" className="team-actions">
            {m.status === "active" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={working}
                onClick={() => {
                  if (
                    window.confirm(
                      `Suspend ${m.email}? They'll be signed out and can't open the workspace until reactivated.`,
                    )
                  )
                    void act({ action: "suspend", email: m.email });
                }}
              >
                Suspend
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={working}
                onClick={() => void act({ action: "reactivate", email: m.email })}
              >
                Reactivate
              </Button>
            )}
            {canReset && m.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                disabled={working}
                onClick={() => void act({ action: "reset", email: m.email })}
              >
                <KeyRound size={14} /> Reset password
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={working}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove ${m.email} from the team? You can add them again later.`,
                  )
                )
                  void act({ action: "remove", email: m.email });
              }}
            >
              Remove
            </Button>
          </span>
        ),
      ];
    }),
  ];

  return (
    <>
      {data.authMode === "demo" && (
        <div className="access-warning" role="status">
          <ShieldCheck size={18} />
          <p>
            <b>Sign-in is switched off (demo mode).</b> Anyone with the link can
            open this workspace as an owner, so roles below aren’t enforced yet.
            Turn on Clerk sign-in to give each person their own login, password
            and role. See Data &amp; services for the steps.
          </p>
        </div>
      )}
      <Panel title="Add a team member">
        <form
          className="team-invite"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ action: "invite", ...invite }))
              setInvite({ email: "", name: "", role: invite.role });
          }}
        >
          <Field
            label="Email address"
            type="email"
            value={invite.email}
            onChange={(v) => setInvite({ ...invite, email: String(v) })}
            required
          />
          <Field
            label="Name"
            value={invite.name}
            onChange={(v) => setInvite({ ...invite, name: String(v) })}
          />
          <Pick
            label="Role"
            value={invite.role}
            onChange={(v) => setInvite({ ...invite, role: v })}
            options={roleOptions}
            required
          />
          <Button disabled={working}>{working ? "Saving…" : "Add person"}</Button>
        </form>
        <p className="panel-note">
          {roleInfo[invite.role as Role]?.summary}{" "}
          {data.accountService
            ? "They’ll get an email invitation to create their login."
            : data.authMode === "chatgpt"
              ? "They sign in with ChatGPT using this email address."
              : ""}
        </p>
      </Panel>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {notice && (
        <div className="team-notice" role="status">
          <p>{notice.message}</p>
          {notice.link && (
            <div className="copy-link">
              <input readOnly value={notice.link} aria-label="One-time sign-in link" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard?.writeText(notice.link!)}
              >
                <Copy size={14} /> Copy
              </Button>
            </div>
          )}
        </div>
      )}
      <Panel title="People with access">
        <GridTable
          heads={["Person", "Role", "Status", "Last active", ""]}
          rows={rows}
          empty="Only the owners have access so far."
        />
        <p className="panel-note">
          Owners listed as “Set in deployment” come from the OWNER_EMAILS
          setting and always keep owner access, so you can never be locked out.
          {!canReset &&
            " Password reset links need Clerk sign-in to be switched on."}
        </p>
      </Panel>
      <Panel title="What each role can do">
        <RoleMatrix />
      </Panel>
      <Panel title="Access history">
        <GridTable
          heads={["When", "Who", "Change", "Person", "Detail"]}
          rows={data.events.map((e) => [
            when(e.at),
            e.actor,
            eventLabels[e.action] || e.action,
            e.target,
            e.detail || "—",
          ])}
          empty="No access changes yet."
        />
      </Panel>
    </>
  );
}

function RoleMatrix() {
  return (
    <div className="role-matrix-wrap">
      <table className="role-matrix">
        <thead>
          <tr>
            <th scope="col">Can…</th>
            {roles.map((r) => (
              <th key={r} scope="col">
                {roleInfo[r].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((p) => (
            <tr key={p}>
              <th scope="row">{permissionLabels[p]}</th>
              {roles.map((r) => (
                <td key={r}>
                  {can(r, p) ? (
                    <CheckCircle2 size={16} aria-label="Yes" />
                  ) : (
                    <span aria-label="No">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MyAccount() {
  const { role, email, authMode } = useOps();
  const info = roleInfo[role];
  return (
    <>
      <Panel title="Your access" action={<Tag tone="green">{info.label}</Tag>}>
        <dl className="settings-list">
          <div>
            <dt>Signed in as</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{info.summary}</dd>
          </div>
          <div>
            <dt>You can</dt>
            <dd>
              {info.permissions.map((p) => permissionLabels[p]).join(" · ")}
            </dd>
          </div>
        </dl>
      </Panel>
      {authMode === "clerk" ? (
        <Panel title="Password & security">
          <p className="panel-note">
            Change your password, add two-step verification or sign out other
            devices. Forgotten your password? Sign out and choose “Forgot
            password?” on the sign-in page.
          </p>
          <div className="account-profile">
            <UserProfile routing="hash" />
          </div>
        </Panel>
      ) : (
        <Panel title="Password & security">
          <p className="panel-note">
            {authMode === "chatgpt"
              ? "You sign in with your ChatGPT account, so your password and security settings are managed there."
              : "Sign-in is switched off in demo mode, so there’s no password to change. Once Clerk sign-in is turned on, each person gets their own login with password reset and two-step verification here."}
          </p>
        </Panel>
      )}
    </>
  );
}

function DataServices() {
  const { integrations, mode, role, authMode } = useOps();
  const services: [string, string, string][] = [
    ["gemini", "AutoSous", "Structured enquiry review and read-only operations help."],
    ["maps", "Google Maps", "Address lookup and traffic-aware driving estimates."],
    ["email", "Business email", "Resend or SMTP2GO delivery after review and an explicit send."],
    [
      "clerk",
      "Accounts & passwords",
      "Clerk sign-in: personal logins, invitations, password reset and two-step verification.",
    ],
  ];
  return (
    <>
      <Panel
        title="Sign-in & security"
        action={
          <Tag tone={authMode === "demo" ? "amber" : "green"}>
            {authMode === "demo"
              ? "Sign-in off"
              : authMode === "clerk"
                ? "Clerk sign-in"
                : "ChatGPT sign-in"}
          </Tag>
        }
      >
        {authMode === "demo" ? (
          <div className="panel-note">
            <p>
              The workspace is open to anyone with the link. To turn on
              personal logins with roles and password reset:
            </p>
            <ol className="setup-list">
              <li>Create a free application at clerk.com with email and password sign-in.</li>
              <li>
                In the Vercel project settings add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
                and CLERK_SECRET_KEY from Clerk.
              </li>
              <li>Set OWNER_EMAILS to your own email address so you’re always an owner.</li>
              <li>Change AUTH_MODE from demo to clerk and redeploy.</li>
              <li>Add the rest of the team from Settings → Team &amp; access.</li>
            </ol>
          </div>
        ) : (
          <p className="panel-note">
            Every request checks the person’s role on the server, so changes to
            someone’s access apply straight away.
            {authMode === "clerk" &&
              !integrations.clerk &&
              " Add CLERK_SECRET_KEY to the deployment settings to send invitations and password reset links."}
          </p>
        )}
      </Panel>
      {can(role, "data") && (
        <Panel
          title="Backup & data export"
          action={
            <Button asChild variant="outline">
              <a href={`/api/admin/export?mode=${mode}`} download>
                Download backup
              </a>
            </Button>
          }
        >
          <p className="panel-note">
            Downloads every record in the {mode === "sample" ? "sample" : "live"}{" "}
            workspace as a JSON file
            {mode === "live" ? ", including original website enquiries" : ""}. It
            contains customer personal data: store it securely and delete old
            copies in line with your retention schedule.
          </p>
        </Panel>
      )}
      <Panel title="Connected services">
        <div className="integration-grid">
          {services.map(([k, t, d]) => (
            <article key={k}>
              <Tag tone={integrations[k] ? "green" : "amber"}>
                {integrations[k] ? "Configured" : "Setup required"}
              </Tag>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
        <p className="panel-note">
          API credentials and owner access are managed securely in deployment
          configuration. Never enter keys in notes or enquiry fields.
        </p>
      </Panel>
    </>
  );
}
