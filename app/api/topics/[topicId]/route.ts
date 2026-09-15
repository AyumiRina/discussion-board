import { z } from "zod";

import { getAuthenticatedSupabase, routeError, unauthorized } from "@/lib/supabase-server";

const topicUpdateSchema = z.object({
  title: z.string().trim().min(1).max(140),
  context: z.string().trim().max(2000).nullable().optional(),
});

type RouteContext = { params: Promise<{ topicId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { topicId } = await context.params;
    const { client, user } = await getAuthenticatedSupabase(request);
    if (!user) return unauthorized();
    const payload = topicUpdateSchema.parse(await request.json());
    const result = await client
      .from("topics")
      .update({ title: payload.title, context: payload.context?.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", topicId)
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .select("id, author_id, title, context, created_at, updated_at, deleted_at")
      .single();
    if (result.error) throw result.error;
    return Response.json({ topic: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "A title is required and context must be 2,000 characters or fewer." }, { status: 400 });
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { topicId } = await context.params;
    const { client, user } = await getAuthenticatedSupabase(request);
    if (!user) return unauthorized();
    const result = await client
      .from("topics")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", topicId)
      .eq("author_id", user.id)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .single();
    if (result.error) throw result.error;
    return Response.json({ topic: result.data });
  } catch (error) {
    return routeError(error);
  }
}
