"use client";

import {
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, today, type State } from "@/lib/domain";
import { industries } from "@/lib/reporting";
import {
  crmCustomers,
  customerActivities,
  customerCrm,
  type CrmCustomer,
} from "@/lib/crm";
import { useOps, type Edit } from "./ops-context";

type Customer = State["customers"][number];
type FollowUp = State["followUps"][number];
type CrmFilter =
  | "all"
  | "attention"
  | "repeat"
  | "enquiry"
  | "quote"
  | "quiet";

const clientTabs = [
  ["", "Overview"],
  ["activity", "Activity"],
  ["orders", "Enquiries & orders"],
  ["feedback", "Feedback"],
  ["notes", "Notes"],
] as const;

const crmTabs = [
  ["crm", "Clients"],
  ["crm/pipeline", "Pipeline"],
  ["crm/follow-ups", "Follow-ups"],
  ["crm/feedback", "Feedback"],
] as const;

const filterLabels: [CrmFilter, string][] = [
  ["all", "All clients"],
  ["attention", "Needs attention"],
  ["repeat", "Repeat business"],
  ["enquiry", "Enquiry stalled"],
  ["quote", "Quote stalled"],
  ["quiet", "Quiet"],
];

const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Europe/London",
      }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
    : "—";

const dateTimeLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
      }).format(new Date(value))
    : "—";

const dateTimeInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`crm-section ${className}`}>
      <header className="crm-section-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function CrmTable({
  heads,
  children,
  empty,
}: {
  heads: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="crm-table-wrap">
      <table className="crm-table">
        <thead>
          <tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr>
        </thead>
        <tbody>
          {empty ? (
            <tr><td colSpan={heads.length} className="crm-empty">No matching records.</td></tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

function CrmNav({ active }: { active: string }) {
  const { href } = useOps();
  return (
    <nav className="crm-tabs" aria-label="CRM sections">
      {crmTabs.map(([path, label]) => (
        <a key={path} href={href(path)} className={active === path ? "active" : ""}>
          {label}
        </a>
      ))}
    </nav>
  );
}

function StatusText({ value }: { value: string }) {
  const tone = value.includes("stalled") || value === "Quiet" ? "gold" : value === "Active" ? "sage" : "";
  return <span className={`crm-status ${tone}`}>{value}</span>;
}

function openCustomerEditor(open: (edit: Edit) => void, customer?: Customer) {
  open({
    title: customer ? "Update customer" : "Add customer",
    action: "customer",
    fields: [
      { key: "industry", label: "Customer industry", options: [...industries] },
      { key: "name", label: "Contact name", required: true },
      { key: "company", label: "Company" },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "phone", label: "Phone" },
      { key: "notes", label: "Preferences / relationship notes", type: "textarea" },
    ],
    values: customer,
  });
}

function openEngagementEditor(
  open: (edit: Edit) => void,
  customer: Customer,
  orders: State["orders"],
) {
  open({
    title: "Record engagement",
    action: "crm-engagement",
    fields: [
      { key: "type", label: "Engagement type", options: ["call", "email", "meeting", "note"] },
      { key: "direction", label: "Direction", options: ["outbound", "inbound", "internal"] },
      { key: "occurredAt", label: "Date and time", type: "datetime-local", required: true },
      {
        key: "orderId",
        label: "Related enquiry or order",
        options: orders.map((order) => ({ value: order.id, label: order.reference })),
      },
      { key: "summary", label: "Summary", type: "textarea", required: true },
    ],
    values: {
      customerId: customer.id,
      type: "call",
      direction: "outbound",
      occurredAt: dateTimeInput(),
      orderId: "",
      summary: "",
    },
    transform: (value) => ({
      ...value,
      customerId: customer.id,
      orderId: value.orderId || undefined,
      occurredAt: new Date(value.occurredAt).toISOString(),
    }),
  });
}

function openFollowUpEditor(
  open: (edit: Edit) => void,
  customers: Customer[],
  orders: State["orders"],
  customer?: Customer,
  followUp?: FollowUp,
) {
  const selectedId = customer?.id || followUp?.customerId || customers[0]?.id || "";
  open({
    title: followUp ? "Update follow-up" : "Schedule follow-up",
    action: "crm-follow-up",
    fields: [
      {
        key: "customerId",
        label: "Customer",
        options: customers.map((item) => ({ value: item.id, label: item.company || item.name })),
        required: true,
      },
      {
        key: "orderId",
        label: "Related enquiry or order",
        options: orders
          .filter((order) => !selectedId || order.customerId === selectedId)
          .map((order) => ({ value: order.id, label: order.reference })),
      },
      { key: "dueDate", label: "Due date", type: "date", required: true },
      { key: "note", label: "Next action", type: "textarea", required: true },
    ],
    values: followUp || {
      customerId: selectedId,
      orderId: "",
      dueDate: today(),
      note: "",
      status: "open",
    },
    transform: (value) => ({
      ...value,
      id: followUp?.id,
      orderId: value.orderId || undefined,
      status: followUp?.status || "open",
    }),
  });
}

function openFeedbackEditor(
  open: (edit: Edit) => void,
  customers: Customer[],
  orders: State["orders"],
  customer?: Customer,
) {
  const customerId = customer?.id || customers[0]?.id || "";
  open({
    title: "Record customer feedback",
    action: "feedback",
    fields: [
      {
        key: "customerId",
        label: "Customer",
        options: customers.map((item) => ({ value: item.id, label: item.company || item.name })),
      },
      {
        key: "orderId",
        label: "Order",
        options: orders
          .filter((order) => !customerId || order.customerId === customerId)
          .map((order) => ({ value: order.id, label: order.reference })),
      },
      { key: "rating", label: "Rating (1–5)", type: "number" },
      { key: "date", label: "Date", type: "date" },
      { key: "comment", label: "Feedback / issues / follow-up", type: "textarea" },
    ],
    values: { customerId, rating: 5, date: today() },
  });
}

function RelationshipCell({ item }: { item: CrmCustomer }) {
  return (
    <>
      <strong>{item.repeat ? "Repeat business" : item.completedEvents ? "Past client" : "New prospect"}</strong>
      <small>{item.completedEvents ? `${item.completedEvents} completed event${item.completedEvents === 1 ? "" : "s"}` : "No completed events"}</small>
    </>
  );
}

function ClientsView() {
  const { s, open, href } = useOps();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CrmFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const clients = useMemo(() => crmCustomers(s), [s]);
  const filtered = useMemo(
    () => clients.filter((item) => {
      const haystack = `${item.customer.name} ${item.customer.company} ${item.customer.email} ${item.customer.notes}`.toLowerCase();
      if (deferredQuery && !haystack.includes(deferredQuery)) return false;
      if (filter === "attention") return item.needsAttention;
      if (filter === "repeat") return item.repeat;
      if (filter === "enquiry") return item.stage === "Enquiry stalled";
      if (filter === "quote") return item.stage === "Quote stalled";
      if (filter === "quiet") return item.stage === "Quiet";
      return true;
    }),
    [clients, deferredQuery, filter],
  );
  const attention = clients.filter((item) => item.needsAttention);

  return (
    <>
      <CrmNav active="crm" />
      <Section title="Clients" className="crm-client-list">
        <div className="crm-toolbar">
          <label className="crm-search">
            <Search size={17} />
            <span className="sr-only">Search clients</span>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients, email or notes…" />
          </label>
          <div className="crm-filters" aria-label="Filter clients">
            {filterLabels.map(([value, label]) => (
              <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
          <Button size="sm" onClick={() => openCustomerEditor(open)}><Plus size={15} /> Add customer</Button>
        </div>
        <CrmTable heads={["Client", "Relationship", "Current stage", "Last activity", "Next follow-up", "Lifetime value", ""]} empty={!filtered.length}>
          {filtered.map((item) => {
            const clientHref = href(`crm/client/${encodeURIComponent(item.customer.id)}`);
            return (
            <tr
              key={item.customer.id}
              className="crm-click-row"
              tabIndex={0}
              aria-label={`View ${item.customer.company || item.customer.name}`}
              onClick={() => window.location.assign(clientHref)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  window.location.assign(clientHref);
                }
              }}
            >
              <td><strong>{item.customer.company || item.customer.name}</strong><small>{item.customer.name} · {item.customer.email}</small></td>
              <td><RelationshipCell item={item} /></td>
              <td><StatusText value={item.stage} /></td>
              <td>{dateLabel(item.lastActivity)}<small>{item.lastActivity ? "Latest recorded activity" : "No activity recorded"}</small></td>
              <td>{item.nextFollowUp ? dateLabel(item.nextFollowUp.dueDate) : "—"}<small>{item.nextFollowUp?.note || "Not scheduled"}</small></td>
              <td>{money(item.lifetimeValue)}<small>{item.completedEvents} event{item.completedEvents === 1 ? "" : "s"}</small></td>
              <td><Button asChild variant="outline" size="sm"><a href={clientHref}>View client <ArrowRight size={14} /></a></Button></td>
            </tr>
            );
          })}
        </CrmTable>
      </Section>
      <Section title="Needs attention" description="Follow-ups due or overdue. Keep the conversation going." action={<a className="crm-text-link" href={href("crm/follow-ups")}>View all follow-ups <ArrowRight size={14} /></a>}>
        <CrmTable heads={["Due date", "Client", "Reason", "Next action", ""]} empty={!attention.length}>
          {attention.map((item) => (
            <tr key={item.customer.id}>
              <td className="crm-due">{item.nextFollowUp ? dateLabel(item.nextFollowUp.dueDate) : "Now"}<small>{item.nextFollowUp?.dueDate === today() ? "Due today" : item.nextFollowUp?.dueDate && item.nextFollowUp.dueDate < today() ? "Overdue" : "Needs review"}</small></td>
              <td><strong>{item.customer.company || item.customer.name}</strong><small>{item.customer.email}</small></td>
              <td><StatusText value={item.attentionReason} /></td>
              <td>{item.nextFollowUp?.note || "Schedule the next action"}</td>
              <td><Button asChild variant="outline" size="sm"><a href={href(`crm/client/${encodeURIComponent(item.customer.id)}`)}>View client <ArrowRight size={14} /></a></Button></td>
            </tr>
          ))}
        </CrmTable>
      </Section>
    </>
  );
}

function PipelineView() {
  const { s, href } = useOps();
  const customers = useMemo(() => new Map(s.customers.map((customer) => [customer.id, customer])), [s.customers]);
  const activeOrders = s.orders
    .filter((order) => !["delivered", "cancelled", "declined"].includes(order.status))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return (
    <>
      <CrmNav active="crm/pipeline" />
      <Section title="Pipeline" description="Active enquiries, quotes and confirmed events in one place.">
        <CrmTable heads={["Client", "Reference", "Event", "Stage", "Event date", "Value", ""]} empty={!activeOrders.length}>
          {activeOrders.map((order) => {
            const customer = customers.get(order.customerId);
            return (
              <tr key={order.id}>
                <td><strong>{customer?.company || customer?.name || order.details.name}</strong><small>{customer?.email || order.details.email}</small></td>
                <td>{order.reference}</td>
                <td>{order.details.eventType}<small>{order.details.attendees} people</small></td>
                <td><StatusText value={order.status === "enquiry" ? "Enquiry" : order.status === "quote" ? "Quote" : "Active"} /></td>
                <td>{dateLabel(order.details.date)}</td>
                <td>{order.quotes.length ? money(order.quotes.at(-1)!.total) : "Not quoted"}</td>
                <td><Button asChild variant="outline" size="sm"><a href={href(`orders/${encodeURIComponent(order.id)}`)}>View order <ArrowRight size={14} /></a></Button></td>
              </tr>
            );
          })}
        </CrmTable>
      </Section>
    </>
  );
}

function FollowUpsView() {
  const { s, open, run, href, busy } = useOps();
  const customers = useMemo(() => new Map(s.customers.map((customer) => [customer.id, customer])), [s.customers]);
  const followUps = [...s.followUps].sort((a, b) => {
    if (a.status === "open" && b.status !== "open") return -1;
    if (a.status !== "open" && b.status === "open") return 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  const updateStatus = (item: FollowUp, status: FollowUp["status"]) =>
    run("crm-follow-up", { ...item, status });
  return (
    <>
      <CrmNav active="crm/follow-ups" />
      <Section title="Follow-ups" description="Plan the next contact and close the loop." action={<Button size="sm" onClick={() => openFollowUpEditor(open, s.customers, s.orders)}><Plus size={15} /> Schedule follow-up</Button>}>
        <CrmTable heads={["Due date", "Client", "Next action", "Status", "Actions"]} empty={!followUps.length}>
          {followUps.map((item) => {
            const customer = customers.get(item.customerId);
            const due = item.status === "open" && item.dueDate <= today();
            return (
              <tr key={item.id}>
                <td className={due ? "crm-due" : ""}>{dateLabel(item.dueDate)}<small>{due ? item.dueDate < today() ? "Overdue" : "Due today" : ""}</small></td>
                <td><a className="crm-row-link" href={href(`crm/client/${encodeURIComponent(item.customerId)}`)}>{customer?.company || customer?.name || "Unknown customer"}</a><small>{customer?.email}</small></td>
                <td>{item.note}</td>
                <td><StatusText value={item.status === "open" ? "Open" : item.status === "completed" ? "Completed" : "Cancelled"} /></td>
                <td><div className="crm-row-actions">
                  {item.status === "open" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus(item, "completed")}><Check size={14} /> Complete</Button> : null}
                  <Button size="icon" variant="ghost" aria-label={`Edit follow-up for ${customer?.company || customer?.name}`} onClick={() => openFollowUpEditor(open, s.customers, s.orders, customer, item)}><Pencil size={14} /></Button>
                  {item.status === "open" ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => updateStatus(item, "cancelled")}>Cancel</Button> : null}
                </div></td>
              </tr>
            );
          })}
        </CrmTable>
      </Section>
    </>
  );
}

function FeedbackView({ customer }: { customer?: Customer }) {
  const { s, open } = useOps();
  const customers = useMemo(() => new Map(s.customers.map((item) => [item.id, item])), [s.customers]);
  const rows = customer ? s.feedback.filter((item) => item.customerId === customer.id) : s.feedback;
  return (
    <Section title="Feedback" description="Keep praise, issues and customer preferences connected to the event." action={<Button size="sm" onClick={() => openFeedbackEditor(open, s.customers, s.orders, customer)}><Plus size={15} /> Record feedback</Button>}>
      <CrmTable heads={["Customer", "Order", "Rating", "Date", "Feedback"]} empty={!rows.length}>
        {rows.map((item) => (
          <tr key={item.id}>
            <td><strong>{customers.get(item.customerId)?.company || customers.get(item.customerId)?.name}</strong></td>
            <td>{s.orders.find((order) => order.id === item.orderId)?.reference || "—"}</td>
            <td>{item.rating} / 5</td>
            <td>{dateLabel(item.date)}</td>
            <td>{item.comment}</td>
          </tr>
        ))}
      </CrmTable>
    </Section>
  );
}

function FeedbackPage() {
  return <><CrmNav active="crm/feedback" /><FeedbackView /></>;
}

function ActivityTimeline({ customerId, limit }: { customerId: string; limit?: number }) {
  const { s, href } = useOps();
  const activities = customerActivities(s, customerId).slice(0, limit);
  return activities.length ? (
    <ol className="crm-timeline">
      {activities.map((activity) => (
        <li key={activity.id} className={activity.tone}>
          <time>{dateTimeLabel(activity.at)}</time>
          <div><strong>{activity.title}</strong><p>{activity.detail}</p></div>
          {activity.orderId ? <a href={href(`orders/${encodeURIComponent(activity.orderId)}`)}>{activity.reference || "View order"}</a> : null}
        </li>
      ))}
    </ol>
  ) : <p className="crm-empty">No activity recorded yet.</p>;
}

function ClientTabs({ customerId, active }: { customerId: string; active: string }) {
  const { href } = useOps();
  const base = `crm/client/${encodeURIComponent(customerId)}`;
  return (
    <nav className="crm-tabs crm-client-tabs" aria-label="Client sections">
      {clientTabs.map(([path, label]) => (
        <a key={path} href={href(path ? `${base}/${path}` : base)} className={active === (path || "overview") ? "active" : ""}>{label}</a>
      ))}
    </nav>
  );
}

function ClientOrderHistory({ customer }: { customer: Customer }) {
  const { s, href } = useOps();
  const orders = s.orders.filter((order) => order.customerId === customer.id).sort((a, b) => b.details.date.localeCompare(a.details.date));
  return (
    <Section title="Order history" description="Past events and current enquiries for this client.">
      <CrmTable heads={["Order", "Event date", "Type", "People", "Total", "Status", ""]} empty={!orders.length}>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>{order.reference}</td><td>{dateLabel(order.details.date)}</td><td>{order.details.eventType}</td><td>{order.details.attendees}</td><td>{order.quotes.length ? money(order.quotes.at(-1)!.total) : "—"}</td><td><StatusText value={order.status} /></td><td><Button asChild variant="outline" size="sm"><a href={href(`orders/${encodeURIComponent(order.id)}`)}>View order <ArrowRight size={14} /></a></Button></td>
          </tr>
        ))}
      </CrmTable>
    </Section>
  );
}

