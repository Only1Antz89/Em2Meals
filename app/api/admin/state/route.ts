import {
  owner,
  loadState,
  readEnquiries,
  errorResponse,
  integrationStatus,
} from "@/lib/server";
export async function GET(req: Request) {
  try {
    if (!(await owner()))
      return errorResponse(Error("Owner access required"), 403);
    const mode =
      new URL(req.url).searchParams.get("mode") === "sample"
        ? "sample"
        : "live";
    return Response.json(
      {
        ...(await loadState(mode)),
        enquiries: mode === "live" ? await readEnquiries() : [],
        integrations: integrationStatus(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e, 503);
  }
}
