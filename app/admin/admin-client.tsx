"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Utensils,
  Package,
  Clock,
  Truck,
  Users,
  BarChart3,
  Sparkles,
  Settings,
  ArrowUpRight,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Send,
  Download,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, Pick, Notes } from "@/components/form-controls";
import { Brand } from "../public-shell";
import {
  emptyState,
  alerts,
  money,
  recipeCost,
  available,
  recap,
  today,
  type State,
  type Order,
} from "@/lib/domain";
import OrderPanel from "./order-panel";
import { Context, useOps, type Ops, type Edit, type Spec } from "./ops-context";
const navigation = [
  ["", "Overview", LayoutDashboard],
  ["orders", "Enquiries & orders", ClipboardList],
  ["recipes", "Recipes & costing", Utensils],
  ["inventory", "Inventory", Package],
  ["expiry", "Storage & expiry", Clock],
  ["suppliers", "Suppliers", Truck],
  ["crm", "CRM & feedback", Users],
  ["reports", "Waste & reports", BarChart3],
  ["assistant", "AI assistant", Sparkles],
  ["settings", "Settings", Settings],
] as const;
export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="ops-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function GridTable({
  heads,
  rows,
  empty = "No records yet.",
}: {
  heads: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {heads.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((c, j) => (
                <TableCell key={j}>{c}</TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={heads.length}>
              <div className="empty-state">{empty}</div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
export function Tag({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"tag " + tone}>{children}</span>;
}
export function Add({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick} size="sm">
      <Plus size={15} />
      {children}
    </Button>
  );
}
export function AdminEditor({
  edit,
  onClose,
  run,
}: {
  edit: Edit | null;
  onClose: () => void;
  run: Ops["run"];
}) {
  const [v, set] = useState<any>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const vals: any = { ...edit?.values };
    for (const f of edit?.fields || []) {
      if (vals[f.key] === undefined)
        vals[f.key] =
          f.type === "date"
            ? today()
            : ["number", "money"].includes(f.type || "")
              ? 0
              : "";
      if (f.type === "money") vals[f.key] /= 100;
    }
    set(vals);
    setError("");
  }, [edit]);
  return (
    <Dialog
      open={!!edit}
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>{edit?.title}</DialogTitle>
          <DialogDescription>
            Save changes to your{" "}
            {edit?.action === "settings" ? "business settings" : "records"}.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const value = { ...v };
              for (const f of edit!.fields) {
                if (f.type === "number") value[f.key] = Number(value[f.key]);
                if (f.type === "money")
                  value[f.key] = Math.round(Number(value[f.key]) * 100);
              }
              await run(
                edit!.action,
                edit!.transform ? edit!.transform(value) : value,
              );
              onClose();
            } catch (e) {
              setError(String((e as Error).message));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            {edit?.fields.map((f) =>
              f.options ? (
                <Pick
                  key={f.key}
                  label={f.label}
                  value={v[f.key] || ""}
                  onChange={(x) => set({ ...v, [f.key]: x })}
                  options={f.options}
                />
              ) : f.type === "textarea" ? (
                <Notes
                  key={f.key}
                  label={f.label}
                  value={v[f.key] || ""}
                  onChange={(x) => set({ ...v, [f.key]: x })}
                />
              ) : (
                <Field
                  key={f.key}
                  label={f.label}
                  value={v[f.key] ?? ""}
                  onChange={(x) => set({ ...v, [f.key]: x })}
                  type={f.type === "money" ? "number" : f.type || "text"}
                  step={
                    ["money", "number"].includes(f.type || "")
                      ? "any"
                      : undefined
                  }
                  required={f.required}
                />
              ),
            )}
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export default function Admin({
  section,
  ownerEmail,
}: {
  section: string[];
  ownerEmail: string;
}) {
  const [s, setS] = useState(emptyState()),
    [revision, setRevision] = useState(0),
    [mode, setMode] = useState("live"),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [enquiries, setEnquiries] = useState<any[]>([]),
    [integrations, setIntegrations] = useState<Record<string, boolean>>({}),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Edit | null>(null);
  const page = section[0] || "";
  const href = (p: string) => `/admin${p ? "/" + p : ""}?mode=${mode}`;
  async function reload(selected = mode) {
    setError("");
    try {
      const r = await fetch(`/api/admin/state?mode=${selected}`, {
        cache: "no-store",
      });
      const j: any = await r.json();
      if (!r.ok) throw Error(j.error);
      setS(j.state);
      setRevision(j.revision);
      setEnquiries(j.enquiries);
      setIntegrations(j.integrations);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const m =
      new URLSearchParams(location.search).get("mode") === "sample"
        ? "sample"
        : "live";
    setMode(m);
    void reload(m);
  }, []);
  async function run(type: string, payload: any) {
    if (busy) throw Error("A save is already in progress");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          revision,
          command: { id: crypto.randomUUID(), type, payload },
        }),
      });
      const j: any = await r.json();
      if (!r.ok) throw Error(j.error);
      setS(j.state);
      setRevision(j.revision);
    } finally {
      setBusy(false);
    }
  }
  async function api(path: string, payload: any) {
    if (busy) throw Error("Another request is in progress");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, mode }),
      });
      const j: any = await r.json();
      if (!r.ok) throw Error(j.error);
      if (j.state) {
        setS(j.state);
        setRevision(j.revision);
      }
      return j;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool || !loaded) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        ctx.registerTool(
          {
            name: "read_catering_overview",
            title: "Read catering overview",
            description:
              "Read counts and operational alerts in the currently visible owner workspace.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input: any) {
              if (!input || Object.keys(input).length)
                throw Error("No arguments accepted");
              return {
                mode,
                orders: s.orders.length,
                ingredients: s.ingredients.length,
                alerts: alerts(s),
              };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, [loaded, s, mode]);
  const title = navigation.find((n) => n[0] === page)?.[1] || "Order details";
  return (
    <Context.Provider
      value={{
        s,
        mode,
        enquiries,
        integrations,
        run,
        api,
        href,
        reload: () => reload(),
        busy,
        open: setEdit,
      }}
    >
      <SidebarProvider className="ops-app">
        <Sidebar>
          <SidebarHeader>
            <Brand />
            <span className="workspace-label">OWNER WORKSPACE</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                {navigation.map(([path, label, Icon]) => (
                  <SidebarMenuItem key={path}>
                    <SidebarMenuButton asChild isActive={page === path}>
                      <a href={href(path)}>
                        <Icon size={18} />
                        <span>{label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <a href="/" className="back-site">
              View website <ArrowUpRight size={16} />
            </a>
            <div className="owner-account">
              <span>EM</span>
              <div>
                <b>Owner</b>
                <small>{ownerEmail}</small>
              </div>
            </div>
            <a className="signout" href="/signout-with-chatgpt?return_to=/">
              Sign out
            </a>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="ops-topbar">
            <div>
              <SidebarTrigger />
              <span>EM² Meals / {title}</span>
            </div>
            <div>
              <a
                className={"mode-link " + (mode === "live" ? "selected" : "")}
                href={`/admin${section.length ? "/" + section.join("/") : ""}?mode=live`}
              >
                Live
              </a>
              <a
                className={"mode-link " + (mode === "sample" ? "selected" : "")}
                href={`/admin${section.length ? "/" + section.join("/") : ""}?mode=sample`}
              >
                Sample
              </a>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh records"
                onClick={() => reload()}
              >
                <RefreshCw size={17} />
              </Button>
            </div>
          </header>
          <main className="ops-main">
            {mode === "sample" && (
              <div className="sample-banner">
                Sample workspace — illustrative clients, prices and stock.
                Changes here never affect live records.
              </div>
            )}
            <div className="ops-heading">
              <div>
                <span className="eyebrow">
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "Europe/London",
                  }).format(new Date())}
                </span>
                <h1>
                  {section[1]
                    ? "Order details"
                    : page
                      ? ""
                      : "A good day starts here."}
                  {!section[1] && page ? title : ""}
                </h1>
                <p>
                  {page === ""
                    ? "Your kitchen, your customers, your next occasion."
                    : "Keep the details together. Give the food your attention."}
                </p>
              </div>
              {page === "" && (
                <a className="outline-link" href={href("orders")}>
                  View orders <ArrowRight size={16} />
                </a>
              )}
            </div>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {!loaded ? (
              <div className="metric-grid">
                {[1, 2, 3, 4].map((x) => (
                  <Skeleton key={x} className="h-32 w-full" />
                ))}
              </div>
            ) : page === "" ? (
              <Overview />
            ) : page === "orders" ? (
              section[1] ? (
                <OrderPanel orderId={section[1]} />
              ) : (
                <Orders />
              )
            ) : page === "recipes" ? (
              <Recipes />
            ) : page === "inventory" || page === "expiry" ? (
              <Inventory expiry={page === "expiry"} />
            ) : page === "suppliers" ? (
              <Suppliers />
            ) : page === "crm" ? (
              <CRM />
            ) : page === "reports" ? (
              <Reports />
            ) : page === "assistant" ? (
              <Assistant />
            ) : page === "settings" ? (
              <SettingsPage />
            ) : (
              <p>Page not found.</p>
            )}
          </main>
        </SidebarInset>
        <AdminEditor edit={edit} onClose={() => setEdit(null)} run={run} />
      </SidebarProvider>
    </Context.Provider>
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function Overview() {
  const { s, href, open } = useOps();
  const income = s.finance
      .filter((f) => f.type === "income")
      .reduce((v, f) => v + f.amount, 0),
    expenses = s.finance
      .filter((f) => f.type === "expense")
      .reduce((v, f) => v + f.amount, 0),
    food = s.orders
      .filter((o) => o.consumed)
      .reduce((v, o) => v + (o.costSnapshot?.total || 0), 0);
  const feedback = s.feedback.length
    ? (
        s.feedback.reduce((v, f) => v + f.rating, 0) / s.feedback.length
      ).toFixed(1)
    : "—";
  const upcoming = s.orders
    .filter((o) => !["delivered", "cancelled", "declined"].includes(o.status))
    .sort((a, b) => a.details.date.localeCompare(b.details.date));
  const a = alerts(s);
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="Income recorded"
          value={money(income)}
          detail="Payments logged · all time"
        />
        <Metric
          label="Expenses recorded"
          value={money(expenses)}
          detail="Cash outgoings · all time"
        />
        <Metric
          label="Ingredient cost"
          value={money(food)}
          detail="Cost snapshots for prepared orders"
        />
        <Metric
          label="Customer feedback"
          value={feedback === "—" ? "—" : `${feedback} / 5`}
          detail={`${s.feedback.length} recorded responses`}
        />
      </div>
      <div className="ops-columns">
        <Panel
          title="Coming out of the kitchen"
          action={<a href={href("orders")}>All orders →</a>}
        >
          <OrderTable orders={upcoming.slice(0, 6)} />
        </Panel>
        <Panel title="Needs your attention" action={<Tag>{a.length}</Tag>}>
          <div className="alert-list">
            {a.length ? (
              a.slice(0, 7).map((x, i) => (
                <a key={i} href={href(x.href)}>
                  <AlertTriangle size={17} />
                  <div>
                    <b>{x.title}</b>
                    <p>{x.detail}</p>
                  </div>
                </a>
              ))
            ) : (
              <div className="empty-state">
                <CheckCircle2 size={26} />
                <p>No operational alerts.</p>
              </div>
            )}
          </div>
        </Panel>
      </div>
      <div className="ops-columns">
        <Panel
          title="Income & outgoings"
          action={<Add onClick={() => open(financeEditor(s))}>Add entry</Add>}
        >
          <GridTable
            heads={["Date", "Description", "Type", "Amount"]}
            rows={s.finance
              .slice()
              .reverse()
              .slice(0, 8)
              .map((f) => [
                f.date,
                f.description,
                <Tag>{f.type}</Tag>,
                money(f.amount),
              ])}
          />
          <div className="panel-note">
            Cash balance: <b>{money(income - expenses)}</b>. Ingredient
            snapshots are a separate operational measure, not a second expense
            deduction.
          </div>
        </Panel>
        <Panel title="Kitchen notes">
          <div className="kitchen-note">
            <span className="eyebrow">THOUGHTFULLY COOKED</span>
            <h3>
              A little preparation.
              <br />A lot of possibility.
            </h3>
            <p>
              {s.settings.ownerNotes ||
                "Set your kitchen address, costs and stock thresholds in Settings to make each order easier to plan."}
            </p>
            <a href={href("settings")}>Open business settings →</a>
          </div>
        </Panel>
      </div>
      <Panel title="Recent activity">
        <GridTable
          heads={["When", "Action", "By"]}
          rows={s.audit
            .slice(-8)
            .reverse()
            .map((a) => [
              new Date(a.at).toLocaleString("en-GB"),
              a.action,
              a.actor,
            ])}
        />
      </Panel>
    </>
  );
}
function financeEditor(s: State): Edit {
  return {
    title: "Record income or expense",
    action: "finance",
    fields: [
      { key: "type", label: "Type", options: ["income", "expense"] },
      { key: "amount", label: "Amount (£)", type: "money", required: true },
      { key: "category", label: "Category", required: true },
      { key: "description", label: "Description", required: true },
      { key: "date", label: "Date", type: "date" },
      {
        key: "orderId",
        label: "Related order (optional)",
        options: s.orders.map((o) => ({ value: o.id, label: o.reference })),
      },
    ],
    values: { type: "expense" },
  };
}
export function OrderTable({ orders }: { orders: Order[] }) {
  const { href } = useOps();
  return (
    <GridTable
      heads={["Order / customer", "Occasion", "Guests", "Stage"]}
      rows={orders.map((o) => [
        <a href={href("orders/" + o.id)} className="record-link">
          <b>{o.details.company || o.details.name}</b>
          <small>{o.reference}</small>
        </a>,
        <span>
          {o.details.date || "Date to confirm"}
          <small className="subtext">{o.details.eventType}</small>
        </span>,
        o.details.attendees,
        <Tag
          tone={
            o.status === "delivered"
              ? "green"
              : o.status === "ingredients needed"
                ? "amber"
                : ""
          }
        >
          {o.status}
        </Tag>,
      ])}
      empty="Your next occasion will appear here."
    />
  );
}
function Orders() {
  const { s, enquiries, run, href, busy } = useOps();
  const [error, setError] = useState(""),
    [query, setQuery] = useState("");
  return (
    <>
      <Panel
        title="New enquiries"
        action={<a href="/enquire">Open enquiry form ↗</a>}
      >
        <GridTable
          heads={["Received", "Customer", "Occasion", "Requirements", "Action"]}
          rows={enquiries.map((e) => {
            const existing = s.orders.find((o) => o.enquiryId === e.id);
            return [
              new Date(e.createdAt).toLocaleDateString("en-GB"),
              <span>
                {e.details.company || e.details.name}
                <small className="subtext">{e.details.email}</small>
              </span>,
              `${e.details.attendees} guests · ${e.details.eventType}`,
              e.details.dietary || "Review required",
              existing ? (
                <a href={href("orders/" + existing.id)}>Open order →</a>
              ) : (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await run("order", {
                        enquiryId: e.id,
                        details: e.details,
                        items: [],
                      });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Create order
                </Button>
              ),
            ];
          })}
          empty="Submitted website enquiries appear here. Sample orders are listed below in the sample workspace."
        />
      </Panel>
      {error && <p className="error-message">{error}</p>}
      <Panel
        title="Orders"
        action={
          <Field label="Find an order" value={query} onChange={setQuery} />
        }
      >
        <OrderTable
          orders={s.orders.filter((o) =>
            `${o.reference} ${o.details.name} ${o.details.company} ${o.status}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )}
        />
      </Panel>
    </>
  );
}
function Recipes() {
  const { s, open, run, busy } = useOps();
  const [editing, setEditing] = useState<any>(null),
    [error, setError] = useState("");
  const ingredients = s.ingredients.map((i) => ({
    value: i.id,
    label: `${i.name} (${i.unit})`,
  }));
  return (
    <>
      <Panel
        title="Recipes & variants"
        action={
          <Add
            onClick={() => {
              setEditing({
                name: "",
                variant: "",
                lines: [{ ingredientId: "", quantity: 0 }],
              });
              setError("");
            }}
          >
            New recipe
          </Add>
        }
      >
        <GridTable
          heads={["Dish", "Variant", "Ingredients", "Cost per portion", ""]}
          rows={s.recipes.map((r) => [
            r.name,
            r.variant,
            r.lines.length,
            money(Math.round(recipeCost(s, r))),
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(structuredClone(r));
                setError("");
              }}
            >
              Edit recipe
            </Button>,
          ])}
        />
        <p className="panel-note">
          Costs include usable-yield allowances. Create a distinct variant for
          substitutions; confirm allergen information before use.
        </p>
      </Panel>
      <Panel
        title="Ingredient prices"
        action={
          <Add onClick={() => open(ingredientEditor(s))}>Add ingredient</Add>
        }
      >
        <GridTable
          heads={[
            "Ingredient",
            "Pack",
            "Pack cost",
            "Usable yield",
            "Allergens",
            "",
          ]}
          rows={s.ingredients.map((i) => [
            i.name,
            `${i.packQuantity} ${i.unit}`,
            money(i.packCost),
            `${i.yield * 100}%`,
            i.allergens || "Not recorded",
            <Button
              variant="ghost"
              size="sm"
              onClick={() => open({ ...ingredientEditor(s), values: i })}
            >
              Edit
            </Button>,
          ])}
        />
      </Panel>
      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>Recipe & variant</DialogTitle>
            <DialogDescription>
              Quantities are per portion, before the usable-yield allowance.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await run("recipe", editing);
                  setEditing(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <div className="form-grid">
                <Field
                  label="Dish name"
                  required
                  value={editing.name}
                  onChange={(name) => setEditing({ ...editing, name })}
                />
                <Field
                  label="Variant"
                  required
                  value={editing.variant}
                  onChange={(variant) => setEditing({ ...editing, variant })}
                />
                {editing.lines.map((line: any, i: number) => (
                  <div className="attendee-row wide" key={i}>
                    <Pick
                      label="Ingredient"
                      value={line.ingredientId}
                      options={ingredients}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          lines: editing.lines.map((x: any, j: number) =>
                            i === j ? { ...x, ingredientId: v } : x,
                          ),
                        })
                      }
                    />
                    <Field
                      label="Quantity per portion"
                      type="number"
                      step="any"
                      value={line.quantity}
                      onChange={(v) =>
                        setEditing({
                          ...editing,
                          lines: editing.lines.map((x: any, j: number) =>
                            i === j ? { ...x, quantity: Number(v) } : x,
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          lines: editing.lines.filter(
                            (_: any, j: number) => i !== j,
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-5"
                onClick={() =>
                  setEditing({
                    ...editing,
                    lines: [
                      ...editing.lines,
                      { ingredientId: "", quantity: 0 },
                    ],
                  })
                }
              >
                Add ingredient
              </Button>
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <span />
                <Button disabled={busy}>Save recipe</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function ingredientEditor(s: State): Edit {
  return {
    title: "Ingredient and supplier price",
    action: "ingredient",
    fields: [
      { key: "name", label: "Ingredient", required: true },
      { key: "unit", label: "Base unit", options: ["g", "ml", "each"] },
      {
        key: "packQuantity",
        label: "Quantity in pack (base units)",
        type: "number",
        required: true,
      },
      {
        key: "packCost",
        label: "Pack cost (£)",
        type: "money",
        required: true,
      },
      {
        key: "yield",
        label: "Usable yield (0.85 = 85%)",
        type: "number",
        required: true,
      },
      { key: "allergens", label: "Declared allergens / verified none" },
      {
        key: "supplierId",
        label: "Supplier",
        options: s.suppliers.map((x) => ({ value: x.id, label: x.name })),
      },
      {
        key: "threshold",
        label: "Restock threshold (base units)",
        type: "number",
      },
    ],
    values: { unit: "g", yield: 1 },
  };
}
export function stockEditor(
  s: State,
  purchase?: State["purchases"][number],
): Edit {
  return {
    title: "Receive stock",
    action: "stock-receive",
    fields: [
      {
        key: "ingredientId",
        label: "Ingredient",
        options: s.ingredients.map((i) => ({
          value: i.id,
          label: `${i.name} (${i.unit})`,
        })),
      },
      {
        key: "quantity",
        label: "Received quantity (base units)",
        type: "number",
        required: true,
      },
      {
        key: "location",
        label: "Storage location",
        options: ["fridge", "freezer", "ambient"],
      },
      { key: "intake", label: "Intake date", type: "date" },
      { key: "expiry", label: "Supplier label expiry date", type: "date" },
      {
        key: "dateType",
        label: "Date type",
        options: ["use-by", "best-before"],
      },
      { key: "opened", label: "Opened date", type: "date" },
      { key: "frozen", label: "Frozen date", type: "date" },
      { key: "thawed", label: "Thawed date", type: "date" },
      {
        key: "notes",
        label: "Label instructions / storage notes",
        type: "textarea",
      },
    ],
    values: {
      location: "fridge",
      dateType: "use-by",
      expiry: "",
      opened: "",
      frozen: "",
      thawed: "",
      ...(purchase
        ? {
            ingredientId: purchase.ingredientId,
            quantity: purchase.quantity,
            purchaseId: purchase.id,
          }
        : {}),
    },
  };
}
function Inventory({ expiry }: { expiry: boolean }) {
  const { s, open } = useOps();
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="Stock batches"
          value={s.batches.filter((b) => b.quantity > 0).length}
          detail="Traceable intake records"
        />
        <Metric
          label="In the fridge"
          value={
            s.batches.filter((b) => b.location === "fridge" && b.quantity > 0)
              .length
          }
          detail="Active batches"
        />
        <Metric
          label="In the freezer"
          value={
            s.batches.filter((b) => b.location === "freezer" && b.quantity > 0)
              .length
          }
          detail="Active batches"
        />
        <Metric
          label="Date review needed"
          value={
            s.batches.filter(
              (b) => b.quantity > 0 && (!b.expiry || b.expiry < today()),
            ).length
          }
          detail="Missing or expired dates"
        />
      </div>
      <Panel
        title={expiry ? "Storage & expiry register" : "Stock on hand"}
        action={<Add onClick={() => open(stockEditor(s))}>Receive stock</Add>}
      >
        <GridTable
          heads={
            expiry
              ? [
                  "Ingredient / batch",
                  "Location",
                  "Label expiry",
                  "Opened / frozen / thawed",
                  "Notes",
                  "",
                ]
              : [
                  "Ingredient / batch",
                  "Quantity",
                  "Available",
                  "Location",
                  "Label expiry",
                  "",
                ]
          }
          rows={s.batches.map((b) => [
            <span>
              <b>{s.ingredients.find((i) => i.id === b.ingredientId)?.name}</b>
              <small className="subtext">
                {b.id.slice(0, 8)} · received {b.intake}
              </small>
            </span>,
            ...(expiry
              ? [
                  b.location,
                  <Tag tone={!b.expiry || b.expiry < today() ? "amber" : ""}>
                    {b.expiry || "Date required"} · {b.dateType}
                  </Tag>,
                  `${b.opened || "—"} / ${b.frozen || "—"} / ${b.thawed || "—"}`,
                  b.notes,
                ]
              : [
                  `${Math.round(b.quantity * 100) / 100} ${s.ingredients.find((i) => i.id === b.ingredientId)?.unit}`,
                  `${Math.round(available(s, b.id) * 100) / 100}`,
                  b.location,
                  <Tag tone={!b.expiry || b.expiry < today() ? "amber" : ""}>
                    {b.expiry || "Date required"}
                  </Tag>,
                ]),
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                open({
                  title: "Update batch",
                  action: "stock-adjust",
                  values: { ...b, batchId: b.id, reason: "" },
                  fields: [
                    {
                      key: "quantity",
                      label: "Corrected quantity (base units)",
                      type: "number",
                    },
                    {
                      key: "reason",
                      label: "Reason for change",
                      required: true,
                    },
                    {
                      key: "location",
                      label: "Storage location",
                      options: ["fridge", "freezer", "ambient"],
                    },
                    {
                      key: "expiry",
                      label: "Verified expiry date",
                      type: "date",
                    },
                    { key: "opened", label: "Opened date", type: "date" },
                    { key: "frozen", label: "Frozen date", type: "date" },
                    { key: "thawed", label: "Thawed date", type: "date" },
                  ],
                })
              }
            >
              Update
            </Button>,
          ])}
        />
        <p className="panel-note">
          Missing or expired label dates prevent allocation. Changing storage
          does not automatically extend shelf life. Record the verified label or
          approved handling instructions.
        </p>
      </Panel>
      <Panel title="Stock movement history">
        <GridTable
          heads={["When", "Ingredient", "Change", "Reason"]}
          rows={s.movements
            .slice(-30)
            .reverse()
            .map((m) => [
              new Date(m.at).toLocaleString("en-GB"),
              s.ingredients.find(
                (i) =>
                  i.id ===
                  s.batches.find((b) => b.id === m.batchId)?.ingredientId,
              )?.name,
              Math.round(m.quantity * 100) / 100,
              m.reason,
            ])}
        />
      </Panel>
    </>
  );
}
function Suppliers() {
  const { s, open } = useOps();
  return (
    <>
      <Panel
        title="Your suppliers"
        action={
          <Add
            onClick={() =>
              open({
                title: "Add supplier",
                action: "supplier",
                fields: supplierFields,
              })
            }
          >
            Add supplier
          </Add>
        }
      >
        <GridTable
          heads={[
            "Supplier",
            "Delivery",
            "Minimum order",
            "Lead time",
            "Contact",
            "",
          ]}
          rows={s.suppliers.map((x) => [
            x.name,
            money(x.deliveryCharge),
            money(x.minimumOrder),
            `${x.leadDays} days`,
            <span>
              {x.email}
              <small className="subtext">{x.phone}</small>
            </span>,
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                open({
                  title: "Edit supplier",
                  action: "supplier",
                  fields: supplierFields,
                  values: x,
                })
              }
            >
              Edit
            </Button>,
          ])}
        />
      </Panel>
      <Panel
        title="Purchase orders"
        action={
          <Add
            onClick={() =>
              open({
                title: "Record supplier order",
                action: "purchase",
                fields: [
                  {
                    key: "supplierId",
                    label: "Supplier",
                    options: s.suppliers.map((x) => ({
                      value: x.id,
                      label: x.name,
                    })),
                  },
                  {
                    key: "ingredientId",
                    label: "Ingredient",
                    options: s.ingredients.map((x) => ({
                      value: x.id,
                      label: `${x.name} (${x.unit})`,
                    })),
                  },
                  {
                    key: "quantity",
                    label: "Quantity (base units)",
                    type: "number",
                  },
                  { key: "cost", label: "Agreed cost (£)", type: "money" },
                  { key: "eta", label: "Expected delivery", type: "date" },
                  {
                    key: "notes",
                    label: "Order reference / notes",
                    type: "textarea",
                  },
                ],
              })
            }
          >
            Record order
          </Add>
        }
      >
        <GridTable
          heads={[
            "Supplier / ingredient",
            "Quantity",
            "Cost",
            "ETA",
            "Status",
            "",
          ]}
          rows={s.purchases.map((p) => [
            `${s.suppliers.find((x) => x.id === p.supplierId)?.name} · ${s.ingredients.find((x) => x.id === p.ingredientId)?.name}`,
            p.quantity,
            money(p.cost),
            p.eta,
            <Tag>{p.status}</Tag>,
            p.status === "ordered" ? (
              <Button size="sm" onClick={() => open(stockEditor(s, p))}>
                Receive
              </Button>
            ) : (
              "—"
            ),
          ])}
        />
      </Panel>
      <Panel
        title="Supplier communication"
        action={
          <Add
            onClick={() =>
              open({
                title: "Log supplier communication",
                action: "supplier-note",
                fields: [
                  {
                    key: "supplierId",
                    label: "Supplier",
                    options: s.suppliers.map((x) => ({
                      value: x.id,
                      label: x.name,
                    })),
                  },
                  {
                    key: "message",
                    label: "Message / reply / call notes",
                    type: "textarea",
                    required: true,
                  },
                ],
              })
            }
          >
            Log communication
          </Add>
        }
      >
        <GridTable
          heads={["Supplier", "Date", "Message"]}
          rows={s.suppliers.flatMap((x) =>
            x.comms.map((c) => [
              x.name,
              new Date(c.at).toLocaleString("en-GB"),
              c.message,
            ]),
          )}
        />
        <div className="panel-note">
          Replies and calls are recorded manually. Purchase records do not
          automatically contact suppliers.
        </div>
      </Panel>
      <Panel title="Restock email drafts">
        <div className="card-list">
          {s.suppliers.map((sup) => (
            <div key={sup.id}>
              <h3>{sup.name}</h3>
              <p>{sup.notes}</p>
              <Button
                variant="outline"
                onClick={() =>
                  open({
                    title: "Review restock email",
                    action: "draft",
                    fields: draftFields,
                    values: {
                      to: sup.email,
                      subject:
                        "EM² Meals — stock availability and delivery request",
                      supplierId: sup.id,
                      body: `Hello ${sup.name},\n\nPlease confirm availability, pricing and your next delivery slot for:\n${s.ingredients
                        .filter((i) => i.supplierId === sup.id)
                        .map(
                          (i) => `• ${i.name}: quantity to confirm (${i.unit})`,
                        )
                        .join(
                          "\n",
                        )}\n\nPlease include delivery charges and any minimum order requirements. This is an availability enquiry, not a confirmed purchase.\n\nThank you,\nEM² Meals`,
                    },
                  })
                }
              >
                Prepare restock email
              </Button>
            </div>
          ))}
        </div>
        <Drafts />
      </Panel>
    </>
  );
}
const supplierFields: Spec[] = [
  { key: "name", label: "Supplier name", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone" },
  { key: "deliveryCharge", label: "Delivery charge (£)", type: "money" },
  { key: "minimumOrder", label: "Minimum order (£)", type: "money" },
  { key: "leadDays", label: "Delivery lead time (days)", type: "number" },
  { key: "notes", label: "Rates / terms / notes", type: "textarea" },
];
export const draftFields: Spec[] = [
  { key: "to", label: "To", type: "email", required: true },
  { key: "subject", label: "Subject", required: true },
  { key: "body", label: "Email content", type: "textarea", required: true },
];
function CRM() {
  const { s, open } = useOps();
  return (
    <>
      <Panel
        title="Customers & relationships"
        action={
          <Add
            onClick={() =>
              open({
                title: "Add customer",
                action: "customer",
                fields: customerFields,
              })
            }
          >
            Add customer
          </Add>
        }
      >
        <GridTable
          heads={[
            "Name / company",
            "Email",
            "Orders",
            "Preferences / notes",
            "",
          ]}
          rows={s.customers.map((c) => [
            <span>
              <b>{c.company || c.name}</b>
              <small className="subtext">{c.name}</small>
            </span>,
            c.email,
            s.orders.filter((o) => o.customerId === c.id).length,
            c.notes,
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                open({
                  title: "Update customer",
                  action: "customer",
                  fields: customerFields,
                  values: c,
                })
              }
            >
              Edit
            </Button>,
          ])}
        />
      </Panel>
      <Panel
        title="Feedback & follow-up"
        action={
          <Add
            onClick={() =>
              open({
                title: "Record customer feedback",
                action: "feedback",
                fields: [
                  {
                    key: "customerId",
                    label: "Customer",
                    options: s.customers.map((c) => ({
                      value: c.id,
                      label: c.company || c.name,
                    })),
                  },
                  {
                    key: "orderId",
                    label: "Order",
                    options: s.orders.map((o) => ({
                      value: o.id,
                      label: o.reference,
                    })),
                  },
                  { key: "rating", label: "Rating (1–5)", type: "number" },
                  { key: "date", label: "Date", type: "date" },
                  {
                    key: "comment",
                    label: "Feedback / issues / follow-up",
                    type: "textarea",
                  },
                ],
                values: { rating: 5 },
              })
            }
          >
            Record feedback
          </Add>
        }
      >
        <GridTable
          heads={["Customer", "Rating", "Date", "Feedback"]}
          rows={s.feedback.map((f) => [
            s.customers.find((c) => c.id === f.customerId)?.company ||
              s.customers.find((c) => c.id === f.customerId)?.name,
            `${f.rating} / 5`,
            f.date,
            f.comment,
          ])}
        />
      </Panel>
    </>
  );
}
const customerFields: Spec[] = [
  { key: "name", label: "Contact name", required: true },
  { key: "company", label: "Company" },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone" },
  { key: "notes", label: "Preferences / relationship notes", type: "textarea" },
];
function downloadCSV(name: string, rows: any[][]) {
  const csv = rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            String(v ?? "")
              .replace(/^[=+@-]/, "'$&")
              .replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function Reports() {
  const { s, open } = useOps();
  const [customer, setCustomer] = useState(s.customers[0]?.id || ""),
    [from, setFrom] = useState(today().slice(0, 7) + "-01"),
    [to, setTo] = useState(today());
  const report =
    customer && s.customers.some((c) => c.id === customer) && from <= to
      ? recap(s, customer, from, to)
      : null;
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="Measured waste"
          value={`${(s.waste.reduce((v, w) => v + w.weightGrams, 0) / 1000).toFixed(2)} kg`}
          detail="Only recorded weights"
        />
        <Metric
          label="Waste cost allocation"
          value={money(s.waste.reduce((v, w) => v + w.cost, 0))}
          detail="Already included in stock / meal costs"
        />
        <Metric
          label="Waste records"
          value={s.waste.length}
          detail="Measured events, all categories"
        />
        <Metric
          label="Delivered occasions"
          value={s.orders.filter((o) => o.status === "delivered").length}
          detail="Ready for customer reporting"
        />
      </div>
      <Panel
        title="Waste register"
        action={
          <Add
            onClick={() =>
              open({
                title: "Record measured waste",
                action: "waste",
                fields: [
                  {
                    key: "category",
                    label: "Waste category",
                    options: [
                      "preparation trimmings",
                      "spoilage",
                      "unserved portions",
                      "plate waste",
                    ],
                  },
                  {
                    key: "orderId",
                    label: "Order (required except spoilage)",
                    options: s.orders.map((o) => ({
                      value: o.id,
                      label: o.reference,
                    })),
                  },
                  {
                    key: "ingredientId",
                    label: "Ingredient (trimmings / spoilage)",
                    options: s.ingredients.map((i) => ({
                      value: i.id,
                      label: i.name,
                    })),
                  },
                  {
                    key: "recipeId",
                    label: "Meal (unserved / plate waste)",
                    options: s.recipes.map((r) => ({
                      value: r.id,
                      label: `${r.name} · ${r.variant}`,
                    })),
                  },
                  {
                    key: "batchId",
                    label: "Stock batch (spoilage only)",
                    options: s.batches.map((b) => ({
                      value: b.id,
                      label: `${s.ingredients.find((i) => i.id === b.ingredientId)?.name} · ${b.id.slice(0, 8)}`,
                    })),
                  },
                  { key: "quantity", label: "Quantity wasted", type: "number" },
                  {
                    key: "unit",
                    label: "Quantity unit",
                    options: ["g", "ml", "each", "portions"],
                  },
                  {
                    key: "weightGrams",
                    label: "Measured total weight (grams; 0 if unmeasured)",
                    type: "number",
                  },
                  { key: "date", label: "Date", type: "date" },
                  { key: "reason", label: "Observed reason", type: "textarea" },
                ],
                values: { category: "unserved portions", unit: "portions" },
              })
            }
          >
            Log waste
          </Add>
        }
      >
        <GridTable
          heads={[
            "Date",
            "Category",
            "Quantity",
            "Measured weight",
            "Cost allocation",
            "Reason",
          ]}
          rows={s.waste.map((w) => [
            w.date,
            w.category,
            `${w.quantity} ${w.unit}`,
            w.weightGrams ? `${w.weightGrams} g` : "Not measured",
            money(w.cost),
            w.reason,
          ])}
        />
        <p className="panel-note">
          Preparation trimmings come from ingredients already consumed. Only
          stock spoilage deducts stock here. Leftovers alone do not establish
          whether a dish was unpopular.
        </p>
      </Panel>
      <Panel title="Customer catering recap">
        <div className="report-controls">
          <Pick
            label="Customer"
            value={customer}
            onChange={setCustomer}
            options={s.customers.map((c) => ({
              value: c.id,
              label: c.company || c.name,
            }))}
          />
          <Field label="From" type="date" value={from} onChange={setFrom} />
          <Field label="To" type="date" value={to} onChange={setTo} />
        </div>
        {report ? (
          <>
            <div id="customer-recap" className="recap-card">
              <span className="eyebrow">EM² MEALS · YOUR CATERING RECAP</span>
              <h2>{report.customer}</h2>
              <p>
                {from} — {to}
              </p>
              <div className="report-metrics">
                <div>
                  <strong>{report.portions}</strong>
                  <span>portions prepared</span>
                </div>
                <div>
                  <strong>{report.wasteKg.toFixed(2)} kg</strong>
                  <span>measured waste</span>
                </div>
                <div>
                  <strong>{report.orders}</strong>
                  <span>occasions catered</span>
                </div>
                <div>
                  <strong>{report.feedback ?? "—"}</strong>
                  <span>average feedback / 5</span>
                </div>
              </div>
              <h3>Most ordered</h3>
              {report.popular.map((p) => (
                <div className="recap-dish" key={p.name}>
                  <span>{p.name}</span>
                  <b>{p.portions} portions</b>
                </div>
              ))}
              <p>
                {report.unservedPortions} unserved portions recorded. Waste
                figures reflect {report.wasteRecords} logged events; missing
                measurements are not treated as zero waste.
              </p>
              <small>
                Popular means most ordered, not a satisfaction score. No carbon
                savings are inferred.
              </small>
            </div>
            <div className="inline-actions">
              <Button variant="outline" onClick={() => window.print()}>
                Print recap
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadCSV("em2-catering-recap.csv", [
                    [
                      "Customer",
                      "From",
                      "To",
                      "Occasions",
                      "Portions",
                      "Measured waste kg",
                      "Unserved portions",
                      "Feedback",
                    ],
                    [
                      report.customer,
                      from,
                      to,
                      report.orders,
                      report.portions,
                      report.wasteKg,
                      report.unservedPortions,
                      report.feedback,
                    ],
                    [],
                    ["Most ordered", "Portions"],
                    ...report.popular.map((x) => [x.name, x.portions]),
                  ])
                }
              >
                <Download size={15} /> Export CSV
              </Button>
              <Button
                onClick={() =>
                  open({
                    title: "Review customer recap email",
                    action: "draft",
                    fields: draftFields,
                    values: {
                      to: s.customers.find((c) => c.id === customer)!.email,
                      customerId: customer,
                      subject: `Your EM² Meals catering recap · ${from} to ${to}`,
                      body: `Hello ${s.customers.find((c) => c.id === customer)!.name},\n\nHere is your catering recap for ${from} to ${to}:\n\n${report.orders} occasions catered\n${report.portions} portions prepared\n${report.wasteKg.toFixed(2)} kg measured food waste across ${report.wasteRecords} records\n${report.unservedPortions} unserved portions recorded\n\nMost ordered:\n${report.popular.map((p) => `${p.name}: ${p.portions} portions`).join("\n")}\n\n${report.feedback === null ? "No feedback recorded in this period." : `Average feedback: ${report.feedback}/5.`}\n\nThese figures reflect recorded measurements, not a full waste audit or a carbon-saving claim. We'd love your thoughts for next time.\n\nEM² Meals`,
                    },
                  })
                }
              >
                Prepare recap email
              </Button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            Choose a customer and a valid date range.
          </div>
        )}
      </Panel>
      <Panel title="Saved email drafts">
        <Drafts />
      </Panel>
    </>
  );
}
export function Drafts() {
  const { s, mode, api, busy } = useOps();
  const [view, setView] = useState<State["drafts"][number] | null>(null),
    [status, setStatus] = useState("");
  return (
    <>
      <GridTable
        heads={["To", "Subject", "Created", ""]}
        rows={s.drafts
          .slice()
          .reverse()
          .map((d) => [
            d.to,
            d.subject,
            new Date(d.at).toLocaleDateString("en-GB"),
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setView(d);
                setStatus("");
              }}
            >
              Review
            </Button>,
          ])}
      />
      <Dialog
        open={!!view}
        onOpenChange={(o) => {
          if (!o) setView(null);
        }}
      >
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>Review before sending</DialogTitle>
            <DialogDescription>
              {view?.to} · {view?.subject}
            </DialogDescription>
          </DialogHeader>
          <pre className="email-preview">{view?.body}</pre>
          {status && <p role="status">{status}</p>}
          <Button
            disabled={busy || mode === "sample" || status === "Email sent."}
            onClick={async () => {
              try {
                await api("send", { draftId: view!.id, confirm: true });
                setStatus("Email sent.");
              } catch (e) {
                setStatus((e as Error).message);
              }
            }}
          >
            <Send size={15} />
            {mode === "sample"
              ? "Sending disabled in sample workspace"
              : "Send reviewed email"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
function SettingsPage() {
  const { s, open, integrations } = useOps();
  return (
    <>
      <Panel
        title="Kitchen & business settings"
        action={
          <Button
            onClick={() =>
              open({
                title: "Business settings",
                action: "settings",
                values: s.settings,
                fields: [
                  { key: "kitchen", label: "Kitchen address / postcode" },
                  {
                    key: "vatRate",
                    label: "Configured VAT rate (%)",
                    type: "number",
                  },
                  { key: "vehicle", label: "Vehicle" },
                  {
                    key: "mpg",
                    label: "Measured fuel economy (UK MPG)",
                    type: "number",
                  },
                  {
                    key: "fuelPrice",
                    label: "Petrol price (£ per litre)",
                    type: "number",
                  },
                  {
                    key: "bufferMinutes",
                    label: "Loading / preparation buffer (minutes)",
                    type: "number",
                  },
                  {
                    key: "ownerNotes",
                    label: "Kitchen notes",
                    type: "textarea",
                  },
                ],
              })
            }
          >
            Edit settings
          </Button>
        }
      >
        <dl className="settings-list">
          <div>
            <dt>Kitchen</dt>
            <dd>{s.settings.kitchen || "Setup required"}</dd>
          </div>
          <div>
            <dt>VAT rate</dt>
            <dd>{s.settings.vatRate}% · owner configured</dd>
          </div>
          <div>
            <dt>Vehicle</dt>
            <dd>{s.settings.vehicle}</dd>
          </div>
          <div>
            <dt>Fuel economy</dt>
            <dd>
              {s.settings.mpg ? `${s.settings.mpg} UK MPG` : "Setup required"}
            </dd>
          </div>
          <div>
            <dt>Petrol price</dt>
            <dd>
              {s.settings.fuelPrice
                ? `£${s.settings.fuelPrice.toFixed(2)} / litre`
                : "Setup required"}
            </dd>
          </div>
          <div>
            <dt>Loading buffer</dt>
            <dd>{s.settings.bufferMinutes} minutes</dd>
          </div>
        </dl>
        <p className="panel-note">
          VAT is configurable; this workspace does not determine tax treatment
          or file tax returns. Kitchen and vehicle figures must be completed
          before live cost estimates.
        </p>
      </Panel>
      <Panel title="Connected services">
        <div className="integration-grid">
          {[
            [
              "gemini",
              "Gemini AI",
              "Structured enquiry review and read-only operations help.",
            ],
            [
              "maps",
              "Google Maps",
              "Address lookup and traffic-aware driving estimates.",
            ],
            [
              "email",
              "Business email",
              "Resend delivery after review and an explicit send.",
            ],
            [
              "owner",
              "Owner access",
              "ChatGPT sign-in with a server-side allowlist.",
            ],
          ].map(([k, t, d]) => (
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
function Assistant() {
  const { api, s, integrations, busy } = useOps();
  const [question, setQuestion] = useState(""),
    [result, setResult] = useState<any>(null),
    [error, setError] = useState(""),
    [venue, setVenue] = useState("");
  return (
    <>
      <Panel
        title="Your kitchen, in the know"
        action={
          <Tag tone={integrations.gemini ? "green" : "amber"}>
            {integrations.gemini
              ? "Gemini configured"
              : "Gemini setup required"}
          </Tag>
        }
      >
        <div className="assistant-intro">
          <Sparkles size={30} />
          <h2>What’s needed for the next occasion?</h2>
          <p>
            Ask about orders, ingredient requirements, stock shortages or saved
            delivery estimates. Suggestions stay separate from your records.
          </p>
          <div className="suggestions">
            {[
              "Which orders need attention?",
              "What ingredients are needed for upcoming orders?",
              "What stock should I restock?",
            ].map((q) => (
              <Button key={q} variant="outline" onClick={() => setQuestion(q)}>
                {q}
              </Button>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                setResult(await api("assistant", { question }));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Notes
              label="Ask the kitchen assistant"
              value={question}
              onChange={setQuestion}
            />
            <Button disabled={busy || !question} className="mt-4">
              {busy ? "Looking into it…" : "Ask Gemini"}
              <ArrowRight size={16} />
            </Button>
          </form>
        </div>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {result && (
          <div className="assistant-answer">
            <pre>{result.text}</pre>
            {result.sources?.map((s: any) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                {s.title} ↗
              </a>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Public venue research">
        <div className="report-controls">
          <Pick
            label="Order venue"
            value={venue}
            onChange={setVenue}
            options={s.orders.map((o) => ({
              value: o.id,
              label: `${o.reference} · ${o.details.venue}`,
            }))}
          />
          <Button
            disabled={!venue || busy}
            onClick={async () => {
              setError("");
              try {
                setResult(
                  await api("assistant", {
                    question: "Research venue",
                    venueOrderId: venue,
                  }),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Research venue
          </Button>
        </div>
        <p className="panel-note">
          Public sources may be incomplete or outdated. Confirm accessibility,
          loading and permits directly with the venue.
        </p>
      </Panel>
    </>
  );
}
