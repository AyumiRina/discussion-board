"use client";

import { useEffect, useRef } from "react";

type ModelContext = {
  registerTool: (tool: {
    name: string;
    title?: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (input: unknown) => unknown | Promise<unknown>;
    annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  }, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

type BoardToolActions = {
  readBoard: () => unknown;
  createTopic: (title: string, context: string | null) => unknown;
  createReply: (topicId: string, body: string) => unknown;
  toggleReaction: (targetType: "topic" | "reply", targetId: string, emoji: string) => unknown;
};

function getModelContext() {
  if (typeof document === "undefined") return null;
  return (document as Document & { modelContext?: ModelContext }).modelContext ?? null;
}

export function useWebMcpTools(actions: BoardToolActions) {
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    const context = getModelContext();
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    const register = async () => {
      await context.registerTool(
        {
          name: "read_discussion_board",
          title: "Read discussion board",
          description: "Read the currently visible Emblem Hall discussions, reply counts, and reaction totals.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: () => actionsRef.current.readBoard(),
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: "create_discussion_topic",
          title: "Create discussion topic",
          description: "Create a new plain-text Emblem Hall discussion topic. A guest profile must already be configured in the visible board.",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1, maxLength: 140 },
              context: { type: ["string", "null"], maxLength: 2000 },
            },
            required: ["title"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: (input) => {
            const payload = input as { title?: unknown; context?: unknown };
            if (typeof payload.title !== "string" || !payload.title.trim() || payload.title.trim().length > 140) throw new Error("A topic title between 1 and 140 characters is required.");
            if (payload.context !== undefined && payload.context !== null && (typeof payload.context !== "string" || payload.context.length > 2000)) throw new Error("Context must be 2,000 characters or fewer.");
            return actionsRef.current.createTopic(payload.title, typeof payload.context === "string" ? payload.context : null);
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: "reply_to_discussion",
          title: "Reply to discussion",
          description: "Add a plain-text reply to an existing Emblem Hall discussion. A guest profile must already be configured in the visible board.",
          inputSchema: {
            type: "object",
            properties: {
              topicId: { type: "string" },
              body: { type: "string", minLength: 1, maxLength: 2000 },
            },
            required: ["topicId", "body"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: (input) => {
            const payload = input as { topicId?: unknown; body?: unknown };
            if (typeof payload.topicId !== "string" || !payload.topicId) throw new Error("A topicId is required.");
            if (typeof payload.body !== "string" || !payload.body.trim() || payload.body.trim().length > 2000) throw new Error("Reply text between 1 and 2,000 characters is required.");
            return actionsRef.current.createReply(payload.topicId, payload.body);
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: "toggle_discussion_reaction",
          title: "Toggle discussion reaction",
          description: "Toggle one of the board’s curated emoji reactions on a topic or reply. A guest profile must already be configured in the visible board.",
          inputSchema: {
            type: "object",
            properties: {
              targetType: { type: "string", enum: ["topic", "reply"] },
              targetId: { type: "string" },
              emoji: { type: "string", enum: ["❤️", "👍", "🙂", "😂", "🥺", "😔", "😭", "😡", "👎"] },
            },
            required: ["targetType", "targetId", "emoji"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: (input) => {
            const payload = input as { targetType?: unknown; targetId?: unknown; emoji?: unknown };
            if (payload.targetType !== "topic" && payload.targetType !== "reply") throw new Error("targetType must be topic or reply.");
            if (typeof payload.targetId !== "string" || !payload.targetId) throw new Error("A targetId is required.");
            if (typeof payload.emoji !== "string" || !["❤️", "👍", "🙂", "😂", "🥺", "😔", "😭", "😡", "👎"].includes(payload.emoji)) throw new Error("That reaction is not available.");
            return actionsRef.current.toggleReaction(payload.targetType, payload.targetId, payload.emoji);
          },
        },
        { signal: lifecycle.signal },
      );
    };

    void register().catch(() => {
      // WebMCP is progressive enhancement; the visible board remains fully usable without it.
    });

    return () => lifecycle.abort();
  }, []);
}
