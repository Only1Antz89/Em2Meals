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
  run("supplier", {
    id: "supplier-1",
    name: "Borough Produce · example",
    email: "produce@example.com",
    phone: "020 0000 0000",
    deliveryCharge: 800,
    minimumOrder: 5000,
    leadDays: 1,
    notes: "Sample supplier. Rates are illustrative.",
  });
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
  return s;
}
