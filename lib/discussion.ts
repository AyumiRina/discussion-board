export const REACTION_EMOJIS = ["❤️", "🔥", "⚔️", "🛡️", "✨", "😂"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const AVATAR_OPTIONS = [
  {
    key: "placeholder-01",
    label: "Crimson crest",
    symbol: "✦",
    className: "avatar-crimson",
  },
  {
    key: "placeholder-02",
    label: "Azure crest",
    symbol: "◇",
    className: "avatar-azure",
  },
  {
    key: "placeholder-03",
    label: "Verdant crest",
    symbol: "☘",
    className: "avatar-verdant",
  },
  {
    key: "placeholder-04",
    label: "Gold crest",
    symbol: "☼",
    className: "avatar-gold",
  },
  {
    key: "placeholder-05",
    label: "Violet crest",
    symbol: "✧",
    className: "avatar-violet",
  },
  {
    key: "placeholder-06",
    label: "Rose crest",
    symbol: "❋",
    className: "avatar-rose",
  },
] as const;

export type AvatarKey = (typeof AVATAR_OPTIONS)[number]["key"];

export type PublicProfile = {
  id: string;
  displayName: string;
  avatarKey: AvatarKey | null;
};

export type ReactionSummary = {
  emoji: ReactionEmoji;
  count: number;
  reacted: boolean;
};

export type Reply = {
  id: string;
  topicId: string;
  body: string;
  author: PublicProfile;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  reactions: ReactionSummary[];
};

export type Topic = {
  id: string;
  title: string;
  context: string | null;
  author: PublicProfile;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  replies: Reply[];
  replyCount: number;
  reactions: ReactionSummary[];
};

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
};

export const EMPTY_REACTIONS: ReactionSummary[] = REACTION_EMOJIS.map((emoji) => ({
  emoji,
  count: 0,
  reacted: false,
}));

export function getAvatarOption(avatarKey: AvatarKey | null) {
  return AVATAR_OPTIONS.find((option) => option.key === avatarKey) ?? null;
}

export function getInitials(displayName: string) {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function formatRelativeTime(timestamp: string, now = new Date()) {
  const date = new Date(timestamp);
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function formatExactTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function getDayLabel(timestamp: string, now = new Date()) {
  const date = new Date(timestamp);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}

export function formatCount(count: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(count);
}
