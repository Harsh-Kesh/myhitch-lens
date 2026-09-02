/** Domain types for the MYHitch Lens platform. */

export type UserRole = "reader" | "author" | "editor" | "admin";

export interface Comment {
  name: string;
  date: string;
  text: string;
}

export interface Article {
  id: string;
  title: string;
  category: string;
  type: string;
  readTime: string;
  summary: string;
  content: string;
  author: string;
  authorRank: string;
  likes: number;
  bookmarks: number;
  comments: Comment[];
  verified: boolean;
  date: string;
  /** Set once the reader likes the article; absent in the seed data. */
  liked?: boolean;
}

/** Lightweight article shape for feed/list rendering (from the database). */
export interface FeedArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  type: string;
  author: string;
  verified: boolean; // article-level: content was editor-reviewed
  authorVerified: boolean; // person-level: the author's blue mark
  likes: number;
  readTime: string;
}

export interface QueueItem {
  id: string;
  title: string;
  author: string;
  authorRank: string;
  category: string;
  type: string;
  submittedDate: string;
  aiScore: number;
  plagiarism: string;
  readability: string;
  sentiment: string;
  content: string;
}

export interface Integrations {
  mart: boolean;
  services: boolean;
  travel: boolean;
  events: boolean;
  donations: boolean;
  videos: boolean;
}

export type IntegrationKey = keyof Integrations;

export interface Notification {
  id: number;
  type: "publish" | "system";
  date: string;
  text: string;
}

