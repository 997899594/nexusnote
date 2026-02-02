import { clientEnv } from "@nexusnote/config";

const API_URL = clientEnv.NEXT_PUBLIC_API_URL;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json(
        { error: "userId is required", topics: [] },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${API_URL}/notes/topics?userId=${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[Notes API] Get topics failed:", error);
      return Response.json(
        { error: "Failed to fetch topics", topics: [] },
        { status: response.status },
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (err) {
    console.error("[Notes API] Get topics error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message, topics: [] }, { status: 500 });
  }
}
