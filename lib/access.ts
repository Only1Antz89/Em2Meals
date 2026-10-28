// Who can do what in the owner workspace. Shared by the server (which
// enforces it) and the dashboard (which hides what a person can't use).

export const roles = ["owner", "manager", "kitchen", "viewer"] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  // Open the workspace and read day-to-day records.
  "view",
  // Recipes, ingredients, stock, waste, menus and production stages.
  "kitchen",
  // Enquiries, quotes, customers, venues and confirming or cancelling orders.
  "orders",
  // CRM notes, follow-ups, feedback and sending reviewed emails.
  "crm",
  // Purchasing, invoices, income, expenses and suppliers.
  "finance",
  // Put a menu live on the public website, or take it down.
  "menu-publish",
  // Business, kitchen, travel and stock settings.
  "settings",
  // Invite people, change roles, suspend access, send reset links.
  "team",
  // Full backups and permanent erasure of personal data.
  "data",
] as const;
export type Permission = (typeof permissions)[number];

export const roleInfo: Record<
  Role,
  { label: string; summary: string; permissions: readonly Permission[] }
> = {
  owner: {
    label: "Owner",
    summary: "Everything, including team access, backups and data erasure.",
    permissions,
  },
  manager: {
    label: "Manager",
    summary:
      "Runs the business day to day: orders, CRM, finance, menus and settings. Can't manage the team or export data.",
    permissions: [
      "view",
      "kitchen",
      "orders",
      "crm",
      "finance",
      "menu-publish",
      "settings",
    ],
  },
  kitchen: {
    label: "Kitchen",
    summary:
      "Recipes, stock, waste, menu drafts and production stages. Can't confirm orders, see finances or change settings.",
    permissions: ["view", "kitchen"],
  },
  viewer: {
    label: "Viewer",
    summary: "Read-only access to orders, recipes, stock, menus and reports.",
    permissions: ["view"],
  },
};

export const permissionLabels: Record<Permission, string> = {
  view: "See orders, recipes, stock and reports",
  kitchen: "Recipes, stock, waste and production",
  orders: "Enquiries, quotes and confirming orders",
  crm: "CRM and sending emails",
  finance: "Purchasing, invoices and finances",
  "menu-publish": "Publish menus to the website",
  settings: "Business and kitchen settings",
  team: "Manage team access",
  data: "Backups and data erasure",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, permission: Permission) {
  return !!role && roleInfo[role].permissions.includes(permission);
}

const kitchenCommands = new Set([
  "ingredient",
  "recipe",
  "recipe-save",
  "allergy-review",
  "stock-receive",
  "stock-adjust",
  "stock-recall",
  "recall-dispose",
  "recall-release",
  "waste",
  "usage",
  "cancel-reconcile",
  "procurement-draft",
  "menu-generate",
  "menu-save",
  "menu-sync",
  "menu-delete",
]);
const orderCommands = new Set([
  "customer",
  "order",
  "quote",
  "route",
  "journey",
  "venue-select",
  "offering",
  "analysis",
]);
const crmCommands = new Set([
  "crm-engagement",
  "crm-follow-up",
  "feedback",
  "draft",
  "draft-replace",
  "draft-close",
]);
const financeCommands = new Set([
  "finance",
  "finance-exclude",
  "income-link",
  "expense",
  "purchase",
  "purchase-confirm",
  "supplier",
  "supplier-note",
  "invoice-edit",
  "invoice-issue",
  "invoice-credit",
  "invoice-payment",
  "invoice-email",
]);

// The permission a workspace change needs. Anything not listed here needs
// settings access, so a new kind of change is never open to every role by
// accident.
export function commandPermission(type: string, payload?: unknown): Permission {
  if (type === "stage") {
    const status = (payload as { status?: unknown } | null)?.status;
    // Accepting, cancelling or declining is a decision about the booking;
    // moving through preparation stages is kitchen work.
    return ["confirmed", "cancelled", "declined"].includes(String(status))
      ? "orders"
      : "kitchen";
  }
  if (kitchenCommands.has(type)) return "kitchen";
  if (orderCommands.has(type)) return "orders";
  if (crmCommands.has(type)) return "crm";
  if (financeCommands.has(type)) return "finance";
  if (type === "menu-publish" || type === "menu-unpublish") return "menu-publish";
  if (type === "customer-erase" || type === "order-delete") return "data";
  return "settings";
}

// The permission needed to open each dashboard section.
export function sectionPermission(section: string): Permission {
  switch (section) {
    case "suppliers":
    case "business":
      return "finance";
    case "crm":
      return "crm";
    default:
      return "view";
  }
}

export function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

// The workspace as a role is allowed to see it. Changes are always applied to
// the full workspace on the server; this only trims what is sent back.
export function visibleState<T extends VisibleStateShape>(state: T, role: Role): T {
  if (can(role, "orders") && can(role, "crm") && can(role, "finance"))
    return state;
  const s = structuredClone(state);
  if (!can(role, "finance")) {
    s.invoices = [];
    s.finance = [];
  }
  if (!can(role, "crm")) {
    s.drafts = [];
    s.engagements = [];
    s.followUps = [];
  }
  if (!can(role, "orders")) {
    for (const customer of s.customers) {
      customer.email = "";
      customer.phone = "";
      customer.notes = "";
    }
    for (const order of s.orders) {
      order.details.email = "";
      order.details.phone = "";
    }
  }
  return s;
}

type VisibleStateShape = {
  invoices: unknown[];
  finance: unknown[];
  drafts: unknown[];
  engagements: unknown[];
  followUps: unknown[];
  customers: { email: string; phone: string; notes: string }[];
  orders: { details: { email: string; phone: string } }[];
};
