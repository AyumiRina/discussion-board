"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Feather,
  Flame,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Plus,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  AVATAR_OPTIONS,
  DEMO_TOPICS,
  EMPTY_REACTIONS,
  REACTION_EMOJIS,
  type AvatarKey,
  type PublicProfile,
  type ReactionEmoji,
  type ReactionSummary,
  type Reply,
  type Topic,
  formatCount,
  formatExactTime,
  formatRelativeTime,
  getAvatarOption,
  getDayLabel,
  getInitials,
} from "@/lib/discussion";
import { hasSupabaseConfig, getSupabaseBrowserClient } from "@/lib/supabase";
import {
  createRemoteReply,
  createRemoteTopic,
  deleteRemoteReply,
  deleteRemoteTopic,
  ensureAnonymousSession,
  loadRemoteBoard,
  saveRemoteProfile,
  toggleRemoteReaction,
  updateRemoteReply,
  updateRemoteTopic,
} from "@/lib/remote-discussion";
import { useWebMcpTools } from "@/components/webmcp-tools";

type PendingAction =
  | { kind: "topic" }
  | { kind: "reply"; topicId: string }
  | { kind: "reaction"; targetType: "topic" | "reply"; targetId: string; emoji: ReactionEmoji };

type DeleteTarget = { kind: "topic" | "reply"; id: string } | null;
type EditingTarget = { kind: "topic" | "reply"; id: string } | null;

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildReactions(values: ReactionSummary[], emoji: ReactionEmoji, active: boolean) {
  return values.map((reaction) =>
    reaction.emoji === emoji
      ? {
          ...reaction,
          reacted: active,
          count: Math.max(0, reaction.count + (active ? 1 : -1)),
        }
      : reaction,
  );
}

function updateReactionState(topics: Topic[], targetType: "topic" | "reply", targetId: string, emoji: ReactionEmoji, active: boolean) {
  return topics.map((topic) => {
    if (targetType === "topic" && topic.id === targetId) {
      return { ...topic, reactions: buildReactions(topic.reactions, emoji, active) };
    }
    if (targetType === "reply" && topic.replies.some((reply) => reply.id === targetId)) {
      return {
        ...topic,
        replies: topic.replies.map((reply) => reply.id === targetId ? { ...reply, reactions: buildReactions(reply.reactions, emoji, active) } : reply),
      };
    }
    return topic;
  });
}

function AvatarMark({ profile, size = "default" }: { profile: PublicProfile; size?: "sm" | "default" | "lg" }) {
  const option = getAvatarOption(profile.avatarKey);
  return (
    <Avatar size={size} className={option?.className ?? "avatar-initials"}>
      <AvatarFallback>{option?.symbol ?? getInitials(profile.displayName)}</AvatarFallback>
    </Avatar>
  );
}

function Timestamp({ timestamp, className = "" }: { timestamp: string; className?: string }) {
  return (
    <time className={className} dateTime={timestamp} title={formatExactTime(timestamp)} aria-label={`Posted ${formatExactTime(timestamp)}`}>
      {formatRelativeTime(timestamp)}
    </time>
  );
}

