/**
 * A small, independently maintained starter catalog for common website rules.
 *
 * Domains are factual identifiers. The list stays intentionally compact so
 * every entry can be reviewed and extended through ordinary pull requests.
 */
export interface Category {
  id: string;
  name: string;
  isAdult: boolean;
}

export const CATEGORIES: Category[] = [
  { id: 'social', name: 'Social', isAdult: false },
  { id: 'video', name: 'Video', isAdult: false },
  { id: 'news', name: 'News', isAdult: false },
  { id: 'shopping', name: 'Shopping', isAdult: false },
  { id: 'dating', name: 'Dating', isAdult: false },
  { id: 'games', name: 'Games', isAdult: false },
  { id: 'work', name: 'Work', isAdult: false },
];

export interface SiteEntry {
  id: string;
  name: string;
  domains: string[];
  categories: string[];
}

export const BLOCKLIST_CATALOG: SiteEntry[] = [
  { id: 'instagram', name: 'Instagram', domains: ['instagram.com'], categories: ['social'] },
  { id: 'facebook', name: 'Facebook', domains: ['facebook.com', 'fb.com'], categories: ['social'] },
  { id: 'reddit', name: 'Reddit', domains: ['reddit.com'], categories: ['social'] },
  { id: 'x', name: 'X', domains: ['x.com', 'twitter.com'], categories: ['social'] },
  { id: 'tiktok', name: 'TikTok', domains: ['tiktok.com'], categories: ['social', 'video'] },
  { id: 'discord', name: 'Discord', domains: ['discord.com', 'discord.gg'], categories: ['social'] },
  { id: 'pinterest', name: 'Pinterest', domains: ['pinterest.com'], categories: ['social'] },
  { id: 'youtube', name: 'YouTube', domains: ['youtube.com', 'youtu.be'], categories: ['video'] },
  { id: 'twitch', name: 'Twitch', domains: ['twitch.tv'], categories: ['video'] },
  { id: 'netflix', name: 'Netflix', domains: ['netflix.com'], categories: ['video'] },
  { id: 'prime-video', name: 'Prime Video', domains: ['primevideo.com'], categories: ['video'] },
  { id: 'hulu', name: 'Hulu', domains: ['hulu.com'], categories: ['video'] },
  { id: 'bbc-news', name: 'BBC News', domains: ['bbc.com', 'bbc.co.uk'], categories: ['news'] },
  { id: 'cnn', name: 'CNN', domains: ['cnn.com'], categories: ['news'] },
  { id: 'reuters', name: 'Reuters', domains: ['reuters.com'], categories: ['news'] },
  { id: 'nytimes', name: 'The New York Times', domains: ['nytimes.com'], categories: ['news'] },
  { id: 'guardian', name: 'The Guardian', domains: ['theguardian.com'], categories: ['news'] },
  { id: 'amazon', name: 'Amazon', domains: ['amazon.com'], categories: ['shopping'] },
  { id: 'etsy', name: 'Etsy', domains: ['etsy.com'], categories: ['shopping'] },
  { id: 'temu', name: 'Temu', domains: ['temu.com'], categories: ['shopping'] },
  { id: 'tinder', name: 'Tinder', domains: ['tinder.com'], categories: ['dating'] },
  { id: 'bumble', name: 'Bumble', domains: ['bumble.com'], categories: ['dating'] },
  { id: 'chess', name: 'Chess.com', domains: ['chess.com'], categories: ['games'] },
  { id: 'roblox', name: 'Roblox', domains: ['roblox.com'], categories: ['games'] },
  { id: 'gmail', name: 'Gmail', domains: ['mail.google.com'], categories: ['work'] },
  { id: 'slack', name: 'Slack', domains: ['slack.com'], categories: ['work'] },
  { id: 'notion', name: 'Notion', domains: ['notion.so'], categories: ['work'] },
  { id: 'linkedin', name: 'LinkedIn', domains: ['linkedin.com'], categories: ['work', 'social'] },
];