function RelationshipDetails({ item }: { item: CrmCustomer }) {
  const { open } = useOps();
  return (
    <Section title="Relationship details" action={<Button variant="outline" size="sm" onClick={() => openCustomerEditor(open, item.customer)}>Edit</Button>}>
      <dl className="crm-definition-list">
        <div><dt>Industry</dt><dd>{item.customer.industry || "Unclassified"}</dd></div>
        <div><dt>First enquiry</dt><dd>{dateLabel(item.firstEnquiry)}</dd></div>
        <div><dt>Last activity</dt><dd>{dateLabel(item.lastActivity)}</dd></div>
        <div><dt>Next follow-up</dt><dd>{item.nextFollowUp ? dateLabel(item.nextFollowUp.dueDate) : "Not scheduled"}</dd></div>
        <div><dt>Lifetime value</dt><dd>{money(item.lifetimeValue)}</dd></div>
        <div><dt>Completed events</dt><dd>{item.completedEvents}</dd></div>
        <div className="wide"><dt>Preferences / notes</dt><dd>{item.customer.notes || "No relationship notes recorded."}</dd></div>
      </dl>
    </Section>
  );
}

function OpenWork({ customer }: { customer: Customer }) {
  const { s, open, run, href, busy } = useOps();
  const followUps = s.followUps.filter((item) => item.customerId === customer.id && item.status === "open").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const orders = s.orders.filter((order) => order.customerId === customer.id && !["delivered", "cancelled", "declined"].includes(order.status));
  return (
    <Section title="Open work" description="Upcoming follow-ups and active enquiries or quotes.">
      <div className="crm-open-work">
        {followUps.map((item) => (
          <article key={item.id}>
            <Clock3 size={16} /><div><strong>Scheduled follow-up</strong><p>{item.note}</p><small>{dateLabel(item.dueDate)}</small></div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => run("crm-follow-up", { ...item, status: "completed" })}>Mark complete</Button>
            <Button variant="ghost" size="icon" aria-label="Edit follow-up" onClick={() => openFollowUpEditor(open, s.customers, s.orders, customer, item)}><Pencil size={14} /></Button>
          </article>
        ))}
        {orders.map((order) => (
          <article key={order.id}>
            <span className="crm-work-dot" /><div><strong>Active {order.status}</strong><p>{order.details.eventType}</p><small>{order.reference}</small></div>
            <Button asChild variant="outline" size="sm"><a href={href(`orders/${encodeURIComponent(order.id)}`)}>View {order.status} <ArrowRight size={14} /></a></Button>
          </article>
        ))}
        {!followUps.length && !orders.length ? <p className="crm-empty">Nothing open for this client.</p> : null}
      </div>
    </Section>
  );
}

