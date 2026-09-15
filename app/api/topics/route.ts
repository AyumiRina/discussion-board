import { z } from "zod";

import { getAuthenticatedSupabase, getServerSupabase, routeError, unauthorized } from "@/lib/supabase-server";

const topicSchema = z.object({
  title: z.string().trim().min(1).max(140),
  context: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const client = getServerSupabase(request);
    const page = Number(new URL(request.url).searchParams.get("page") ?? "0");
    const from = Math.max(0, page) * 20;
    const result = await client
      .from("topics")
      .select("id, author_id, title, context, created_at, updated_at, deleted_at")
      .order("created_at", { ascending: false })
      .range(from, from + 19);
    if (result.error) throw result.error;
    return Response.json({ topics: result.data, nextPage: result.data.length === 20 ? page + 1 : null });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await getAuthenticatedSupabase(request);
    if (!user) return unauthorized();
    const payload = topicSchema.parse(await request.json());
    const result = await client
      .from("topics")
      .insert({ author_id: user.id, title: payload.title, context: payload.context?.trim() || null })
      .select("id, author_id, title, context, created_at, updated_at, deleted_at")
      .single();
    if (result.error) throw result.error;
    return Response.json({ topic: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "A title is required and context must be 2,000 characters or fewer." }, { status: 400 });
    return routeError(error);
  }
}
