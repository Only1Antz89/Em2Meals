import { runDigest } from "@/lib/crm-digest";

export async function POST(req: Request) {
  return runDigest(req);
}
