import { productionDeps } from "@/lib/api/deps";
import { handleSearch } from "@/lib/api/handlers";

export function GET(request: Request): Promise<Response> {
  return handleSearch(request, productionDeps);
}
