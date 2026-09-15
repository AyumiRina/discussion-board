import { z } from "zod";

import { REACTION_EMOJIS } from "@/lib/discussion";
import { getAuthenticatedSupabase, routeError, unauthorized } from "@/lib/supabase-server";

const reactionSchema = z.object({
  targetType: z.enum(["topic", "reply"]),
  targetId: z.string().uuid(),
  emoji: z.enum(REACTION_EMOJIS),
});

export async function PUT(request: Request) {
  try {
    const { client, user } = await getAuthenticatedSupabase(request);
    if (!user) return unauthorized();
    const payload = reactionSchema.parse(await request.json());
    const target = payload.targetType === "topic" ? { topic_id: payload.targetId, reply_id: null } : { topic_id: null, reply_id: payload.targetId };
    const result = await client.from("reactions").upsert({ user_id: user.id, ...target, emoji: payload.emoji }, { onConflict: payload.targetType === "topic" ? "topic_id,user_id,emoji" : "reply_id,user_id,emoji", ignoreDuplicates: true }).select("id").maybeSingle();
    if (result.error) throw result.error;
    return Response.json({ active: true, reaction: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "That reaction is not available." }, { status: 400 });
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { client, user } = await getAuthenticatedSupabase(request);
    if (!user) return unauthorized();
    const payload = reactionSchema.parse(await request.json());
    const column = payload.targetType === "topic" ? "topic_id" : "reply_id";
    const result = await client.from("reactions").delete().eq("user_id", user.id).eq(column, payload.targetId).eq("emoji", payload.emoji);
    if (result.error) throw result.error;
    return Response.json({ active: false });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "That reaction is not available." }, { status: 400 });
    return routeError(error);
  }
}
