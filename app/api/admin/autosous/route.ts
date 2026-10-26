import { owner, loadState, errorResponse } from "@/lib/server";
import { workspaceAlerts, type AutoSousAlert } from "@/lib/autosous-alerts";
import { alertMatches, foodSafetyFeed } from "@/lib/food-safety";
import { kitchenBriefing } from "@/lib/autosous-briefing";

// Everything the AutoSous avatar shows: workspace alerts plus food safety
// alerts from the Food Standards Agency (warnings when they name an
// ingredient you stock, otherwise a weekly news digest).
export async function GET(req: Request) {
  try {
    if (!(await owner()))
      return errorResponse(Error("Owner access required"), 403);
    const mode =
      new URL(req.url).searchParams.get("mode") === "sample" ? "sample" : "live";
    const { state } = await loadState(mode);
    const alerts = workspaceAlerts(state);
    let feed: Awaited<ReturnType<typeof foodSafetyFeed>> = {
      items: [],
      checkedAt: new Date().toISOString(),
    };
    try {
      feed = await foodSafetyFeed();
    } catch (error) {
      console.error("Food safety feed failed", error);
      feed.error = "Food safety alerts are unavailable right now.";
    }
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const news = feed.items.filter((item) => !item.published || item.published >= weekAgo);
    const warnings: AutoSousAlert[] = feed.items
      .filter((item) => !item.published || item.published >= monthAgo)
      .flatMap((item) => {
        const matches = alertMatches(state, item);
        if (!matches.length) return [];
        return [
          {
            id: `fsa-${item.id}`,
            kind: "food-safety" as const,
            severity: "warning" as const,
            title: `Food safety alert may affect ${matches.map((m) => m.name).slice(0, 3).join(", ")}`,
            detail: item.title,
            path: "inventory/storage-expiry",
            ask: `An FSA ${item.kind === "allergy" ? "allergy alert" : "food alert"} says: "${item.title}". Which of my stock batches and orders could be affected? If any match, help me record a recall.`,
          },
        ];
      });
    const all = [...alerts.filter((a) => a.severity === "urgent"), ...warnings, ...alerts.filter((a) => a.severity !== "urgent")];
    return Response.json(
      {
        alerts: all,
        briefing: kitchenBriefing(state, all),
        foodSafety: { news, checkedAt: feed.checkedAt, error: feed.error },
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e, 503);
  }
}
