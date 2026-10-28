import { z } from "zod";
import type { Order, State } from "./domain";

// UK GDPR support: erase a customer's personal data on request, and remove
// unworked enquiries (spam, duplicates, tests). Financial records that must be
// retained (issued invoices and accounting entries) are kept unchanged.

export const erasedName = "Erased customer";
const closedStatuses = ["delivered", "cancelled", "declined"];
const openEnquiryStatuses = ["enquiry", "quote"];
const deletableStatuses = ["enquiry", "quote", "declined"];

export const erasedEmail = (customerId: string) =>
  `erased-${customerId.slice(0, 8)}@example.invalid`;

export function customerOrders(s: State, customerId: string) {
  return s.orders.filter((order) => order.customerId === customerId);
}

// Orders past acceptance have stock and allergy commitments that must be
// completed or cancelled before the customer's details can be removed.
export function erasureBlockers(s: State, customerId: string) {
  return customerOrders(s, customerId).filter(
    (order) =>
      !closedStatuses.includes(order.status) &&
      !openEnquiryStatuses.includes(order.status),
  );
}

export function retainedInvoices(s: State, customerId: string) {
  const ids = new Set(customerOrders(s, customerId).map((order) => order.id));
  return s.invoices.filter(
    (invoice) => ids.has(invoice.orderId) && invoice.status === "issued",
  );
}

// Records that make an order part of the business history.
export function orderDeleteBlockers(s: State, order: Order) {
  const blockers: string[] = [];
  if (!deletableStatuses.includes(order.status))
    blockers.push("it has been accepted");
  if (order.reservations.length) blockers.push("it holds stock reservations");
  if (s.invoices.some((x) => x.orderId === order.id)) blockers.push("it has invoices");
  if (s.finance.some((x) => x.orderId === order.id)) blockers.push("it has finance entries");
  if (s.purchases.some((x) => x.orderIds?.includes(order.id)))
    blockers.push("purchases were made for it");
  if (s.movements.some((x) => x.orderId === order.id)) blockers.push("stock moved for it");
  if (s.waste.some((x) => x.orderId === order.id)) blockers.push("waste was recorded");
  if (s.feedback.some((x) => x.orderId === order.id)) blockers.push("it has feedback");
  if (s.journeys.some((x) => x.orderId === order.id)) blockers.push("journeys were recorded");
  return blockers;
}

function anonymiseOrder(order: Order, email: string) {
  order.details = {
    ...order.details,
    name: erasedName,
    company: "",
    email,
    phone: "",
    venue: "",
    address: "",
    postcode: "",
    locality: "",
    place: undefined,
    access: "",
    requests: "",
    dietary: "",
    requirements: [],
    unknownDetails: "",
  };
  delete order.analysis;
  delete order.venueResearch;
  if (openEnquiryStatuses.includes(order.status)) {
    order.status = "declined";
    order.statusHistory = [
      ...(order.statusHistory || []),
      { status: "declined", at: new Date().toISOString() },
    ];
  }
}

export function privacyCommand(
  s: State,
  type: string,
  payload: unknown,
  at: string,
): string | undefined {
  if (type === "customer-erase") {
    const v = z.object({ customerId: z.string().min(1) }).parse(payload);
    const customer = s.customers.find((x) => x.id === v.customerId);
    if (!customer) throw Error("Customer not found");
    const blockers = erasureBlockers(s, customer.id);
    if (blockers.length)
      throw Error(
        `Complete or cancel ${blockers.map((o) => o.reference).join(", ")} before erasing this customer's data.`,
      );
    const email = erasedEmail(customer.id);
    Object.assign(customer, {
      name: erasedName,
      company: "",
      email,
      phone: "",
      notes: "",
      erasedAt: at,
    });
    const orders = customerOrders(s, customer.id);
    const orderIds = new Set(orders.map((o) => o.id));
    for (const order of orders) anonymiseOrder(order, email);
    for (const invoice of s.invoices)
      if (orderIds.has(invoice.orderId) && invoice.status === "draft")
        Object.assign(invoice, { customer: erasedName, email, billingAddress: "" });
    for (const draft of s.drafts)
      if (draft.customerId === customer.id)
        Object.assign(draft, {
          to: email,
          subject: "[Erased]",
          body: "[Content erased at the customer's request]",
        });
    for (const item of s.feedback)
      if (item.customerId === customer.id) item.comment = "";
    s.engagements = s.engagements.filter((x) => x.customerId !== customer.id);
    s.followUps = s.followUps.filter((x) => x.customerId !== customer.id);
    // Shared Wrapped links carry the customer's name and quotes: withdraw them.
    s.wrapped = (s.wrapped || []).filter((x) => x.customerId !== customer.id);
    return customer.id;
  }
  if (type === "order-delete") {
    const v = z.object({ orderId: z.string().min(1) }).parse(payload);
    const order = s.orders.find((x) => x.id === v.orderId);
    if (!order) throw Error("Order not found");
    const blockers = orderDeleteBlockers(s, order);
    if (blockers.length)
      throw Error(
        `This order can't be deleted because ${blockers.join(", ")}. Decline or cancel it instead.`,
      );
    s.orders = s.orders.filter((x) => x.id !== order.id);
    for (const item of [...s.engagements, ...s.followUps])
      if (item.orderId === order.id) delete item.orderId;
    // Remove a customer created only for this enquiry.
    const customer = s.customers.find((x) => x.id === order.customerId);
    if (
      customer &&
      !customer.notes &&
      !s.orders.some((x) => x.customerId === customer.id) &&
      !s.feedback.some((x) => x.customerId === customer.id) &&
      !s.engagements.some((x) => x.customerId === customer.id) &&
      !s.followUps.some((x) => x.customerId === customer.id)
    )
      s.customers = s.customers.filter((x) => x.id !== customer.id);
    return order.id;
  }
  return undefined;
}

// Raw website submissions linked to the records being erased or deleted.
export function linkedEnquiryIds(s: State, type: string, payload: unknown) {
  const p = (payload || {}) as { customerId?: string; orderId?: string };
  const orders =
    type === "customer-erase"
      ? s.orders.filter((o) => o.customerId === p.customerId)
      : type === "order-delete"
        ? s.orders.filter((o) => o.id === p.orderId)
        : [];
  const email =
    type === "customer-erase"
      ? s.customers.find((c) => c.id === p.customerId)?.email.trim().toLowerCase()
      : undefined;
  return {
    ids: orders.map((o) => o.enquiryId).filter((id): id is string => !!id),
    email,
  };
}
