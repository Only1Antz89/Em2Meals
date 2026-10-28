import {
  requireAccess,
  loadState,
  readEnquiries,
  errorResponse,
} from "@/lib/server";

// Owner-only full backup of a workspace (and, for live, the original website
// submissions) as a downloadable JSON file.
export async function GET(req: Request) {
  try {
    await requireAccess("data");
    const mode =
      new URL(req.url).searchParams.get("mode") === "sample" ? "sample" : "live";
    const { state, revision } = await loadState(mode);
    const exportedAt = new Date().toISOString();
    const body = JSON.stringify(
      {
        format: "fork-goodness-workspace-backup",
        version: 1,
        mode,
        revision,
        exportedAt,
        state,
        enquiries: mode === "live" ? await readEnquiries() : [],
      },
      null,
      2,
    );
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="fork-goodness-${mode}-backup-${exportedAt.slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e, 503);
  }
}
