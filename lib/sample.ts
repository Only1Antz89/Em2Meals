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
    ["beef", "Beef mince (20% fat)", "g", 1000, 1697, 1, "", 3000, "meat", "supplier-2"],
    ["plain", "Burger buns (plain)", "each", 12, 540, 1, "Wheat, milk, egg", 24, "bakery", "supplier-4"],
    ["seeded", "Burger buns (seeded)", "each", 12, 600, 1, "Wheat, milk, egg, sesame", 24, "bakery", "supplier-4"],
    ["lettuce", "Lettuce (cos)", "g", 1000, 280, 0.85, "", 500, "vegetables", "supplier-1"],
    ["ketchup", "Tomato ketchup", "ml", 1000, 350, 1, "", 200, "condiments", "supplier-1"],
    ["cheese", "Cheddar cheese", "g", 1000, 780, 1, "Milk", 400, "dairy", "supplier-2"],
    ["onion", "Onions (red)", "g", 1000, 180, 0.88, "", 500, "vegetables", "supplier-1"],
    ["tomato", "Tomatoes", "g", 1000, 400, 0.95, "", 500, "vegetables", "supplier-3"],
    ["chicken", "Chicken breast", "g", 1000, 1050, 1, "", 2500, "poultry", "supplier-2"],
    ["lemon", "Lemons", "g", 1000, 320, 0.7, "", 300, "fruit", "supplier-3"],
    ["olive-oil", "Extra virgin olive oil", "ml", 1000, 900, 1, "", 250, "oils & fats", "supplier-1"],
    ["garlic", "Garlic", "g", 1000, 600, 0.9, "", 100, "vegetables", "supplier-3"],
    ["mixed-leaves", "Mixed salad leaves", "g", 500, 550, 0.95, "", 250, "vegetables", "supplier-3"],
    ["cucumber", "Cucumber", "g", 1000, 240, 0.9, "", 300, "vegetables", "supplier-3"],
    ["veg-stock", "Vegetable stock", "ml", 1000, 210, 1, "Celery", 500, "liquids", "supplier-1"],
    ["basil", "Fresh basil", "g", 100, 180, 0.9, "", 40, "herbs", "supplier-3"],
    ["sour-cream", "Sour cream", "g", 500, 260, 1, "Milk", 200, "dairy", "supplier-2"],
    ["halloumi", "Halloumi", "g", 1000, 1180, 1, "Milk", 500, "dairy", "supplier-2"],
    ["pepper", "Mixed peppers", "g", 1000, 450, 0.88, "", 500, "vegetables", "supplier-3"],
    ["courgette", "Courgette", "g", 1000, 300, 0.92, "", 400, "vegetables", "supplier-3"],
    ["berries", "Summer berries", "g", 1000, 980, 0.95, "", 500, "fruit", "supplier-3"],
    ["meringue", "Meringue nests", "g", 500, 620, 1, "Egg", 200, "bakery", "supplier-4"],
    ["cream", "Double cream", "ml", 1000, 620, 1, "Milk", 400, "dairy", "supplier-2"],
    ["vanilla", "Vanilla extract", "ml", 100, 450, 1, "", 25, "spices", "supplier-1"],
  ] as const;
  for (const [id, name, unit, packQuantity, packCost, yieldValue, allergens, threshold, category, supplierId] of ingredients)
    run("ingredient", { id, name, unit, packQuantity, packCost, yield: yieldValue, allergens, supplierId, threshold, category });
  const lines = [
    { ingredientId: "beef", quantity: 120 },
    { ingredientId: "lettuce", quantity: 10 },
    { ingredientId: "tomato", quantity: 20 },
    { ingredientId: "cheese", quantity: 20 },
  ];
  run("recipe", {
    id: "burger-seeded",
    name: "House beef burger",
    variant: "Seeded bun · with onion",
    imageUrl: "/images/recipes/dishes/house-beef-burger.png",
    createdAt: today(),
    status: "active",
    instructions: "1. Shape the beef mince into even patties and season with salt and pepper.\n2. Cook on a hot griddle for 3–4 minutes each side until cooked to your liking.\n3. Toast the seeded buns, assemble with lettuce, tomato, onion and cheese.\n4. Serve immediately with your choice of sides.",
    collections: [{ year: Number(today().slice(0, 4)), season: "Summer" }],
    lines: [
      ...lines,
      { ingredientId: "seeded", quantity: 1 },
      { ingredientId: "onion", quantity: 20 },
    ],
  });
  run("recipe", {
    id: "burger-plain",
    name: "House beef burger",
    variant: "Plain bun · no onion",
    imageUrl: "/images/recipes/dishes/house-beef-burger.png",
    createdAt: today(),
    status: "active",
    instructions: "1. Shape and season the patties.\n2. Griddle until cooked through.\n3. Toast the plain buns and assemble without onion.",
    collections: [
      { year: Number(today().slice(0, 4)), season: "Summer" },
      { year: Number(today().slice(0, 4)), season: "Autumn" },
    ],
    lines: [...lines, { ingredientId: "plain", quantity: 1 }],
  });
  for (const recipe of [
    {
      id: "grilled-lemon-chicken", name: "Grilled lemon chicken", variant: "Herb marinade", imageUrl: "/images/recipes/dishes/grilled-lemon-chicken.png",
      lines: [{ ingredientId: "chicken", quantity: 180 }, { ingredientId: "lemon", quantity: 35 }, { ingredientId: "olive-oil", quantity: 12 }, { ingredientId: "garlic", quantity: 5 }, { ingredientId: "basil", quantity: 4 }],
      instructions: "1. Whisk the lemon, olive oil, garlic and herbs.\n2. Marinate the chicken under refrigeration.\n3. Grill until cooked through, rest, then slice.",
    },
    {
      id: "summer-garden-salad", name: "Summer garden salad", variant: "Mixed leaves · house dressing", imageUrl: "/images/recipes/dishes/summer-garden-salad.png",
      lines: [{ ingredientId: "mixed-leaves", quantity: 70 }, { ingredientId: "tomato", quantity: 60 }, { ingredientId: "cucumber", quantity: 50 }, { ingredientId: "onion", quantity: 15 }, { ingredientId: "olive-oil", quantity: 12 }],
      instructions: "1. Wash and dry the leaves.\n2. Slice the vegetables finely.\n3. Dress immediately before serving.",
    },
    {
      id: "tomato-basil-soup", name: "Tomato & basil soup", variant: "With sour cream", imageUrl: "/images/recipes/dishes/tomato-basil-soup.png",
      lines: [{ ingredientId: "tomato", quantity: 250 }, { ingredientId: "onion", quantity: 35 }, { ingredientId: "veg-stock", quantity: 180 }, { ingredientId: "basil", quantity: 5 }, { ingredientId: "sour-cream", quantity: 20 }],
      instructions: "1. Sweat the onion until soft.\n2. Add tomatoes and stock, then simmer.\n3. Blend with basil and finish with sour cream.",
    },
    {
      id: "grilled-halloumi-skewers", name: "Grilled halloumi skewers", variant: "With herbs", imageUrl: "/images/recipes/dishes/grilled-halloumi-skewers.png",
      lines: [{ ingredientId: "halloumi", quantity: 120 }, { ingredientId: "pepper", quantity: 70 }, { ingredientId: "courgette", quantity: 60 }, { ingredientId: "onion", quantity: 30 }, { ingredientId: "olive-oil", quantity: 10 }],
      instructions: "1. Cut the halloumi and vegetables evenly.\n2. Thread onto skewers and brush with oil.\n3. Grill until golden and finish with herbs.",
    },
    {
      id: "berry-eton-mess", name: "Berry Eton mess", variant: "Fresh berries · vanilla cream", imageUrl: "/images/recipes/dishes/berry-eton-mess.png",
      lines: [{ ingredientId: "berries", quantity: 100 }, { ingredientId: "meringue", quantity: 45 }, { ingredientId: "cream", quantity: 90 }, { ingredientId: "vanilla", quantity: 2 }],
      instructions: "1. Whip the cream softly with vanilla.\n2. Fold through crushed meringue and half the berries.\n3. Layer into glasses and finish with the remaining fruit.",
    },
  ]) run("recipe", { ...recipe, createdAt: today(), status: "active", collections: [{ year: Number(today().slice(0, 4)), season: "Summer" }] });
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
  s.purchases.push(
    ...s.ingredients.map((ingredient, index) => ({
      id: `sample-purchase-${ingredient.id}`,
      supplierId: ingredient.supplierId,
      ingredientId: ingredient.id,
      quantity: ingredient.packQuantity,
      receivedQuantity: ingredient.packQuantity,
      cost: ingredient.packCost,
      eta: today(),
      status: "received",
      notes: "Illustrative confirmed purchase history.",
      at: new Date(Date.now() - (index + 1) * 86400000).toISOString(),
    })),
  );
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
