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

const profile = (
  id: string,
  displayName: string,
  avatarKey: AvatarKey | null,
): PublicProfile => ({ id, displayName, avatarKey });

const reactions = (
  values: Partial<Record<ReactionEmoji, number>> = {},
  reacted: ReactionEmoji[] = [],
): ReactionSummary[] =>
  REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: values[emoji] ?? 0,
    reacted: reacted.includes(emoji),
  }));

export const DEMO_TOPICS: Topic[] = [
  {
    id: "topic-shepherds-choices",
    title: "Which choice in Three Houses changed your whole first playthrough?",
    context:
      "I’m replaying the Blue Lions route and remembering how one early choice completely changed the emotional rhythm of the story. Curious which decision stayed with everyone else.",
    author: profile("profile-mara", "Mara of Fódlan", "placeholder-02"),
    createdAt: "2026-09-15T14:18:00.000Z",
    updatedAt: "2026-09-15T14:18:00.000Z",
    deletedAt: null,
    replyCount: 3,
    reactions: reactions({ "❤️": 12, "🔥": 8, "⚔️": 4 }, ["❤️"]),
    replies: [
      {
        id: "reply-shepherds-1",
        topicId: "topic-shepherds-choices",
        body: "Recruiting Marianne before the timeskip made me realize how much the calendar was shaping my decisions. I suddenly wanted to spend every free day differently.",
        author: profile("profile-oren", "Oren", "placeholder-04"),
        createdAt: "2026-09-15T14:47:00.000Z",
        updatedAt: "2026-09-15T14:47:00.000Z",
        deletedAt: null,
        reactions: reactions({ "✨": 4, "❤️": 2 }),
      },
      {
        id: "reply-shepherds-2",
        topicId: "topic-shepherds-choices",
        body: "The moment I chose to protect the monastery instead of chasing the immediate objective. It felt small in the map, but the consequences made the world feel much larger.",
        author: profile("profile-lyra", "Lyra", "placeholder-05"),
        createdAt: "2026-09-15T15:03:00.000Z",
        updatedAt: "2026-09-15T15:03:00.000Z",
        deletedAt: null,
        reactions: reactions({ "🛡️": 3, "✨": 2 }),
      },
      {
        id: "reply-shepherds-3",
        topicId: "topic-shepherds-choices",
        body: "I refused to let a certain archer sit out a single battle. That decision was not strategic, but it made the whole run feel like it belonged to my little squad.",
        author: profile("profile-sol", "Sol", null),
        createdAt: "2026-09-15T15:22:00.000Z",
        updatedAt: "2026-09-15T15:22:00.000Z",
        deletedAt: null,
        reactions: reactions({ "😂": 5, "⚔️": 1 }),
      },
    ],
  },
  {
    id: "topic-best-supports",
    title: "A small appreciation thread for support conversations that sneak up on you",
    context:
      "Not necessarily the funniest or most famous ones—just the conversations that made you stop and sit with a character for a while.",
    author: profile("profile-elis", "Elis", "placeholder-06"),
    createdAt: "2026-09-15T09:32:00.000Z",
    updatedAt: "2026-09-15T09:32:00.000Z",
    deletedAt: null,
    replyCount: 2,
    reactions: reactions({ "✨": 9, "❤️": 6, "😂": 2 }),
    replies: [
      {
        id: "reply-supports-1",
        topicId: "topic-best-supports",
        body: "Seteth and Bernadetta. I expected a joke and got a surprisingly gentle conversation about boundaries and trust instead.",
        author: profile("profile-kai", "Kai", "placeholder-01"),
        createdAt: "2026-09-15T10:10:00.000Z",
        updatedAt: "2026-09-15T10:10:00.000Z",
        deletedAt: null,
        reactions: reactions({ "❤️": 3, "✨": 3 }),
      },
      {
        id: "reply-supports-2",
        topicId: "topic-best-supports",
        body: "Dorothea and Ferdinand. It begins with status and ends with two people being honest about what they need from the world. Beautifully paced.",
        author: profile("profile-nia", "Nia", "placeholder-03"),
        createdAt: "2026-09-15T10:54:00.000Z",
        updatedAt: "2026-09-15T10:54:00.000Z",
        deletedAt: null,
        reactions: reactions({ "✨": 2, "⚔️": 1 }),
      },
    ],
  },
  {
    id: "topic-classic-map",
    title: "What is the one classic map you still remember tile by tile?",
    context: null,
    author: profile("profile-tomas", "Tomas", "placeholder-01"),
    createdAt: "2026-09-14T19:06:00.000Z",
    updatedAt: "2026-09-14T19:06:00.000Z",
    deletedAt: null,
    replyCount: 2,
    reactions: reactions({ "⚔️": 11, "🔥": 6, "😂": 3 }),
    replies: [
      {
        id: "reply-map-1",
        topicId: "topic-classic-map",
        body: "The fog map in Path of Radiance. I can still feel the tension of moving one unit at a time and hoping the next tile was safe.",
        author: profile("profile-jen", "Jen", "placeholder-03"),
        createdAt: "2026-09-14T20:02:00.000Z",
        updatedAt: "2026-09-14T20:02:00.000Z",
        deletedAt: null,
        reactions: reactions({ "🔥": 4, "🛡️": 2 }),
      },
      {
        id: "reply-map-2",
        topicId: "topic-classic-map",
        body: "Battle Before Dawn from Awakening. The rain, the pressure, the reinforcements—it taught me to read the map before I moved anyone.",
        author: profile("profile-rin", "Rin", "placeholder-02"),
        createdAt: "2026-09-14T21:15:00.000Z",
        updatedAt: "2026-09-14T21:15:00.000Z",
        deletedAt: null,
        reactions: reactions({ "⚔️": 3, "✨": 1 }),
      },
    ],
  },
];

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