function ReactionBar({
  reactions,
  onToggle,
  disabled = false,
}: {
  reactions: ReactionSummary[];
  onToggle: (emoji: ReactionEmoji) => void;
  disabled?: boolean;
}) {
  return (
    <div className="reaction-bar" aria-label="Reactions">
      {REACTION_EMOJIS.map((emoji) => {
        const reaction = reactions.find((item) => item.emoji === emoji) ?? {
          emoji,
          count: 0,
          reacted: false,
        };
        return (
          <button
            key={emoji}
            type="button"
            className={`reaction-chip ${reaction.reacted ? "is-reacted" : ""}`}
            aria-label={`${reaction.reacted ? "Remove" : "Add"} ${emoji} reaction${reaction.count ? `, ${reaction.count} total` : ""}`}
            aria-pressed={reaction.reacted}
            disabled={disabled}
            title={`${reaction.reacted ? "Remove" : "React with"} ${emoji}`}
            onClick={() => onToggle(emoji)}
          >
            <span aria-hidden="true">{emoji}</span>
            {reaction.count > 0 ? <span>{formatCount(reaction.count)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function ProfileDialog({
  open,
  onOpenChange,
  existingProfile,
  onSave,
  pendingAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProfile: PublicProfile | null;
  onSave: (profile: PublicProfile) => void;
  pendingAction: PendingAction | null;
}) {
  const [displayName, setDisplayName] = useState(existingProfile?.displayName ?? "");
  const [avatarKey, setAvatarKey] = useState<AvatarKey | null>(existingProfile?.avatarKey ?? null);

  const profileId = existingProfile?.id ?? "guest-local";

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDisplayName(existingProfile?.displayName ?? "");
      setAvatarKey(existingProfile?.avatarKey ?? null);
    }
    onOpenChange(nextOpen);
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length > 32) return;
    onSave({ id: profileId, displayName: trimmedName, avatarKey });
  }

  const actionLabel = pendingAction?.kind === "topic" ? "start your discussion" : pendingAction?.kind === "reply" ? "join the conversation" : pendingAction?.kind === "reaction" ? "add your reaction" : "customize your profile";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="profile-dialog">
        <DialogHeader>
          <div className="dialog-crest" aria-hidden="true">
            <Feather size={18} />
          </div>
          <DialogTitle>{existingProfile ? "Your camp profile" : "Choose your camp profile"}</DialogTitle>
          <DialogDescription>
            Set a name and optional crest before you {actionLabel}. Your profile stays in this browser.
          </DialogDescription>
        </DialogHeader>

        <form className="profile-form" onSubmit={handleSave}>
          <label className="field-label" htmlFor="display-name">
            Display name
            <span className="field-hint">{displayName.trim().length}/32</span>
          </label>
          <input
            id="display-name"
            className="text-input"
            value={displayName}
            maxLength={32}
            autoComplete="nickname"
            placeholder="e.g. Morgan of Ylisse"
            onChange={(event) => setDisplayName(event.target.value)}
            autoFocus
          />

          <div className="field-label">
            Choose a crest <span className="field-hint">optional</span>
          </div>
          <div className="avatar-picker" role="radiogroup" aria-label="Choose a profile crest">
            <button
              type="button"
              className={`avatar-choice avatar-choice-none ${avatarKey === null ? "is-selected" : ""}`}
              role="radio"
              aria-checked={avatarKey === null}
              onClick={() => setAvatarKey(null)}
            >
              <span aria-hidden="true">{getInitials(displayName || "You")}</span>
              <span>Initials</span>
            </button>
            {AVATAR_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`avatar-choice ${option.className} ${avatarKey === option.key ? "is-selected" : ""}`}
                role="radio"
                aria-checked={avatarKey === option.key}
                aria-label={option.label}
                onClick={() => setAvatarKey(option.key)}
              >
                <span aria-hidden="true">{option.symbol}</span>
                <span>{option.label.replace(" crest", "")}</span>
              </button>
            ))}
          </div>

          <p className="profile-note">
            <Shield size={14} aria-hidden="true" />
            Guest mode is light and private: clearing this browser removes access to this profile.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!displayName.trim()}>
              <Check size={16} />
              Save profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Composer({
  title,
  context,
  onTitleChange,
  onContextChange,
  onSubmit,
  onCancel,
  submitting = false,
}: {
  title: string;
  context: string;
  onTitleChange: (value: string) => void;
  onContextChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  return (
    <form className="topic-composer" onSubmit={onSubmit}>
      <div className="composer-heading">
        <div>
          <p className="eyebrow">New discussion</p>
          <h2>Open a fresh thread</h2>
        </div>
        <span className="composer-seal" aria-hidden="true">
          <Sparkles size={17} />
        </span>
      </div>
      <label className="field-label" htmlFor="topic-title">
        Topic <span className="field-hint">required</span>
      </label>
      <input
        id="topic-title"
        className="text-input"
        value={title}
        maxLength={140}
        placeholder="What would you like to ask the camp?"
        onChange={(event) => onTitleChange(event.target.value)}
        autoFocus
      />
      <div className="composer-count">{title.length}/140</div>
      <label className="field-label" htmlFor="topic-context">
        Context <span className="field-hint">optional</span>
      </label>
      <Textarea
        id="topic-context"
        className="text-area"
        value={context}
        maxLength={2000}
        placeholder="Add a little context so others know where to begin…"
        onChange={(event) => onContextChange(event.target.value)}
      />
      <div className="composer-bottomline">
        <span>Plain text · 2,000 character limit</span>
        <span>{context.length}/2000</span>
      </div>
      <div className="composer-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim() || submitting}>
          <Send size={15} />
          {submitting ? "Posting…" : "Post discussion"}
        </Button>
      </div>
    </form>
  );
}

function ReplyEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <form className="reply-editor" onSubmit={onSubmit}>
      <Textarea
        value={value}
        maxLength={2000}
        className="reply-textarea"
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        autoFocus={autoFocus}
      />
      <div className="reply-editor-footer">
        <span>{value.length}/2000</span>
        <div className="reply-editor-actions">
          {onCancel ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={!value.trim()}>
            <Send size={14} />
            Reply
          </Button>
        </div>
      </div>
    </form>
  );
}

function ReplyItem({
  reply,
  currentProfile,
  editing,
  editDraft,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  onRequestDelete,
  onToggleReaction,
}: {
  reply: Reply;
  currentProfile: PublicProfile | null;
  editing: boolean;
  editDraft: string;
  onEditDraftChange: (value: string) => void;
  onSaveEdit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  onRequestDelete: () => void;
  onToggleReaction: (emoji: ReactionEmoji) => void;
}) {
  const isOwner = currentProfile?.id === reply.author.id;

  if (reply.deletedAt) {
    return (
      <div className="reply-item reply-deleted">
        <div className="deleted-mark">—</div>
        <p>This reply was removed by its author.</p>
      </div>
    );
  }

  return (
    <div className="reply-item">
      <AvatarMark profile={reply.author} size="sm" />
      <div className="reply-body">
        <div className="reply-meta">
          <span className="reply-author">{reply.author.displayName}</span>
          <Timestamp timestamp={reply.createdAt} className="timestamp" />
          {reply.updatedAt !== reply.createdAt ? <span className="edited-label">edited</span> : null}
          {isOwner ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="icon-button tiny" aria-label="Reply actions">
                  <MoreHorizontal size={15} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="menu-surface">
                <DropdownMenuItem onSelect={() => onEditDraftChange(reply.body)}>
                  <PenLine size={14} /> Edit reply
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
                  <Trash2 size={14} /> Delete reply
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {editing ? (
          <ReplyEditor
            value={editDraft}
            onChange={onEditDraftChange}
            onSubmit={onSaveEdit}
            onCancel={onCancelEdit}
            placeholder="Update your reply…"
            autoFocus
          />
        ) : (
          <p className="reply-copy">{reply.body}</p>
        )}
        {!editing ? <ReactionBar reactions={reply.reactions} onToggle={onToggleReaction} /> : null}
      </div>
    </div>
  );
}

function TopicCard({
  topic,
  currentProfile,
  expanded,
  onToggleExpanded,
  onToggleReaction,
  onSubmitReply,
  replyDraft,
  onReplyDraftChange,
  editing,
  editDraft,
  editContextDraft,
  editingReplyId,
  onEditDraftChange,
  onEditContextDraftChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onRequestDelete,
  onReplyEdit,
  onReplyDelete,
  onReplyReaction,
}: {
  topic: Topic;
  currentProfile: PublicProfile | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleReaction: (emoji: ReactionEmoji) => void;
  onSubmitReply: (event: FormEvent<HTMLFormElement>) => void;
  replyDraft: string;
  onReplyDraftChange: (value: string) => void;
  editing: boolean;
  editDraft: string;
  editContextDraft: string;
  editingReplyId: string | null;
  onEditDraftChange: (value: string) => void;
  onEditContextDraftChange: (value: string) => void;
  onSaveEdit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onRequestDelete: () => void;
  onReplyEdit: (replyId: string, value: string) => void;
  onReplyDelete: (replyId: string) => void;
  onReplyReaction: (replyId: string, emoji: ReactionEmoji) => void;
}) {
  const isOwner = currentProfile?.id === topic.author.id;
  const [visibleReplyCount, setVisibleReplyCount] = useState(20);
  const visibleReplies = topic.replies.slice(0, visibleReplyCount);

  return (
    <article className={`topic-card ${topic.deletedAt ? "is-deleted" : ""}`} id={topic.id}>
      <div className="topic-card-header">
        <div className="author-line">
          <AvatarMark profile={topic.author} size="default" />
          <div>
            <div className="author-name-line">
              <span className="author-name">{topic.author.displayName}</span>
              <span className="author-role">opened a discussion</span>
            </div>
            <div className="topic-time-row">
              <Clock3 size={12} aria-hidden="true" />
              <Timestamp timestamp={topic.createdAt} className="timestamp" />
              {topic.updatedAt !== topic.createdAt ? <span className="edited-label">edited</span> : null}
            </div>
          </div>
        </div>
        {isOwner && !topic.deletedAt ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="icon-button" aria-label="Discussion actions">
                <MoreHorizontal size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="menu-surface">
              <DropdownMenuItem onSelect={onStartEdit}>
                <PenLine size={14} /> Edit discussion
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
                <Trash2 size={14} /> Delete discussion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {topic.deletedAt ? (
        <div className="topic-tombstone">
          <div className="tombstone-icon" aria-hidden="true">
            —
          </div>
          <div>
            <h2>Discussion removed by author</h2>
            <p>The conversation is no longer accepting replies or reactions.</p>
          </div>
        </div>
      ) : editing ? (
        <form className="topic-edit-form" onSubmit={onSaveEdit}>
          <label className="field-label" htmlFor={`edit-title-${topic.id}`}>
            Topic
          </label>
          <input
            id={`edit-title-${topic.id}`}
            className="text-input"
            value={editDraft}
            maxLength={140}
            onChange={(event) => onEditDraftChange(event.target.value)}
            autoFocus
          />
          <label className="field-label" htmlFor={`edit-context-${topic.id}`}>
            Context <span className="field-hint">optional</span>
          </label>
          <Textarea
            id={`edit-context-${topic.id}`}
            className="text-area"
            value={editContextDraft}
            maxLength={2000}
            onChange={(event) => onEditContextDraftChange(event.target.value)}
          />
          <div className="inline-edit-actions">
            <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!editDraft.trim()}>
              <Check size={14} /> Save changes
            </Button>
          </div>
        </form>
      ) : (
        <>
          <h2 className="topic-title">{topic.title}</h2>
          {topic.context ? <p className="topic-context">{topic.context}</p> : null}
        </>
      )}

      {!topic.deletedAt && !editing ? (
        <>
          <div className="topic-card-footer">
            <ReactionBar reactions={topic.reactions} onToggle={onToggleReaction} />
            <button type="button" className={`reply-toggle ${expanded ? "is-expanded" : ""}`} onClick={onToggleExpanded} aria-expanded={expanded}>
              <MessageCircle size={16} />
              <span>{topic.replyCount ? `${topic.replyCount} ${topic.replyCount === 1 ? "reply" : "replies"}` : "Be the first to reply"}</span>
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>

          {expanded ? (
            <div className="reply-thread">
              <div className="reply-thread-heading">
                <span>Conversation</span>
                <span className="reply-order">Oldest first</span>
              </div>
              {topic.replies.length ? (
                <div className="replies-list">
                  {visibleReplies.map((reply) => (
                    <ReplyItem
                      key={reply.id}
                      reply={reply}
                      currentProfile={currentProfile}
                      editing={editingReplyId === reply.id}
                      editDraft={editingReplyId === reply.id ? editDraft : ""}
                      onEditDraftChange={(value) => onReplyEdit(reply.id, value)}
                      onSaveEdit={onSaveEdit}
                      onCancelEdit={onCancelEdit}
                      onRequestDelete={() => onReplyDelete(reply.id)}
                      onToggleReaction={(emoji) => onReplyReaction(reply.id, emoji)}
                    />
                  ))}
                  {visibleReplyCount < topic.replies.length ? (
                    <button type="button" className="load-replies-button" onClick={() => setVisibleReplyCount((count) => count + 20)}>
                      Load older replies <span aria-hidden="true">↓</span>
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="empty-replies">
                  <MessageCircle size={18} />
                  <p>No replies yet. Leave the first sign.</p>
                </div>
              )}
              <ReplyEditor value={replyDraft} onChange={onReplyDraftChange} onSubmit={onSubmitReply} placeholder="Add your perspective…" />
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function ProfileMenu({ profile, onEdit, onInfo }: { profile: PublicProfile | null; onEdit: () => void; onInfo: () => void }) {
  const fallbackProfile: PublicProfile = profile ?? { id: "guest", displayName: "Guest", avatarKey: null };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="profile-menu-trigger" aria-label={profile ? `Open ${profile.displayName} profile menu` : "Set up your guest profile"}>
          <AvatarMark profile={fallbackProfile} size="sm" />
          <span className="profile-menu-name">{profile?.displayName ?? "Guest mode"}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="menu-surface profile-menu">
        <DropdownMenuLabel>{profile ? `Playing as ${profile.displayName}` : "Browse as a guest"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onEdit}>
          <PenLine size={14} /> {profile ? "Edit profile" : "Choose a profile"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onInfo}>
          <Shield size={14} /> About guest mode
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DiscussionBoard() {
  const [topics, setTopics] = useState<Topic[]>(DEMO_TOPICS);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [connectionState, setConnectionState] = useState<"demo" | "connecting" | "live">(hasSupabaseConfig ? "connecting" : "demo");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [topicComposerOpen, setTopicComposerOpen] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicContext, setTopicContext] = useState("");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(DEMO_TOPICS[0]?.id ?? null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<EditingTarget>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editContextDraft, setEditContextDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visibleTopicCount, setVisibleTopicCount] = useState(20);
  const [remoteTopicPage, setRemoteTopicPage] = useState(0);
  const [hasMoreRemoteTopics, setHasMoreRemoteTopics] = useState(false);
  const [loadingMoreTopics, setLoadingMoreTopics] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(() => {
      try {
        const savedProfile = window.localStorage.getItem("emblem-hall-profile");
        if (!disposed && savedProfile) setProfile(JSON.parse(savedProfile) as PublicProfile);
      } catch {
        // A missing or malformed local profile should never block public browsing.
      }
    }, 0);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    try {
      if (profile) window.localStorage.setItem("emblem-hall-profile", JSON.stringify(profile));
    } catch {
      // Local profile persistence is a convenience; the board remains usable if storage is blocked.
    }
  }, [profile]);

  useEffect(() => {
    const possibleClient = getSupabaseBrowserClient();
    if (!possibleClient) return;
    const client = possibleClient;
    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;

    async function hydrateRemoteBoard() {
      const sessionResult = await client.auth.getSession();
      const session = sessionResult.data.session;
      if (session?.user.id) {
        const profileResult = await client
          .from("profiles")
          .select("id, display_name, avatar_key")
          .eq("id", session.user.id)
          .maybeSingle();
        if (!cancelled && profileResult.data) {
          setProfile({
            id: profileResult.data.id,
            displayName: profileResult.data.display_name,
            avatarKey: profileResult.data.avatar_key?.startsWith("placeholder-") ? profileResult.data.avatar_key as AvatarKey : null,
          });
        }
      }
      const remoteTopics = await loadRemoteBoard(client, session?.user.id ?? null);
      if (cancelled) return;
      setTopics(remoteTopics);
      setRemoteTopicPage(0);
      setHasMoreRemoteTopics(remoteTopics.length === 20);
      setConnectionState("live");

      const refresh = async () => {
        try {
          const currentSession = (await client.auth.getSession()).data.session;
          const refreshed = await loadRemoteBoard(client, currentSession?.user.id ?? null);
          if (!cancelled) {
            setTopics(refreshed);
            setRemoteTopicPage(0);
            setHasMoreRemoteTopics(refreshed.length === 20);
            setConnectionState("live");
          }
        } catch {
          if (!cancelled) setConnectionState("demo");
        }
      };

      channel = client
        .channel("emblem-hall-board")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "topics" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "replies" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, refresh)
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setConnectionState("live");
            void refresh();
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnectionState("demo");
        });
    }

    void hydrateRemoteBoard().catch(() => {
      if (!cancelled) {
        setConnectionState("demo");
        showNotice("The shared board is unavailable, so this browser is showing the camp preview.");
      }
    });

    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
    };
  }, []);

  const groupedTopics = useMemo(() => {
    const groups: Array<{ label: string; topics: Topic[] }> = [];
    topics.slice(0, visibleTopicCount).forEach((topic) => {
      const label = getDayLabel(topic.createdAt, now);
      const group = groups.find((item) => item.label === label);
      if (group) group.topics.push(topic);
      else groups.push({ label, topics: [topic] });
    });
    return groups;
  }, [now, topics, visibleTopicCount]);

  const totalReplies = topics.reduce((sum, topic) => sum + topic.replyCount, 0);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4200);
  }

  async function loadMoreTopics() {
    if (loadingMoreTopics) return;
    const client = getSupabaseBrowserClient();
    if (!client || !hasMoreRemoteTopics) {
      setVisibleTopicCount((count) => count + 20);
      return;
    }

    setLoadingMoreTopics(true);
    try {
      const session = (await client.auth.getSession()).data.session;
      const nextPage = remoteTopicPage + 1;
      const nextTopics = await loadRemoteBoard(client, session?.user.id ?? profile?.id ?? null, nextPage);
      setTopics((currentTopics) => {
        const existingIds = new Set(currentTopics.map((topic) => topic.id));
        return [...currentTopics, ...nextTopics.filter((topic) => !existingIds.has(topic.id))];
      });
      setRemoteTopicPage(nextPage);
      setHasMoreRemoteTopics(nextTopics.length === 20);
      setVisibleTopicCount((count) => count + 20);
    } catch {
      setConnectionState("demo");
      showNotice("More discussions could not be loaded. Try again when the board reconnects.");
    } finally {
      setLoadingMoreTopics(false);
    }
  }

  function requireProfile(action: PendingAction) {
    if (profile) return false;
    setPendingAction(action);
    setProfileDialogOpen(true);
    return true;
  }

  async function saveProfile(nextProfile: PublicProfile) {
    let resolvedProfile = nextProfile;
    const client = getSupabaseBrowserClient();
    if (client) {
      try {
        const session = await ensureAnonymousSession(client);
        resolvedProfile = { ...nextProfile, id: session.user.id };
        await saveRemoteProfile(client, resolvedProfile);
        setConnectionState("live");
      } catch {
        setConnectionState("demo");
        showNotice("Your profile is saved for this browser while the shared board reconnects.");
      }
    }
    setProfile(resolvedProfile);
    setProfileDialogOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    setTopics((currentTopics) =>
      currentTopics.map((topic) => ({
        ...topic,
        author: topic.author.id === resolvedProfile.id ? resolvedProfile : topic.author,
        replies: topic.replies.map((reply) => ({
          ...reply,
          author: reply.author.id === resolvedProfile.id ? resolvedProfile : reply.author,
        })),
      })),
    );
    if (action?.kind === "topic") {
      window.setTimeout(() => postTopic(resolvedProfile), 0);
    } else if (action?.kind === "reply") {
      window.setTimeout(() => postReply(action.topicId, resolvedProfile), 0);
    } else if (action?.kind === "reaction") {
      window.setTimeout(() => toggleReaction(action.targetType, action.targetId, action.emoji, resolvedProfile), 0);
    }
  }

  function postTopic(activeProfile = profile, draftTitle = topicTitle, draftContext = topicContext) {
    const title = draftTitle.trim();
    const context = draftContext.trim();
    if (!activeProfile || !title) return;
    const timestamp = new Date().toISOString();
    const topic: Topic = {
      id: createId("topic"),
      title: title.slice(0, 140),
      context: context ? context.slice(0, 2000) : null,
      author: activeProfile,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      replies: [],
      replyCount: 0,
      reactions: EMPTY_REACTIONS.map((reaction) => ({ ...reaction })),
    };
    setTopics((currentTopics) => [topic, ...currentTopics]);
    setExpandedTopic(topic.id);
    setTopicComposerOpen(false);
    setTopicTitle("");
    setTopicContext("");
    const client = getSupabaseBrowserClient();
    if (client) {
      void createRemoteTopic(client, activeProfile, topic.title, topic.context).catch(() => {
        setConnectionState("demo");
        showNotice("The topic is visible here, but the shared board could not save it.");
      });
    }
    showNotice("Your discussion is now open to the camp.");
  }

  function handleTopicSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requireProfile({ kind: "topic" })) return;
    postTopic();
  }

  function postReply(topicId: string, activeProfile = profile, draftBody = replyDrafts[topicId]) {
    const body = draftBody?.trim();
    if (!activeProfile || !body) return;
    const timestamp = new Date().toISOString();
    const reply: Reply = {
      id: createId("reply"),
      topicId,
      body: body.slice(0, 2000),
      author: activeProfile,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      reactions: EMPTY_REACTIONS.map((reaction) => ({ ...reaction })),
    };
    setTopics((currentTopics) =>
      currentTopics.map((topic) =>
        topic.id === topicId
          ? { ...topic, replies: [...topic.replies, reply], replyCount: topic.replyCount + 1 }
          : topic,
      ),
    );
    setReplyDrafts((drafts) => ({ ...drafts, [topicId]: "" }));
    setExpandedTopic(topicId);
    const client = getSupabaseBrowserClient();
    if (client) {
      void createRemoteReply(client, activeProfile, topicId, reply.body).catch(() => {
        setConnectionState("demo");
        showNotice("The reply is visible here, but the shared board could not save it.");
      });
    }
    showNotice("Reply added to the conversation.");
  }

  function handleReplySubmit(topicId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requireProfile({ kind: "reply", topicId })) return;
    postReply(topicId);
  }

  function toggleReaction(targetType: "topic" | "reply", targetId: string, emoji: ReactionEmoji, activeProfile = profile) {
    if (!activeProfile) return;
    const sourceTopic = topics.find((topic) => targetType === "topic" ? topic.id === targetId : topic.replies.some((reply) => reply.id === targetId));
    const sourceReaction = targetType === "topic"
      ? sourceTopic?.reactions.find((reaction) => reaction.emoji === emoji)
      : sourceTopic?.replies.find((reply) => reply.id === targetId)?.reactions.find((reaction) => reaction.emoji === emoji);
    const nextActive = !(sourceReaction?.reacted ?? false);
    setTopics((currentTopics) => updateReactionState(currentTopics, targetType, targetId, emoji, nextActive));
    const client = getSupabaseBrowserClient();
    if (client) {
      void toggleRemoteReaction(client, activeProfile.id, targetType, targetId, emoji, nextActive).catch(() => {
        setConnectionState("demo");
        setTopics((currentTopics) => {
          const currentReaction = targetType === "topic"
            ? currentTopics.find((topic) => topic.id === targetId)?.reactions.find((reaction) => reaction.emoji === emoji)
            : currentTopics.flatMap((topic) => topic.replies).find((reply) => reply.id === targetId)?.reactions.find((reaction) => reaction.emoji === emoji);
          return currentReaction?.reacted === nextActive
            ? updateReactionState(currentTopics, targetType, targetId, emoji, !nextActive)
            : currentTopics;
        });
        showNotice("Your reaction could not reach the shared board.");
      });
    }
  }

  function handleReaction(targetType: "topic" | "reply", targetId: string, emoji: ReactionEmoji) {
    if (requireProfile({ kind: "reaction", targetType, targetId, emoji })) return;
    toggleReaction(targetType, targetId, emoji);
  }

  function startTopicEdit(topic: Topic) {
    setEditing({ kind: "topic", id: topic.id });
    setEditDraft(topic.title);
    setEditContextDraft(topic.context ?? "");
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editDraft.trim() || !profile) return;
    const timestamp = new Date().toISOString();
    setTopics((currentTopics) =>
      currentTopics.map((topic) => {
        if (editing.kind === "topic" && topic.id === editing.id && topic.author.id === profile.id) {
          return { ...topic, title: editDraft.trim().slice(0, 140), context: editContextDraft.trim().slice(0, 2000) || null, updatedAt: timestamp };
        }
        if (editing.kind === "reply" && topic.replies.some((reply) => reply.id === editing.id)) {
          return {
            ...topic,
            replies: topic.replies.map((reply) => (reply.id === editing.id && reply.author.id === profile.id ? { ...reply, body: editDraft.trim().slice(0, 2000), updatedAt: timestamp } : reply)),
          };
        }
        return topic;
      }),
    );
    const client = getSupabaseBrowserClient();
    if (client) {
      if (editing.kind === "topic") {
        void updateRemoteTopic(client, editing.id, profile.id, editDraft.trim().slice(0, 140), editContextDraft.trim().slice(0, 2000) || null).catch(() => setConnectionState("demo"));
      } else {
        void updateRemoteReply(client, editing.id, profile.id, editDraft.trim().slice(0, 2000)).catch(() => setConnectionState("demo"));
      }
    }
    setEditing(null);
    setEditDraft("");
    setEditContextDraft("");
    showNotice("Your changes have been saved.");
  }

  function requestDelete(kind: "topic" | "reply", id: string) {
    setDeleteTarget({ kind, id });
  }

  function confirmDelete() {
    if (!deleteTarget || !profile) return;
    const timestamp = new Date().toISOString();
    setTopics((currentTopics) =>
      currentTopics.map((topic) => {
        if (deleteTarget.kind === "topic" && topic.id === deleteTarget.id && topic.author.id === profile.id) {
          return { ...topic, deletedAt: timestamp };
        }
        if (deleteTarget.kind === "reply" && topic.replies.some((reply) => reply.id === deleteTarget.id)) {
          return {
            ...topic,
            replies: topic.replies.map((reply) => (reply.id === deleteTarget.id && reply.author.id === profile.id ? { ...reply, deletedAt: timestamp } : reply)),
          };
        }
        return topic;
      }),
    );
    const client = getSupabaseBrowserClient();
    if (client) {
      if (deleteTarget.kind === "topic") {
        void deleteRemoteTopic(client, deleteTarget.id, profile.id).catch(() => setConnectionState("demo"));
      } else {
        void deleteRemoteReply(client, deleteTarget.id, profile.id).catch(() => setConnectionState("demo"));
      }
    }
    if (deleteTarget.kind === "topic") setExpandedTopic(null);
    setDeleteTarget(null);
    showNotice("Content removed from the board.");
  }

  function handleReplyEdit(replyId: string, value: string) {
    setEditing({ kind: "reply", id: replyId });
    setEditDraft(value);
  }

  useWebMcpTools({
    readBoard: () => topics.slice(0, visibleTopicCount).map((topic) => ({
      id: topic.id,
      title: topic.deletedAt ? "Discussion removed by author" : topic.title,
      author: topic.author.displayName,
      createdAt: topic.createdAt,
      replyCount: topic.replyCount,
      reactions: topic.reactions.filter((reaction) => reaction.count > 0).map((reaction) => ({ emoji: reaction.emoji, count: reaction.count })),
    })),
    createTopic: (title, context) => {
      if (!profile) return { status: "profile_required" };
      postTopic(profile, title, context ?? "");
      return { status: "created" };
    },
    createReply: (topicId, body) => {
      if (!profile) return { status: "profile_required" };
      if (!topics.some((topic) => topic.id === topicId && !topic.deletedAt)) return { status: "topic_not_found" };
      postReply(topicId, profile, body);
      return { status: "created" };
    },
    toggleReaction: (targetType, targetId, emoji) => {
      if (!profile) return { status: "profile_required" };
      if (targetType === "topic" && !topics.some((topic) => topic.id === targetId && !topic.deletedAt)) return { status: "target_not_found" };
      if (targetType === "reply" && !topics.some((topic) => topic.replies.some((reply) => reply.id === targetId && !reply.deletedAt))) return { status: "target_not_found" };
      toggleReaction(targetType, targetId, emoji as ReactionEmoji, profile);
      return { status: "toggled" };
    },
  });

  return (
    <main className="site-shell">
      <div className="mobile-topbar">
        <button type="button" className="mobile-brand" onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen}>
          <span className="brand-mark small" aria-hidden="true"><Feather size={16} /></span>
          <span>Emblem Hall</span>
        </button>
        <div className="mobile-top-actions">
          <ProfileMenu profile={profile} onEdit={() => setProfileDialogOpen(true)} onInfo={() => showNotice("Guest mode keeps your profile in this browser; it never asks for an email or password.")} />
          <button type="button" className="icon-button mobile-menu-button" aria-label="Toggle navigation" onClick={() => setMobileMenuOpen((open) => !open)}>
            <Menu size={18} />
          </button>
        </div>
      </div>

      <div className={`mobile-nav ${mobileMenuOpen ? "is-open" : ""}`}>
        <button type="button" className="mobile-nav-item is-active" onClick={() => setMobileMenuOpen(false)}><BookOpen size={16} /> Daily board</button>
        <button type="button" className="mobile-nav-item" onClick={() => showNotice("The archive will grow with the hall.")}><Clock3 size={16} /> Recent dispatches</button>
      </div>

      <div className="board-layout">
        <aside className="left-rail">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true"><Feather size={19} /></span>
            <div>
              <span className="brand-name">Emblem Hall</span>
              <span className="brand-kicker">A daily campfire for tacticians</span>
            </div>
          </div>
          <nav className="rail-nav" aria-label="Board navigation">
            <span className="rail-section-label">The hall</span>
            <button type="button" className="rail-link is-active"><BookOpen size={16} /> Daily board <span className="rail-count">{topics.length}</span></button>
            <button type="button" className="rail-link" onClick={() => showNotice("Recent dispatches are already gathered on the daily board.")}><Clock3 size={16} /> Recent dispatches</button>
          </nav>
          <div className="rail-divider" />
          <div className="rail-note">
            <div className="rail-note-icon" aria-hidden="true"><Shield size={15} /></div>
            <p>Bring a question, a theory, or one perfectly timed critical hit.</p>
          </div>
        </aside>

        <section className="board-column" aria-labelledby="board-heading">
          <header className="board-header">
            <div className="board-heading-copy">
              <p className="eyebrow"><span className="eyebrow-flare" /> Daily discussion topics</p>
              <h1 id="board-heading">Tavern board</h1>
              <p className="board-intro">Pin a discussion topic onto the board and check back daily to see what fellow adventurers have to say</p>
            </div>
            <div className="board-header-actions tablet-profile">
              <ProfileMenu profile={profile} onEdit={() => setProfileDialogOpen(true)} onInfo={() => showNotice("Guest mode keeps your profile in this browser; it never asks for an email or password.")} />
            </div>
          </header>

          <div className="board-status-row">
            <div className={`status-copy ${connectionState !== "live" ? "is-preview" : ""}`} title={connectionState === "live" ? "Live shared board" : connectionState === "connecting" ? "Connecting to the shared board" : "Local camp preview"}><span className="live-pulse" /> <span>The tavern</span><span className="status-dot-separator">·</span><span>{topics.length} {topics.length === 1 ? "topic" : "topics"} pinned in the board</span></div>
          </div>

          {topicComposerOpen ? (
            <Composer
              title={topicTitle}
              context={topicContext}
              onTitleChange={setTopicTitle}
              onContextChange={setTopicContext}
              onSubmit={handleTopicSubmit}
              onCancel={() => { setTopicComposerOpen(false); setTopicTitle(""); setTopicContext(""); }}
            />
          ) : null}

          <div className="topic-feed">
            {groupedTopics.length ? groupedTopics.map((group) => (
              <section key={group.label} className="topic-day" aria-labelledby={`day-${group.label.replace(/\s+/g, "-").toLowerCase()}`}>
                <div className="day-divider">
                  <h2 id={`day-${group.label.replace(/\s+/g, "-").toLowerCase()}`}>{group.label}</h2>
                  <span>{group.topics.length} {group.topics.length === 1 ? "discussion" : "discussions"}</span>
                </div>
                <div className="topic-list">
                  {group.topics.map((topic) => (
                    <TopicCard
                      key={topic.id}
                      topic={topic}
                      currentProfile={profile}
                      expanded={expandedTopic === topic.id}
                      onToggleExpanded={() => setExpandedTopic((current) => current === topic.id ? null : topic.id)}
                      onToggleReaction={(emoji) => handleReaction("topic", topic.id, emoji)}
                      onSubmitReply={(event) => handleReplySubmit(topic.id, event)}
                      replyDraft={replyDrafts[topic.id] ?? ""}
                      onReplyDraftChange={(value) => setReplyDrafts((drafts) => ({ ...drafts, [topic.id]: value }))}
                      editing={editing?.kind === "topic" && editing.id === topic.id}
                      editDraft={editDraft}
                      editContextDraft={editContextDraft}
                      editingReplyId={editing?.kind === "reply" ? editing.id : null}
                      onEditDraftChange={setEditDraft}
                      onEditContextDraftChange={setEditContextDraft}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => { setEditing(null); setEditDraft(""); setEditContextDraft(""); }}
                      onStartEdit={() => startTopicEdit(topic)}
                      onRequestDelete={() => requestDelete("topic", topic.id)}
                      onReplyEdit={handleReplyEdit}
                      onReplyDelete={(replyId) => requestDelete("reply", replyId)}
                      onReplyReaction={(replyId, emoji) => handleReaction("reply", replyId, emoji)}
                    />
                  ))}
                </div>
              </section>
            )) : (
              <div className="empty-board" role="status">
                <div className="empty-board-mark" aria-hidden="true"><Feather size={20} /></div>
                <h2>The hall is waiting for its first dispatch.</h2>
                <p>Open a discussion and give the camp something to gather around.</p>
                <Button variant="outline" onClick={() => setTopicComposerOpen(true)}><Plus size={15} /> Start a discussion</Button>
              </div>
            )}
          </div>

          {visibleTopicCount < topics.length || hasMoreRemoteTopics ? (
            <Button variant="outline" className="load-more-button" onClick={() => void loadMoreTopics()} disabled={loadingMoreTopics}>
              {loadingMoreTopics ? "Loading the archive…" : "Load more discussions"}
            </Button>
          ) : (
            <div className="feed-end"><span className="feed-end-mark" aria-hidden="true">✦</span><span>You’ve reached the edge of the current archive.</span></div>
          )}
        </section>

        <aside className="right-rail">
          <div className="right-rail-profile">
            <ProfileMenu profile={profile} onEdit={() => setProfileDialogOpen(true)} onInfo={() => showNotice("Guest mode keeps your profile in this browser; it never asks for an email or password.")} />
          </div>
          <div className="right-rail-card prompt-card">
            <div className="card-cardinal" aria-hidden="true"><Flame size={18} /></div>
            <p className="eyebrow">At the campfire</p>
            <h2>Leave a little room for another voice.</h2>
            <p>Every topic is a small opening. Ask something you’d want to answer, too.</p>
            <Button className="prompt-button new-topic-button" onClick={() => setTopicComposerOpen(true)}>
              <Plus size={15} /> Start a discussion
            </Button>
          </div>
          <div className="right-rail-card pulse-card">
            <div className="pulse-card-header"><span className="eyebrow">Community stats</span><Users size={16} aria-hidden="true" /></div>
            <div className="pulse-stat"><strong>{topics.length}</strong><span>open discussions</span></div>
            <div className="pulse-stat"><strong>{totalReplies}</strong><span>voices in the replies</span></div>
          </div>
          <div className="right-rail-caption"><span>✦</span><p>Original fantasy-inspired interface. Placeholder crests are ready for your assets.</p></div>
        </aside>
      </div>

      {notice ? <div className="notice-toast" role="status"><Check size={16} /> {notice}</div> : null}

      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={(open) => { setProfileDialogOpen(open); if (!open) setPendingAction(null); }}
        existingProfile={profile}
        onSave={saveProfile}
        pendingAction={pendingAction}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="delete-dialog">
          <AlertDialogHeader>
            <div className="dialog-crest danger" aria-hidden="true"><Trash2 size={17} /></div>
            <AlertDialogTitle>Remove this {deleteTarget?.kind === "reply" ? "reply" : "discussion"}?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone from the board. The space will remain marked as removed so the conversation keeps its place.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
