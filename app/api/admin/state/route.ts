import {
  requireAccess,
  importEnquiries,
  loadState,
  readEnquiries,
  errorResponse,
  integrationStatus,
} from "@/lib/server";
import { can, visibleState } from "@/lib/access";
export async function GET(req: Request) {
  try {
    const user = await requireAccess("view");
    const mode =
      new URL(req.url).searchParams.get("mode") === "sample"
        ? "sample"
        : "live";
    if (mode === "live") await importEnquiries();
    const { state, revision } = await loadState(mode);
    return Response.json(
      {
        state: visibleState(state, user.role),
        revision,
        enquiries:
          mode === "live" && can(user.role, "orders")
            ? await readEnquiries()
            : [],
        integrations: integrationStatus(),
        access: {
          email: user.email,
          name: user.displayName,
          role: user.role,
          source: user.source,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e, 503);
  }
}
