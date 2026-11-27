import { nexboardGet, okJson } from "@/lib/nexboardApi";

export const dynamic = "force-dynamic";

/** Health check for MYHitch NexBoard: answers only with the right key, so NexBoard can tell a wrong key from a down Lens. */
export async function GET(request: Request) {
  return nexboardGet(request, "ping", async () => okJson("ping_v1", { ok: true }, { platform: "lens" }));
}
