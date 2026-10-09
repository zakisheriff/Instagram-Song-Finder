import { connection } from "next/server";
import { productionDeps } from "@/lib/api/deps";
import { handleTrack } from "@/lib/api/handlers";

export async function GET(request: Request): Promise<Response> {
  // Lookups depend on the incoming request, so this route is never prerendered.
  await connection();
  return handleTrack(request, productionDeps);
}
