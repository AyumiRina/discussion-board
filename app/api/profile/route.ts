import { z } from "zod";

import { AVATAR_OPTIONS } from "@/lib/discussion";
import { getAuthenticatedSupabase, routeError, unauthorized } from "@/lib/supabase-server";

const avatarKeys = AVATAR_OPTIONS.map((option) => option.key) as [string, ...string[]];
const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(32),
  avatarKey: z.enum(avatarKeys).nullable().optional(),
});

export async function POST(request: Request) {
  return saveProfile(request);
}

export async function PATCH(request: Request) {
  return saveProfile(request);
}

async function saveProfile(request: Request) {
  try {
    const { client, user } = await getAuthenticatedSupabase(request);
    if (!user) return unauthorized();
    const payload = profileSchema.parse(await request.json());
    const result = await client
      .from("profiles")
      .upsert({ id: user.id, display_name: payload.displayName, avatar_key: payload.avatarKey ?? null })
      .select("id, display_name, avatar_key, created_at, updated_at")
      .single();
    if (result.error) throw result.error;
    return Response.json({
      profile: {
        id: result.data.id,
        displayName: result.data.display_name,
        avatarKey: result.data.avatar_key,
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Please provide a valid display name and avatar." }, { status: 400 });
    return routeError(error);
  }
}
