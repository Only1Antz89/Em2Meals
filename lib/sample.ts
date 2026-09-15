import {
  emptyState,
  applyCommand,
  today,
  type State,
  type Enquiry,
} from "./domain";
export function sampleState(): State {
  let s = emptyState();
  const run = (type: string, payload: any) => {
    s = applyCommand(
      s,
      { id: crypto.randomUUID(), type, payload },
      "Sample setup",
    );
  };
  s.settings = {
    ...s.settings,
    kitchen: "London SE1 (example kitchen)",
    mpg: 32,
    fuelPrice: 1.5,
    vatRate: 20,
  };
  for (const supplier of [
    {
      id: "supplier-1",
      name: "Borough Produce · example",
      email: "produce@example.com",
      phone: "020 0000 0000",
      contactName: "Maya Patel",
      contactRole: "Account manager",
      website: "https://example.com/borough-produce",
      address: "Southwark, London · example",
      businessDetails: "Fresh produce and ambient kitchen staples.",
      deliveryCharge: 800,
      minimumOrder: 5000,
      leadDays: 1,
      notes: "Sample supplier. Rates are illustrative.",
    },
    {
      id: "supplier-2",
      name: "City Pantry · example",
      email: "orders@example.org",
      phone: "020 0000 0001",
      contactName: "Noah Williams",
      contactRole: "Wholesale team",
      website: "https://example.org/city-pantry",
      address: "Shoreditch, London · example",
      businessDetails: "Meat, poultry and chilled ingredients.",
      deliveryCharge: 1200,
      minimumOrder: 7500,
      leadDays: 2,
      notes: "Sample supplier. Rates are illustrative.",
    },
    {
      id: "supplier-3",
      name: "Fresh Direct · example",
      email: "hello@example.net",
      phone: "020 0000 0002",
      contactName: "Ava Thompson",
      contactRole: "Produce desk",
      website: "https://example.net/fresh-direct",
      address: "Bermondsey, London · example",
      businessDetails: "Seasonal fruit, vegetables and herbs.",
      deliveryCharge: 600,
      minimumOrder: 4000,
      leadDays: 1,
      notes: "Sample supplier. Rates are illustrative.",
    },
    {
      id: "supplier-4",
      name: "Southbank Bakery · example",
      email: "bakery@example.com",
      phone: "020 0000 0003",
      contactName: "Leo Martin",
      contactRole: "Trade orders",
      website: "https://example.com/southbank-bakery",
      address: "Waterloo, London · example",
      businessDetails: "Breads, buns and baked goods.",
      deliveryCharge: 500,
      minimumOrder: 3000,
      leadDays: 2,
      notes: "Sample supplier. Rates are illustrative.",
    },
  ])
    run("supplier", supplier);
  const ingredients = [
    ["beef", "Beef mince", "g", 1000, 950, 1, "", 3000],
    ["plain", "Plain brioche bun", "each", 12, 540, 1, "Wheat, milk, egg", 24],
    [
      "seeded",
      "Seeded brioche bun",
      "each",
      12,
      600,
      1,
      "Wheat, milk, egg, sesame",
      24,
    ],
    ["lettuce", "Little gem lettuce", "g", 1000, 280, 0.85, "", 500],
    ["ketchup", "Tomato ketchup", "ml", 1000, 350, 1, "", 200],
    ["cheese", "Cheddar cheese", "g", 1000, 780, 1, "Milk", 400],
    ["onion", "Red onion", "g", 1000, 180, 0.88, "", 500],
    ["carrot", "Carrots", "g", 1000, 160, 0.8, "", 500],
  ];
  for (const [
    id,
    name,
    unit,
    packQuantity,
    packCost,
    yieldValue,
    allergens,
    threshold,
  ] of ingredients)
    run("ingredient", {
      id,
      name,
      unit,
      packQuantity,
      packCost,
      yield: yieldValue,
      allergens,
      supplierId: "supplier-1",
      threshold,
      category:
        id === "beef"
          ? "beef"
          : id === "cheese"
            ? "dairy"
            : ["lettuce", "onion", "carrot"].includes(String(id))
              ? "vegetables"
              : undefined,
    });
  const lines = [
    { ingredientId: "beef", quantity: 150 },
    { ingredientId: "lettuce", quantity: 20 },
    { ingredientId: "ketchup", quantity: 15 },
    { ingredientId: "cheese", quantity: 25 },
  ];
  run("recipe", {
    id: "burger-seeded",
    name: "House beef burger",
    variant: "Seeded bun · with onion",
    collections: [{ year: Number(today().slice(0, 4)), season: "Summer" }],
    lines: [
      ...lines,
      { ingredientId: "seeded", quantity: 1 },
      { ingredientId: "onion", quantity: 15 },
    ],
  });
  run("recipe", {
    id: "burger-plain",
    name: "House beef burger",
    variant: "Plain bun · no onion",
    collections: [
      { year: Number(today().slice(0, 4)), season: "Summer" },
      { year: Number(today().slice(0, 4)), season: "Autumn" },
    ],
    lines: [...lines, { ingredientId: "plain", quantity: 1 }],
  });
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  for (const i of s.ingredients)
    run("stock-receive", {
      ingredientId: i.id,
      quantity:
        i.id === "beef"
          ? 10000
          : i.id === "seeded" || i.id === "plain"
            ? 100
            : 3000,
      location: ["beef", "cheese", "lettuce"].includes(i.id)
        ? "fridge"
        : "ambient",
      intake: today(),
      expiry: future,
      dateType: "use-by",
      opened: "",
      frozen: "",
      thawed: "",
      notes: "Illustrative label date; do not use as storage guidance.",
    });
  const details: Enquiry = {
    service: "corporate",
    eventType: "Office lunch",
    attendees: 30,
    date: today(),
    eventTime: "12:30",
    arrivalTime: "12:00",
    requests:
      "20 seeded burgers with onions and 10 plain burgers without onions.",
    dietary:
      "One sesame allergy. Separate handling and ingredient checks required.",
    requirements: [
      {
        reference: "Guest A",
        requirements: "Sesame allergy",
        meal: "",
        reviewed: false,
      },
    ],
    name: "Alex Morgan",
    company: "Northbank Studio · example",
    email: "alex@example.com",
    phone: "020 0000 0000",
    venue: "Northbank Studio",
    address: "London SE1 (sample venue)",
    postcode: "SE1",
    access: "Loading instructions to be confirmed. Lift access required.",
    unknownDetails: "Confirm loading bay permit.",
  };
  run("order", {
    orderId: "sample-delivered",
    details,
    items: [
      { recipeId: "burger-seeded", quantity: 20 },
      { recipeId: "burger-plain", quantity: 10 },
    ],
  });
  run("quote", {
    orderId: "sample-delivered",
    net: 42000,
    notes: "Example quote",
  });
  run("allergy-review", {
    orderId: "sample-delivered",
    requirements: [
      {
        reference: "Guest A",
        requirements: "Sesame allergy",
        meal: "burger-plain",
        reviewed: true,
      },
    ],
  });
  for (const status of [
    "confirmed",
    "ingredients ready",
    "prepared",
    "cooked",
    "packaged",
    "ready for delivery",
    "delivered",
  ])
    run("stage", { orderId: "sample-delivered", status });
  run("waste", {
    orderId: "sample-delivered",
    ingredientId: "",
    recipeId: "burger-seeded",
    batchId: "",
    category: "unserved portions",
    quantity: 2,
    unit: "portions",
    weightGrams: 500,
    reason: "Two attendees were absent; no dislike inferred.",
    date: today(),
  });
  run("finance", {
    type: "income",
    amount: 50400,
    category: "Catering",
    description: "Northbank lunch payment · example",
    date: today(),
    orderId: "sample-delivered",
  });
  run("finance", {
    type: "expense",
    amount: 8000,
    category: "Kitchen hire",
    description: "Kitchen session · example",
    date: today(),
    orderId: "",
  });
  run("feedback", {
    customerId: s.orders[0].customerId,
    orderId: "sample-delivered",
    rating: 5,
    comment:
      "The team loved the lunch. Please include more vegetarian choices next time.",
    date: today(),
  });
  run("order", {
    orderId: "sample-upcoming",
    details: {
      ...details,
      date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      attendees: 60,
      requests: "60 burgers for our next team lunch.",
    },
    items: [
      { recipeId: "burger-seeded", quantity: 50 },
      { recipeId: "burger-plain", quantity: 10 },
    ],
  });
  run("quote", {
    orderId: "sample-upcoming",
    net: 84000,
    notes: "Waiting for attendee confirmation.",
  });
  run("allergy-review", {
    orderId: "sample-upcoming",
    requirements: [
      {
        reference: "Guest A",
        requirements: "Sesame allergy",
        meal: "burger-plain",
        reviewed: true,
      },
    ],
  });
  run("stage", { orderId: "sample-upcoming", status: "confirmed" });
  run("stage", { orderId: "sample-upcoming", status: "ingredients needed" });

  const isoDaysAgo = (days: number) =>
    new Date(Date.now() - days * 86400000).toISOString();
  const dateDaysAgo = (days: number) => isoDaysAgo(days).slice(0, 10);
  const northbankId = s.orders.find((order) => order.id === "sample-delivered")!
    .customerId;
  s.orders.push({
    id: "sample-delivered-prior",
    reference: "EM-SAMPLE-0001",
    customerId: northbankId,
    createdAt: isoDaysAgo(150),
    statusHistory: [
      { status: "enquiry", at: isoDaysAgo(150) },
      { status: "quote", at: isoDaysAgo(148) },
      { status: "confirmed", at: isoDaysAgo(145) },
      { status: "delivered", at: isoDaysAgo(120) },
    ],
    acceptedAt: isoDaysAgo(145),
    details: {
      ...details,
      attendees: 40,
      date: dateDaysAgo(120),
      requests: "Previous office catering event.",
    },
    status: "delivered",
    items: [],
    quotes: [
      {
        version: 1,
        net: 65000,
        vat: 13000,
        vatRate: 20,
        total: 78000,
        notes: "Previous sample booking.",
        at: isoDaysAgo(148),
      },
    ],
    allergyReviewed: true,
    consumed: true,
    reservations: [],
  });
  s.finance.push({
    id: "sample-prior-income",
    type: "income",
    amount: 78000,
    category: "Catering",
    description: "Previous Northbank event · example",
    date: dateDaysAgo(120),
    orderId: "sample-delivered-prior",
  });

  const addSampleProspect = (
    id: string,
    name: string,
    contact: string,
    email: string,
    company: string,
  ) => {
    run("customer", {
      id,
      name: contact,
      company,
      email,
      phone: "020 0000 0000",
      industry: "Unclassified",
      notes: name,
    });
  };
  addSampleProspect(
    "sample-client-walkthrough",
    "Interested in recurring team lunches.",
    "Walkthrough customer",
    "walkthrough@example.com",
    "Walkthrough customer",
  );
  addSampleProspect(
    "sample-client-city",
    "Asked for menus and delivery information.",
    "Sam Taylor",
    "sam@citypantry.example",
    "City Pantry · sample",
  );
  addSampleProspect(
    "sample-client-riverside",
    "Past arts venue client; reconnect about autumn events.",
    "Priya Desai",
    "hello@riversidearts.example",
    "Riverside Arts · sample",
  );

  const sampleOrder = (
    id: string,
    reference: string,
    customerId: string,
    detail: Enquiry,
    createdAt: string,
    status: string,
    quotes: State["orders"][number]["quotes"] = [],
    statusHistory: State["orders"][number]["statusHistory"] = [],
  ) =>
    s.orders.push({
      id,
      reference,
      customerId,
      createdAt,
      statusHistory,
      details: detail,
      status,
      items: [],
      quotes,
      allergyReviewed: false,
      consumed: status === "delivered",
      reservations: [],
    });
  sampleOrder(
    "sample-quote-stalled",
    "EM-SAMPLE-0002",
    "sample-client-walkthrough",
    { ...details, name: "Walkthrough customer", company: "Walkthrough customer", email: "walkthrough@example.com", attendees: 20 },
    isoDaysAgo(12),
    "quote",
    [{ version: 1, net: 30000, vat: 6000, vatRate: 20, total: 36000, notes: "Awaiting a response.", at: isoDaysAgo(10) }],
    [
      { status: "enquiry", at: isoDaysAgo(12) },
      { status: "quote", at: isoDaysAgo(10) },
    ],
  );
  sampleOrder(
    "sample-enquiry-stalled",
    "EM-SAMPLE-0003",
    "sample-client-city",
    { ...details, name: "Sam Taylor", company: "City Pantry · sample", email: "sam@citypantry.example", attendees: 18 },
    isoDaysAgo(8),
    "enquiry",
    [],
    [{ status: "enquiry", at: isoDaysAgo(8) }],
  );
  sampleOrder(
    "sample-riverside-delivered",
    "EM-SAMPLE-0004",
    "sample-client-riverside",
    { ...details, name: "Priya Desai", company: "Riverside Arts · sample", email: "hello@riversidearts.example", attendees: 45, date: dateDaysAgo(120) },
    isoDaysAgo(135),
    "delivered",
    [{ version: 1, net: 37500, vat: 7500, vatRate: 20, total: 45000, notes: "Sample arts event.", at: isoDaysAgo(132) }],
    [
      { status: "enquiry", at: isoDaysAgo(135) },
      { status: "quote", at: isoDaysAgo(132) },
      { status: "confirmed", at: isoDaysAgo(128) },
      { status: "delivered", at: isoDaysAgo(120) },
    ],
  );
  s.finance.push({
    id: "sample-riverside-income",
    type: "income",
    amount: 45000,
    category: "Catering",
    description: "Riverside Arts event · sample",
    date: dateDaysAgo(120),
    orderId: "sample-riverside-delivered",
  });
  run("crm-engagement", {
    customerId: northbankId,
    type: "call",
    direction: "outbound",
    summary: "Spoke with Alex about a potential Christmas event.",
    occurredAt: isoDaysAgo(1),
  });
  for (const [customerId, note, dueDate] of [
    [northbankId, "Send Christmas menu options", new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10)],
    ["sample-client-walkthrough", "Follow up on quote", today()],
    ["sample-client-city", "Send menu and delivery information", today()],
    ["sample-client-riverside", "Reconnect about autumn events", today()],
  ])
    run("crm-follow-up", {
      customerId,
      note,
      dueDate,
      status: "open",
    });
  return s;
}
