import { productionDeps } from "@/lib/api/deps";
import { handleTrack } from "@/lib/api/handlers";

export function GET(request: Request): Promise<Response> {
  return handleTrack(request, productionDeps);
}
