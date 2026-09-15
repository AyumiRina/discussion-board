import { z } from "zod";

import { getAuthenticatedSupabase, getServerSupabase, routeError, unauthorized } from "@/lib/supabase-server";

const replySchema = z.object({ body: z.string().trim().min(1).max(2000) });
type RouteContext = { params: Promise<{ topicId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { topicId } = await context.params;
    const client = getServerSupabase(request);
    const page = Number(new URL(request.url).searchParams.get("page") ?? "0");
    const from = Math.max(0, page) * 50;
    const result = await client
      .from("replies")
      .select("id, topic_id, author_id, body, created_at, updated_at, deleted_at")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true })
      .range(from, from + 49);
    if (result.error) throw result.error;
    return Response.json({ replies: result.data, nextPage: result.data.length === 50 ? page + 1 : null });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { topicId } = await context.params;
    const { client, user } = await getAuthenticatedSupabase(request);
    if (!user) return unauthorized();
    const payload = replySchema.parse(await request.json());
    const result = await client
      .from("replies")
      .insert({ topic_id: topicId, author_id: user.id, body: payload.body })
      .select("id, topic_id, author_id, body, created_at, updated_at, deleted_at")
      .single();
    if (result.error) throw result.error;
    return Response.json({ reply: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Reply text is required and must be 2,000 characters or fewer." }, { status: 400 });
    return routeError(error);
  }
}
