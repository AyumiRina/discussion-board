import { z } from "zod";

import { getAuthenticatedSupabase, routeError, unauthorized } from "@/lib/supabase-server";

const replySchema = z.object({ body: z.string().trim().min(1).max(2000) });
type RouteContext = { params: Promise<{ replyId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { replyId } = await context.params;
    const { client, user } = await getAuthenticatedSupabase(request);
    if (!user) return unauthorized();
    const payload = replySchema.parse(await request.json());
    const result = await client
      .from("replies")
      .update({ body: payload.body, updated_at: new Date().toISOString() })
      .eq("id", replyId)
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .select("id, topic_id, author_id, body, created_at, updated_at, deleted_at")
      .single();
    if (result.error) throw result.error;
    return Response.json({ reply: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Reply text is required and must be 2,000 characters or fewer." }, { status: 400 });
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { replyId } = await context.params;
    const { client, user } = await getAuthenticatedSupabase(request);
    if (!user) return unauthorized();
    const result = await client
      .from("replies")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", replyId)
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .single();
    if (result.error) throw result.error;
    return Response.json({ reply: result.data });
  } catch (error) {
    return routeError(error);
  }
}
