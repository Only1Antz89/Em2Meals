"use client";
import { SignOutButton } from "@clerk/nextjs";
import { useRef, useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Utensils,
  Package,
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
  ChevronUp,
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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
  available,
  today,
  type State,
  type Order,
  type Recipe,
} from "@/lib/domain";
import OrderPanel from "./order-panel";
import BusinessHub from "./business-hub";
import WasteReports from "./waste-reports";
import CRM from "./crm";
import { RecipeEditor, RecipeLibrary } from "./recipe-library";
import {
  ExpiryBadge,
  StockSummary,
  SupplierInsights,
  UpcomingVenueResearch,
} from "./operations-panels";
import {
  categories,
  draftCurrent,
  filterInventoryBatches,
  filterStockMovements,
} from "@/lib/operations";
import { Context, useOps, type Ops, type Edit, type Spec } from "./ops-context";
import { updateQuery, useReportFilters } from "./report-controls";
const navigation = [
  ["", "Overview", LayoutDashboard],
  ["orders", "Enquiries & orders", ClipboardList],
  ["recipes", "Recipes & costing", Utensils],
  ["inventory", "Inventory", Package],
  ["suppliers", "Suppliers", Truck],
  ["crm", "CRM", Users],
  ["business", "Business", BarChart3],
  ["reports", "Waste & reports", BarChart3],
  ["assistant", "AutoSous", Sparkles],
  ["settings", "Settings", Settings],
] as const;
const inventoryNavigation = [
  ["", "Stock overview"],
  ["storage-expiry", "Storage & expiry"],
  ["movements", "Movement history"],
] as const;
const supplierNavigation = [
  ["overview", "Overview"],
  ["options", "Supplier options"],
  ["purchasing", "Purchasing"],
  ["requests", "Requests"],
] as const;
const businessNavigation = [
  ["overview", "Overview"],
  ["purchasing", "Purchasing"],
  ["invoices", "Invoices"],
  ["costs", "Costs & travel"],
] as const;
const crmNavigation = [
  ["", "Clients"],
  ["pipeline", "Pipeline"],
  ["follow-ups", "Follow-ups"],
  ["feedback", "Feedback"],
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
  authMode,
}: {
  section: string[];
  ownerEmail: string;
  authMode: "demo" | "clerk" | "chatgpt";
}) {
  const [s, setS] = useState(emptyState()),
    [revision, setRevision] = useState(0),
    [mode, setMode] = useState("live"),
    [loaded, setLoaded] = useState(false),
    [lastUpdated, setLastUpdated] = useState(""),
    [error, setError] = useState(""),
    [enquiries, setEnquiries] = useState<any[]>([]),
    [integrations, setIntegrations] = useState<Record<string, boolean>>({}),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Edit | null>(null);
  const fetchGeneration = useRef(0);
  const page = section[0] || "";
  const { params: navigationParams } = useReportFilters();
  const selectedTab = navigationParams.get("tab") || "overview";
  const href = (p: string) => `/admin${p ? "/" + p : ""}?mode=${mode}`;
  const nestedHref = (p: string, values: Record<string, string>) => {
    const query = new URLSearchParams({ mode, ...values });
    return `/admin/${p}?${query.toString()}`;
  };
  async function reload(selected = mode) {
    const generation = ++fetchGeneration.current;
    setError("");
    try {
      const r = await fetch(`/api/admin/state?mode=${selected}`, {
        cache: "no-store",
      });
      const j: any = await r.json();
      if (!r.ok) throw Error(j.error);
      if (generation !== fetchGeneration.current) return;
      setLastUpdated(new Date().toISOString());
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
  useEffect(() => {
    if (!loaded || busy || edit) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void reload(mode);
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [loaded, busy, edit, mode]);
  async function run(type: string, payload: any) {
    if (busy) throw Error("A save is already in progress");
    ++fetchGeneration.current;
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
      ++fetchGeneration.current;
      setLastUpdated(new Date().toISOString());
      setS(j.state);
      setRevision(j.revision);
    } finally {
      setBusy(false);
    }
  }
  async function api(path: string, payload: any) {
    if (busy) throw Error("Another request is in progress");
    ++fetchGeneration.current;
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
        ++fetchGeneration.current;
        setLastUpdated(new Date().toISOString());
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
  const crmClient =
    page === "crm" && section[1] === "client"
      ? s.customers.find((customer) => customer.id === section[2])
      : undefined;
  const inventoryPage =
    page === "inventory"
      ? inventoryNavigation.find(([path]) => path === (section[1] || ""))
      : undefined;
  const title = crmClient
    ? `CRM / ${crmClient.company || crmClient.name}`
    : inventoryPage?.[1] ||
      navigation.find((n) => n[0] === page)?.[1] ||
      "Order details";
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
            <Brand admin />
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
                        {path === "inventory" && page === path && (
                          <ChevronUp className="inventory-chevron" size={14} />
                        )}
                      </a>
                    </SidebarMenuButton>
                    {path === "inventory" && page === path && (
                      <SidebarMenuSub aria-label="Inventory sections">
                        {inventoryNavigation.map(([subpath, subLabel]) => (
                          <SidebarMenuSubItem key={subpath || "overview"}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={(section[1] || "") === subpath}
                            >
                              <a
                                href={href(
                                  subpath
                                    ? `inventory/${subpath}`
                                    : "inventory",
                                )}
                              >
                                {subLabel}
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                    {path === "suppliers" && page === path && (
                      <SidebarMenuSub aria-label="Supplier sections">
                        {supplierNavigation.map(([tab, subLabel]) => (
                          <SidebarMenuSubItem key={tab}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={page === path && selectedTab === tab}
                            >
                              <a href={nestedHref(path, { tab })}>{subLabel}</a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                    {path === "business" && page === path && (
                      <SidebarMenuSub aria-label="Business sections">
                        {businessNavigation.map(([tab, subLabel]) => (
                          <SidebarMenuSubItem key={tab}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={page === path && selectedTab === tab}
                            >
                              <a href={nestedHref(path, { tab })}>{subLabel}</a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                    {path === "crm" && page === path && (
                      <SidebarMenuSub aria-label="CRM sections">
                        {crmNavigation.map(([subpath, subLabel]) => (
                          <SidebarMenuSubItem key={subpath || "clients"}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={
                                subpath
                                  ? section[1] === subpath
                                  : !section[1] || section[1] === "client"
                              }
                            >
                              <a href={href(subpath ? `crm/${subpath}` : "crm")}>
                                {subLabel}
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
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
            {authMode === "clerk" ? (
              <SignOutButton redirectUrl="/">
                <button className="signout" type="button">
                  Sign out
                </button>
              </SignOutButton>
            ) : authMode === "chatgpt" ? (
              <a className="signout" href="/signout-with-chatgpt?return_to=/">
                Sign out
              </a>
            ) : (
              <a className="signout" href="/">
                Exit dashboard
              </a>
            )}
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="ops-topbar">
            <div>
              <SidebarTrigger />
              <span>
                Em2 Catering Platform /{" "}
                {page === "inventory" ? `Inventory / ${title}` : title}
              </span>
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
            {!(page === "crm" && section[1] === "client") && <div className="ops-heading">
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
                  {section[1] && page === "orders"
                    ? "Order details"
                    : page
                      ? ""
                      : "A good day starts here."}
                  {(!section[1] || page !== "orders") && page ? title : ""}
                </h1>
                <p>
                  {page === ""
                    ? "Your kitchen, your customers, your next occasion."
                    : page === "crm"
                      ? "Manage your clients, enquiries and follow-ups. Build lasting relationships through great food."
                      : "Keep the details together. Give the food your attention."}
                </p>
              </div>
              {page === "" && (
                <a className="outline-link" href={href("orders")}>
                  View orders <ArrowRight size={16} />
                </a>
              )}
            </div>}
            {loaded && !(page === "crm" && section[1] === "client") && (
              <p className="refresh-status" role="status">
                {error ? "Showing last successful data · " : "Updated "}
                {lastUpdated
                  ? new Date(lastUpdated).toLocaleTimeString("en-GB")
                  : "—"}{" "}
                · refreshes every 30 seconds while visible
              </p>
            )}
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
            ) : page === "inventory" && inventoryPage ? (
              <Inventory view={inventoryPage[0] || "overview"} />
            ) : page === "suppliers" ? (
              <Suppliers />
            ) : page === "business" ? (
              <BusinessHub />
            ) : page === "crm" ? (
              <CRM path={section.slice(1)} />
            ) : page === "reports" ? (
              <WasteReports />
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
export function Metric({
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
                <Tag key="cell-2">{f.type}</Tag>,
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
      heads={["Order / customer", "Occasion", "Guests", "Stage", "Venue"]}
      rows={orders.map((o) => [
        <a key="cell-0" href={href("orders/" + o.id)} className="record-link">
          <b>{o.details.company || o.details.name}</b>
          <small>{o.reference}</small>
        </a>,
        <span key="cell-1">
          {o.details.date || "Date to confirm"}
          <small className="subtext">{o.details.eventType}</small>
        </span>,
        o.details.attendees,
        <Tag
          key="cell-3"
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
        <a key="venue" href={href("orders/" + o.id)}>
          {o.details.venue || "Venue to confirm"}
          <small className="subtext">
            {o.venueResearch
              ? "Parking & access researched"
              : o.details.place
                ? "Venue selected · research pending"
                : "Enter venue details"}
          </small>
        </a>,
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
      <UpcomingVenueResearch />
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
              <span key="cell-1">
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
  const [editing, setEditing] = useState<Recipe | null | undefined>(undefined);
  const editorOpen = editing !== undefined;
  return (
    <>
      <RecipeLibrary onNew={() => setEditing(null)} onEdit={setEditing} />
      <Dialog
        open={editorOpen}
        onOpenChange={(o) => {
          if (!o) setEditing(undefined);
        }}
      >
        <DialogContent className="recipe-editor-dialog" showCloseButton={false}>
          <DialogTitle className="sr-only">{editing ? "Edit recipe" : "Create recipe"}</DialogTitle>
          {editorOpen ? <RecipeEditor initial={editing} onClose={() => setEditing(undefined)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
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
            quantity: purchase.quantity - (purchase.receivedQuantity || 0),
            purchaseId: purchase.id,
          }
        : {}),
    },
  };
}
type InventoryView = "overview" | "storage-expiry" | "movements";
const storageLocations = ["fridge", "freezer", "ambient"] as const;

function Inventory({ view }: { view: InventoryView }) {
  if (view === "storage-expiry") return <StorageExpiryRegister />;
  if (view === "movements") return <MovementHistory />;
  return <StockOverview />;
}

function StockOverview() {
  const { s, open } = useOps();
  const { params } = useReportFilters();
  const category = params.get("category") || "";
  const location = params.get("location") || "";
  const batches = filterInventoryBatches(s, {
    category,
    location,
    activeOnly: true,
  });
  return (
    <>
      <div className="stock-commitments-compact">
        <StockSummary />
      </div>
      <Panel
        title="Stock on hand"
        action={<Add onClick={() => open(stockEditor(s))}>Receive stock</Add>}
      >
        <InventoryFilterBar>
          <CategoryFilter value={category} />
          <LocationFilter value={location} />
        </InventoryFilterBar>
        <GridTable
          heads={[
            "Ingredient / batch",
            "Category",
            "Quantity",
            "Available",
            "Storage location",
            "Label expiry",
            "",
          ]}
          rows={batches.map((batch) => {
            const ingredient = s.ingredients.find(
              (item) => item.id === batch.ingredientId,
            );
            return [
              <BatchName key="batch" batch={batch} name={ingredient?.name} />,
              <StockCategory key="category" value={ingredient?.category} />,
              `${Math.round(batch.quantity * 100) / 100} ${ingredient?.unit || ""}`,
              `${Math.round(available(s, batch.id) * 100) / 100} ${ingredient?.unit || ""}`,
              <Tag key="location">{batch.location}</Tag>,
              <ExpiryBadge
                key="expiry"
                expiry={batch.expiry}
                dateType={batch.dateType}
              />,
              <UpdateBatchButton key="update" batch={batch} />,
            ];
          })}
          empty="No active stock matches these filters."
        />
        <StockHandlingNote />
      </Panel>
    </>
  );
}

function StorageExpiryRegister() {
  const { s } = useOps();
  const { params } = useReportFilters();
  const category = params.get("category") || "";
  const location = params.get("location") || "";
  const expirySort = params.get("sort") === "desc" ? "desc" : "asc";
  const batches = filterInventoryBatches(s, {
    category,
    location,
    activeOnly: true,
    expirySort,
  });
  return (
    <Panel title="Storage & expiry register">
      <InventoryFilterBar>
        <CategoryFilter value={category} />
        <LocationFilter value={location} />
        <Pick
          label="Expiry order"
          value={expirySort}
          onChange={(sort) => updateQuery({ sort })}
          options={[
            { value: "asc", label: "Earliest first" },
            { value: "desc", label: "Latest first" },
          ]}
        />
      </InventoryFilterBar>
      <GridTable
        heads={[
          "Ingredient / batch",
          "Category",
          "Storage location",
          "Label expiry",
          "Opened / frozen / thawed",
          "Notes",
          "",
        ]}
        rows={batches.map((batch) => {
          const ingredient = s.ingredients.find(
            (item) => item.id === batch.ingredientId,
          );
          return [
            <BatchName key="batch" batch={batch} name={ingredient?.name} />,
            <StockCategory key="category" value={ingredient?.category} />,
            <Tag key="location">{batch.location}</Tag>,
            <ExpiryBadge
              key="expiry"
              expiry={batch.expiry}
              dateType={batch.dateType}
            />,
            `${batch.opened || "—"} / ${batch.frozen || "—"} / ${batch.thawed || "—"}`,
            batch.notes || "—",
            <UpdateBatchButton key="update" batch={batch} />,
          ];
        })}
        empty="No active stock matches these filters."
      />
      <StockHandlingNote />
    </Panel>
  );
}

function MovementHistory() {
  const { s } = useOps();
  const { params } = useReportFilters();
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const reason = params.get("reason") || "";
  const reasons = [...new Set(s.movements.map((movement) => movement.reason))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const movements = filterStockMovements(s, { from, to, reason });
  return (
    <Panel title="Stock movement history">
      <InventoryFilterBar>
        <Field
          label="From"
          type="date"
          value={from}
          onChange={(value) => updateQuery({ from: value })}
        />
        <Field
          label="To"
          type="date"
          value={to}
          onChange={(value) => updateQuery({ to: value })}
        />
        <Pick
          label="Reason"
          value={reason}
          onChange={(value) => updateQuery({ reason: value })}
          options={[
            { value: "", label: "All reasons" },
            ...reasons.map((value) => ({ value, label: value })),
          ]}
        />
      </InventoryFilterBar>
      <GridTable
        heads={["When", "Ingredient", "Category", "Change", "Reason"]}
        rows={movements.map((movement) => {
          const batch = s.batches.find((item) => item.id === movement.batchId);
          const ingredient = s.ingredients.find(
            (item) => item.id === batch?.ingredientId,
          );
          return [
            new Date(movement.at).toLocaleString("en-GB"),
            ingredient?.name || "Unknown ingredient",
            <StockCategory key="category" value={ingredient?.category} />,
            `${Math.round(movement.quantity * 100) / 100} ${ingredient?.unit || ""}`,
            movement.reason,
          ];
        })}
        empty="No stock movements match this date range and reason."
      />
    </Panel>
  );
}

function InventoryFilterBar({ children }: { children: ReactNode }) {
  return <div className="inventory-filter-bar">{children}</div>;
}

function CategoryFilter({ value }: { value: string }) {
  return (
    <Pick
      label="Category"
      value={value}
      onChange={(category) => updateQuery({ category })}
      options={[
        { value: "", label: "All categories" },
        ...categories.map((category) => ({ value: category, label: category })),
      ]}
    />
  );
}

function LocationFilter({ value }: { value: string }) {
  return (
    <Pick
      label="Storage location"
      value={value}
      onChange={(location) => updateQuery({ location })}
      options={[
        { value: "", label: "All locations" },
        ...storageLocations,
      ]}
    />
  );
}

function StockCategory({ value }: { value?: string }) {
  return <span className="stock-category">{value || "other"}</span>;
}

function BatchName({
  batch,
  name,
}: {
  batch: State["batches"][number];
  name?: string;
}) {
  return (
    <span className="stock-batch-name">
      <b>{name || "Unknown ingredient"}</b>
      <small className="subtext">
        {batch.id.slice(0, 8)} · received {batch.intake}
      </small>
    </span>
  );
}

function UpdateBatchButton({ batch }: { batch: State["batches"][number] }) {
  const { open } = useOps();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        open({
          title: "Update batch",
          action: "stock-adjust",
          values: { ...batch, batchId: batch.id, reason: "" },
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
              options: [...storageLocations],
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
    </Button>
  );
}

function StockHandlingNote() {
  return (
    <p className="panel-note">
      Missing or expired label dates prevent allocation. Changing storage does
      not automatically extend shelf life. Record the verified label or approved
      handling instructions.
    </p>
  );
}
function Suppliers() {
  const { s, open, href } = useOps();
  const { params } = useReportFilters();
  const requestedTab = params.get("tab") || "overview";
  const tab = supplierNavigation.some(([value]) => value === requestedTab)
    ? requestedTab
    : "overview";
  const supplierId = params.get("supplier") || undefined;
  const addSupplier = () =>
    open({
      title: "Add supplier",
      action: "supplier",
      fields: supplierFields,
    });
  const editSupplier = (supplier: State["suppliers"][number]) =>
    open({
      title: "Edit supplier",
      action: "supplier",
      fields: supplierFields,
      values: supplier,
    });
  return (
    <>
      {tab === "overview" && (
        <SupplierInsights
          onAddSupplier={addSupplier}
          onEditSupplier={editSupplier}
          selectedSupplierId={supplierId}
          onSelectSupplier={(id) => updateQuery({ supplier: id })}
        />
      )}
      {tab === "options" && (
        <SupplierInsights
          section="options"
          onEditSupplier={editSupplier}
        />
      )}
      {tab === "purchasing" && (
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
            `${p.quantity} ordered · ${p.receivedQuantity || 0} received`,
            money(p.cost),
            p.eta,
            <Tag key="cell-4">{p.status}</Tag>,
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
      )}
      {tab === "requests" && (
        <>
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
      <Panel title="Supplier requests">
        <a href={`${href("business")}&tab=purchasing`}>
          Open combined purchasing and supplier email drafts →
        </a>
      </Panel>
        </>
      )}
    </>
  );
}
const supplierFields: Spec[] = [
  { key: "name", label: "Supplier name", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone" },
  { key: "contactName", label: "Point of contact" },
  { key: "contactRole", label: "Contact role" },
  { key: "website", label: "Business website (HTTPS)" },
  { key: "address", label: "Business address" },
  {
    key: "logoUrl",
    label: "Logo URL override (website favicon is used automatically)",
  },
  { key: "businessDetails", label: "Business details", type: "textarea" },
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
export function Drafts() {
  const { s, mode, api, busy } = useOps();
  const [view, setView] = useState<State["drafts"][number] | null>(null),
    [status, setStatus] = useState(""),
    [deliveryNote, setDeliveryNote] = useState("");
  return (
    <>
      <GridTable
        heads={["To", "Subject", "Created", "Status", ""]}
        rows={s.drafts
          .slice()
          .reverse()
          .map((d) => [
            d.to,
            d.subject,
            new Date(d.at).toLocaleDateString("en-GB"),
            d.deliveryStatus === "uncertain" || d.deliveryStatus === "sending"
              ? "Delivery needs verification"
              : d.deliveryStatus === "failed"
                ? "Send failed — replace draft"
                : d.superseded
                  ? "Superseded"
                  : d.sentAt
                    ? "Sent"
                    : draftCurrent(s, d)
                      ? "Ready for review"
                      : "Needs updating",
            <Button
              key="cell-4"
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
          {view && !draftCurrent(s, view) && (
            <p role="status">
              Needs updating. Refresh this supplier draft in Business before
              sending.
            </p>
          )}
          {view?.deliveryStatus &&
            ["uncertain", "sending", "failed"].includes(view.deliveryStatus) &&
            mode === "live" && (
              <div>
                <p>
                  Check this request in the email provider before recording the
                  delivery outcome.
                </p>
                <Field
                  label="Provider verification note"
                  value={deliveryNote}
                  onChange={setDeliveryNote}
                />
                <div className="inline-actions">
                  {["sent", "not-sent"].map((outcome) => (
                    <Button
                      key={outcome}
                      variant="outline"
                      disabled={busy || deliveryNote.length < 5}
                      onClick={async () => {
                        try {
                          await api("delivery", {
                            draftId: view.id,
                            outcome,
                            note: deliveryNote,
                          });
                          setView(null);
                        } catch (e) {
                          setStatus((e as Error).message);
                        }
                      }}
                    >
                      {outcome === "sent"
                        ? "Verified delivered"
                        : "Verified not sent"}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          {status && <p role="status">{status}</p>}
          <Button
            disabled={
              busy ||
              mode === "sample" ||
              status === "Email sent." ||
              !!view?.sentAt ||
              !!view?.superseded ||
              !!view?.deliveryStatus ||
              (!!view &&
                !draftCurrent(
                  s,
                  s.drafts.find((d) => d.id === view.id) || view,
                ))
            }
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
                    key: "priceMode",
                    label: "Default price entry",
                    options: [
                      { value: "exclusive", label: "Add VAT to price" },
                      { value: "inclusive", label: "Price includes VAT" },
                    ],
                  },
                  { key: "businessName", label: "Business legal name" },
                  { key: "businessAddress", label: "Business address" },
                  { key: "vatNumber", label: "VAT registration number" },
                  {
                    key: "paymentInstructions",
                    label: "Invoice payment instructions",
                    type: "textarea",
                  },
                  {
                    key: "warningDays",
                    label: "Expiry warning (days)",
                    type: "number",
                  },
                  {
                    key: "urgentDays",
                    label: "Urgent use-by warning (days)",
                    type: "number",
                  },
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
                  {
                    key: "recipeEditorMode",
                    label: "Recipe editor layout",
                    options: [
                      { value: "workspace", label: "Single workspace" },
                      { value: "wizard", label: "Three-step wizard" },
                    ],
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
          <div>
            <dt>Recipe editor</dt>
            <dd>
              {s.settings.recipeEditorMode === "wizard"
                ? "Three-step wizard"
                : "Single workspace"}
            </dd>
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
              "AutoSous",
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
              "SMTP2GO delivery after review and an explicit send.",
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
              ? "AutoSous ready"
              : "AutoSous setup required"}
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
            <Button
              disabled={busy || !question || !integrations.gemini}
              title={
                !integrations.gemini
                  ? "AutoSous is not available in this deployment"
                  : undefined
              }
              className="mt-4"
            >
              {busy ? "Looking into it…" : "Ask AutoSous"}
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
            disabled={!venue || busy || !integrations.gemini}
            title={
              !integrations.gemini
                ? "AutoSous is not available in this deployment"
                : undefined
            }
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