function ClientPage({ customerId, tab }: { customerId: string; tab: string }) {
  const { s, open } = useOps();
  const item = customerCrm(s, customerId);
  if (!item) return <Section title="Client not found"><p className="crm-empty">This client may have been removed or the link is invalid.</p></Section>;
  const customer = item.customer;
  const orders = s.orders.filter((order) => order.customerId === customer.id);
  return (
    <div className="crm-client-page">
      <header className="crm-client-header">
        <div><h1>{customer.company || customer.name}</h1><p>{customer.name} <span /> {customer.email} <span /> {customer.phone || "Phone not recorded"}</p><strong>{item.repeat ? "Repeat business" : item.stage} · {item.completedEvents} completed event{item.completedEvents === 1 ? "" : "s"}</strong></div>
        <div><Button onClick={() => openEngagementEditor(open, customer, orders)}><Plus size={15} /> Record engagement</Button><Button variant="outline" onClick={() => openFollowUpEditor(open, s.customers, s.orders, customer)}><Plus size={15} /> Schedule follow-up</Button></div>
      </header>
      <ClientTabs customerId={customer.id} active={tab} />
      {tab === "activity" ? <Section title="Activity" description={`A complete timeline of your relationship with ${customer.company || customer.name}.`}><ActivityTimeline customerId={customer.id} /></Section> : tab === "orders" ? <ClientOrderHistory customer={customer} /> : tab === "feedback" ? <FeedbackView customer={customer} /> : tab === "notes" ? <Section title="Notes" description="Preferences and relationship context shared across this client record." action={<Button variant="outline" size="sm" onClick={() => openCustomerEditor(open, customer)}>Edit notes</Button>}><div className="crm-notes">{customer.notes || "No relationship notes recorded."}</div></Section> : <><div className="crm-client-grid"><Section title="Recent activity" description={`A timeline of your relationship with ${customer.company || customer.name}.`}><ActivityTimeline customerId={customer.id} limit={6} /></Section><div className="crm-client-rail"><RelationshipDetails item={item} /><OpenWork customer={customer} /></div></div><ClientOrderHistory customer={customer} /></>}
    </div>
  );
}

export default function CRM({ path }: { path: string[] }) {
  if (path[0] === "client")
    return <ClientPage customerId={decodeURIComponent(path[1] || "")} tab={path[2] || "overview"} />;
  if (path[0] === "pipeline") return <PipelineView />;
  if (path[0] === "follow-ups") return <FollowUpsView />;
  if (path[0] === "feedback") return <FeedbackPage />;
  return <ClientsView />;
}
