import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EMPTY_REACTIONS,
  REACTION_EMOJIS,
  type AvatarKey,
  type PublicProfile,
  type ReactionEmoji,
  type ReactionSummary,
  type Reply,
  type Topic,
} from "@/lib/discussion";

type TopicRow = {
  id: string;
  author_id: string;
  title: string;
  context: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ReplyRow = {
  id: string;
  topic_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ProfileRow = { id: string; display_name: string; avatar_key: string | null };
type ReactionRow = { topic_id: string | null; reply_id: string | null; user_id: string; emoji: string };

function asAvatarKey(value: string | null): AvatarKey | null {
  return value && value.startsWith("placeholder-") ? (value as AvatarKey) : null;
}

function toProfile(row: ProfileRow): PublicProfile {
  return { id: row.id, displayName: row.display_name, avatarKey: asAvatarKey(row.avatar_key) };
}

function summaries(rows: ReactionRow[], targetKey: "topic_id" | "reply_id", currentUserId: string | null): ReactionSummary[] {
  return REACTION_EMOJIS.map((emoji) => {
    const matches = rows.filter((row) => row[targetKey] && row.emoji === emoji);
    return {
      emoji,
      count: matches.length,
      reacted: Boolean(currentUserId && matches.some((row) => row.user_id === currentUserId)),
    };
  });
}

async function fetchReactionRows(client: SupabaseClient, topicIds: string[], replyIds: string[]) {
  const topicPromise = topicIds.length
    ? client.from("reactions").select("topic_id, reply_id, user_id, emoji").in("topic_id", topicIds)
    : Promise.resolve({ data: [], error: null });
  const replyPromise = replyIds.length
    ? client.from("reactions").select("topic_id, reply_id, user_id, emoji").in("reply_id", replyIds)
    : Promise.resolve({ data: [], error: null });
  const [topicResult, replyResult] = await Promise.all([topicPromise, replyPromise]);
  if (topicResult.error) throw topicResult.error;
  if (replyResult.error) throw replyResult.error;
  return {
    topicRows: (topicResult.data ?? []) as ReactionRow[],
    replyRows: (replyResult.data ?? []) as ReactionRow[],
  };
}

export async function ensureAnonymousSession(client: SupabaseClient) {
  const existing = await client.auth.getSession();
  if (existing.data.session) return existing.data.session;
  const result = await client.auth.signInAnonymously();
  if (result.error || !result.data.session) throw result.error ?? new Error("Anonymous session was not created.");
  return result.data.session;
}

export async function loadRemoteBoard(client: SupabaseClient, currentUserId: string | null): Promise<Topic[]> {
  const topicsResult = await client
    .from("topics")
    .select("id, author_id, title, context, created_at, updated_at, deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(0, 19);
  if (topicsResult.error) throw topicsResult.error;

  const topicRows = (topicsResult.data ?? []) as TopicRow[];
  if (!topicRows.length) return [];

  const topicIds = topicRows.map((row) => row.id);
  const repliesResult = await client
    .from("replies")
    .select("id, topic_id, author_id, body, created_at, updated_at, deleted_at")
    .in("topic_id", topicIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (repliesResult.error) throw repliesResult.error;

  const replyRows = (repliesResult.data ?? []) as ReplyRow[];
  const profileIds = Array.from(new Set([...topicRows.map((row) => row.author_id), ...replyRows.map((row) => row.author_id)]));
  const profilesResult = await client.from("profiles").select("id, display_name, avatar_key").in("id", profileIds);
  if (profilesResult.error) throw profilesResult.error;
  const profiles = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.id, toProfile(row)]));
  const { topicRows: topicReactionRows, replyRows: replyReactionRows } = await fetchReactionRows(client, topicIds, replyRows.map((row) => row.id));

  const repliesByTopic = new Map<string, Reply[]>();
  for (const row of replyRows) {
    const author = profiles.get(row.author_id) ?? { id: row.author_id, displayName: "Tactician", avatarKey: null };
    const replies = repliesByTopic.get(row.topic_id) ?? [];
    replies.push({
      id: row.id,
      topicId: row.topic_id,
      body: row.body,
      author,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      reactions: summaries(replyReactionRows.filter((reaction) => reaction.reply_id === row.id), "reply_id", currentUserId),
    });
    repliesByTopic.set(row.topic_id, replies);
  }

  return topicRows.map((row) => {
    const replies = repliesByTopic.get(row.id) ?? [];
    return {
      id: row.id,
      title: row.title,
      context: row.context,
      author: profiles.get(row.author_id) ?? { id: row.author_id, displayName: "Tactician", avatarKey: null },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      replies,
      replyCount: replies.length,
      reactions: summaries(topicReactionRows.filter((reaction) => reaction.topic_id === row.id), "topic_id", currentUserId),
    };
  });
}

export async function saveRemoteProfile(client: SupabaseClient, profile: PublicProfile) {
  const result = await client.from("profiles").upsert({ id: profile.id, display_name: profile.displayName, avatar_key: profile.avatarKey }).select("id, display_name, avatar_key").single();
  if (result.error) throw result.error;
  return toProfile(result.data as ProfileRow);
}

export async function createRemoteTopic(client: SupabaseClient, profile: PublicProfile, title: string, context: string | null) {
  const result = await client.from("topics").insert({ author_id: profile.id, title, context }).select("id, author_id, title, context, created_at, updated_at, deleted_at").single();
  if (result.error) throw result.error;
  return result.data as TopicRow;
}

export async function updateRemoteTopic(client: SupabaseClient, topicId: string, profileId: string, title: string, context: string | null) {
  const result = await client.from("topics").update({ title, context, updated_at: new Date().toISOString() }).eq("id", topicId).eq("author_id", profileId).select("id").single();
  if (result.error) throw result.error;
}

export async function deleteRemoteTopic(client: SupabaseClient, topicId: string, profileId: string) {
  const result = await client.from("topics").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", topicId).eq("author_id", profileId).select("id").single();
  if (result.error) throw result.error;
}

export async function createRemoteReply(client: SupabaseClient, profile: PublicProfile, topicId: string, body: string) {
  const result = await client.from("replies").insert({ topic_id: topicId, author_id: profile.id, body }).select("id").single();
  if (result.error) throw result.error;
}

export async function updateRemoteReply(client: SupabaseClient, replyId: string, profileId: string, body: string) {
  const result = await client.from("replies").update({ body, updated_at: new Date().toISOString() }).eq("id", replyId).eq("author_id", profileId).select("id").single();
  if (result.error) throw result.error;
}

export async function deleteRemoteReply(client: SupabaseClient, replyId: string, profileId: string) {
  const result = await client.from("replies").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", replyId).eq("author_id", profileId).select("id").single();
  if (result.error) throw result.error;
}

export async function toggleRemoteReaction(client: SupabaseClient, profileId: string, targetType: "topic" | "reply", targetId: string, emoji: ReactionEmoji, active: boolean) {
  const target = targetType === "topic" ? { topic_id: targetId, reply_id: null } : { topic_id: null, reply_id: targetId };
  if (active) {
    const result = await client.from("reactions").insert({ user_id: profileId, ...target, emoji });
    if (result.error && result.error.code !== "23505") throw result.error;
    return;
  }
  const query = client.from("reactions").delete().eq("user_id", profileId).eq("emoji", emoji);
  const result = targetType === "topic" ? await query.eq("topic_id", targetId) : await query.eq("reply_id", targetId);
  if (result.error) throw result.error;
}

export function emptyReactions() {
  return EMPTY_REACTIONS.map((reaction) => ({ ...reaction }));
}
