import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseSearchParamsAs } from "@/lib/api";
import { getPublicCourseCatalog } from "@/lib/learning/public-course-catalog";

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const { limit, offset } = parseSearchParamsAs(request, ListQuerySchema);
  return Response.json({ items: await getPublicCourseCatalog(limit, offset) });
}
