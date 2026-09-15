import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export function getServerSupabase(request: Request): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");

  const authorization = request.headers.get("authorization");
  return createClient(url, key, {
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function getAuthenticatedSupabase(request: Request) {
  const client = getServerSupabase(request);
  const result = await client.auth.getUser();
  if (result.error || !result.data.user) {
    return { client, user: null as User | null };
  }
  return { client, user: result.data.user };
}

export function routeError(error: unknown) {
  if (error instanceof Error && error.message === "Supabase is not configured.") {
    return Response.json({ error: "The shared board is not configured yet." }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return Response.json({ error: message }, { status: 500 });
}

export function unauthorized() {
  return Response.json({ error: "A guest session is required for this action." }, { status: 401 });
}
