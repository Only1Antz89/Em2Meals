import { today, type State } from "./domain";

const CLOSED = new Set(["delivered", "cancelled", "declined"]);

export type CrmStage =
  | "Active"
  | "Enquiry stalled"
  | "Quote stalled"
  | "Quiet"
  | "Past client"
  | "New prospect";

export type CrmActivity = {
  id: string;
  at: string;
  title: string;
  detail: string;
  orderId?: string;
  reference?: string;
  tone: "sage" | "gold" | "muted";
};

export type CrmCustomer = {
  customer: State["customers"][number];
  stage: CrmStage;
  repeat: boolean;
  completedEvents: number;
  lifetimeValue: number;
  firstEnquiry: string;
  lastActivity: string;
  nextFollowUp?: State["followUps"][number];
  needsAttention: boolean;
  attentionReason: string;
};

const londonDate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(parsed)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const asTime = (value: string) => {
  const parsed = Date.parse(value.length === 10 ? `${value}T12:00:00.000Z` : value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const dayNumber = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
const daysSince = (value: string, day: string) => {
  const activityDay = londonDate(value);
  return activityDay ? dayNumber(day) - dayNumber(activityDay) : 0;
};
const titleCase = (value: string) =>
  value.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

export function customerActivities(
  s: State,
  customerId: string,
): CrmActivity[] {
  const orders = s.orders.filter((order) => order.customerId === customerId);
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const activity: CrmActivity[] = [];

  for (const order of orders) {
    if (order.createdAt)
      activity.push({
        id: `enquiry-${order.id}`,
        at: order.createdAt,
        title: "Enquiry received",
        detail: `${order.details.eventType || "Catering enquiry"} for ${order.details.attendees} people`,
        orderId: order.id,
        reference: order.reference,
        tone: "sage",
      });
    for (const quote of order.quotes)
      activity.push({
        id: `quote-${order.id}-${quote.version}`,
        at: quote.at,
        title: "Quote sent",
        detail: `Version ${quote.version} · £${(quote.total / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
        orderId: order.id,
        reference: order.reference,
        tone: "gold",
      });
    for (const entry of order.statusHistory || []) {
      if (["enquiry", "quote"].includes(entry.status)) continue;
      const title =
        entry.status === "confirmed"
          ? "Event confirmed"
          : entry.status === "delivered"
            ? "Event completed"
            : entry.status === "declined"
              ? "Opportunity declined"
              : entry.status === "cancelled"
                ? "Event cancelled"
                : titleCase(entry.status);
      activity.push({
        id: `status-${order.id}-${entry.status}-${entry.at}`,
        at: entry.at,
        title,
        detail: `${order.details.eventType || "Catering event"} · ${order.status === entry.status ? "Current stage" : "Stage updated"}`,
        orderId: order.id,
        reference: order.reference,
        tone: ["confirmed", "delivered"].includes(entry.status) ? "sage" : "muted",
      });
    }
  }

  for (const draft of s.drafts.filter(
    (draft) => draft.customerId === customerId && draft.sentAt,
  ))
    activity.push({
      id: `draft-${draft.id}`,
      at: draft.sentAt!,
      title: "Email sent",
      detail: draft.subject,
      tone: "muted",
    });

  for (const feedback of s.feedback.filter(
    (item) => item.customerId === customerId,
  )) {
    const order = orderById.get(feedback.orderId);
    activity.push({
      id: `feedback-${feedback.id}`,
      at: `${feedback.date}T12:00:00.000Z`,
      title: "Feedback received",
      detail: `${feedback.rating}/5 · ${feedback.comment}`,
      orderId: feedback.orderId,
      reference: order?.reference,
      tone: "sage",
    });
  }

  for (const engagement of s.engagements.filter(
    (item) => item.customerId === customerId,
  )) {
    const order = engagement.orderId
      ? orderById.get(engagement.orderId)
      : undefined;
    activity.push({
      id: `engagement-${engagement.id}`,
      at: engagement.occurredAt,
      title: engagement.type === "call" ? "Phone call" : titleCase(engagement.type),
      detail: engagement.summary,
      orderId: engagement.orderId,
      reference: order?.reference,
      tone: "muted",
    });
  }

  return activity.sort((a, b) => asTime(b.at) - asTime(a.at));
}

export function customerCrm(
  s: State,
  customerId: string,
  day = today(),
): CrmCustomer | null {
  const customer = s.customers.find((item) => item.id === customerId);
  if (!customer) return null;
  const orders = s.orders.filter((order) => order.customerId === customerId);
  const completedEvents = orders.filter((order) => order.status === "delivered").length;
  const repeat = completedEvents >= 2;
  const active = orders.filter((order) => !CLOSED.has(order.status));
  const activities = customerActivities(s, customerId);
  const lastActivity = activities[0]?.at || "";
  const firstEnquiry = orders
    .map((order) => order.createdAt || "")
    .filter(Boolean)
    .sort()[0] || "";
  const openFollowUps = s.followUps
    .filter((item) => item.customerId === customerId && item.status === "open")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextFollowUp = openFollowUps[0];
  const hasFutureFollowUp = openFollowUps.some((item) => item.dueDate > day);
  const enquiryStalled = active.some(
    (order) =>
      order.status === "enquiry" &&
      !!order.createdAt &&
      daysSince(order.createdAt, day) >= 3,
  );
  const quoteStalled = active.some((order) => {
    const lastQuote = order.quotes.at(-1);
    return order.status === "quote" && !!lastQuote && daysSince(lastQuote.at, day) >= 7;
  });
  const quiet =
    completedEvents > 0 &&
    active.length === 0 &&
    !!lastActivity &&
    daysSince(lastActivity, day) >= 90;
  const overdueFollowUp = openFollowUps.some((item) => item.dueDate <= day);
  const stage: CrmStage = quoteStalled
    ? "Quote stalled"
    : enquiryStalled
      ? "Enquiry stalled"
      : quiet
        ? "Quiet"
        : active.length
          ? "Active"
          : completedEvents
            ? "Past client"
            : "New prospect";
  const lifecycleAttention = quoteStalled || enquiryStalled || quiet;
  const needsAttention = overdueFollowUp || (lifecycleAttention && !hasFutureFollowUp);
  const attentionReason = overdueFollowUp
    ? "Follow-up due"
    : quoteStalled
      ? "Quote stalled"
      : enquiryStalled
        ? "Enquiry stalled"
        : quiet
          ? "No contact for a while"
          : "";
  const orderIds = new Set(orders.map((order) => order.id));
  const lifetimeValue = s.finance
    .filter(
      (entry) =>
        entry.type === "income" && !!entry.orderId && orderIds.has(entry.orderId),
    )
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    customer,
    stage,
    repeat,
    completedEvents,
    lifetimeValue,
    firstEnquiry,
    lastActivity,
    nextFollowUp,
    needsAttention,
    attentionReason,
  };
}

export function crmCustomers(s: State, day = today()) {
  return s.customers
    .map((customer) => customerCrm(s, customer.id, day))
    .filter((customer): customer is CrmCustomer => !!customer);
}
