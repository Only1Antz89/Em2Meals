"use client";
// Sample client Wrapped, for showing clients what their report will look like.
import { WrappedStoryView } from "@/components/wrapped/wrapped-story";
import type { WrappedStory } from "@/lib/wrapped";

const sample: WrappedStory = {
  version: 1,
  business: "Fork Goodness Baked",
  customer: "Northbank Studio",
  from: "2026-06-01",
  to: "2026-08-31",
  periodLabel: "Summer 2026",
  service: "corporate",
  occasions: 4,
  guests: 186,
  portions: 204,
  dishCount: 9,
  topDishes: [
    { name: "Grilled lemon chicken", portions: 68 },
    { name: "Summer garden salad", portions: 54 },
    { name: "Berry Eton mess", portions: 42 },
    { name: "Grilled halloumi skewers", portions: 24 },
    { name: "Tomato & basil soup", portions: 16 },
  ],
  enjoyedRate: 96.6,
  leftoverPortions: 7,
  measuredWasteKg: 9.3,
  wastePerGuestGrams: 50,
  previous: { enjoyedRate: 91.2, wastePerGuestGrams: 64 },
  secondLife: { rehomedPortions: 6, divertedRate: 88 },
  bestEvent: {
    date: "2026-08-14",
    name: "Team summer lunch",
    enjoyedRate: 100,
  },
  months: [
    { month: "2026-06", label: "Jun", portions: 52, enjoyedRate: 92.3 },
    { month: "2026-07", label: "Jul", portions: 98, enjoyedRate: 96.9 },
    { month: "2026-08", label: "Aug", portions: 54, enjoyedRate: 100 },
  ],
  feedback: {
    average: 4.9,
    count: 11,
    quote:
      "The team loved the lunch. Everything felt fresh and generous, and the dietary options were handled brilliantly.",
  },
  persona: {
    title: "The Perfect Portioners",
    line: "Your orders matched appetite remarkably well.",
  },
  tips: [
    "Order around 2 fewer portions of Summer garden salad. It had the most leftovers.",
    "Keep ordering the way you do. Your portions are spot on.",
    "Keep Grilled lemon chicken on the menu. It was your most ordered dish.",
  ],
  coverage: { checked: 4, events: 4 },
  note: "Thank you for a brilliant summer. See you at the Christmas party!",
  generatedAt: "2026-09-17",
};

export default function CustomerReportPreview() {
  return (
    <main>
      <WrappedStoryView story={sample} />
    </main>
  );
}
