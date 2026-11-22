// PROTOTYPE — throwaway. Mock wording for the five first-release notifications
// (see "Choose the notifications for the first release", ticket #4). The data is
// sent to Knock for real; only the wording is made up.

export type MockMessageType =
  | "refund-decided"
  | "refund-raised"
  | "seat-claimed"
  | "comment-posted"
  | "reply-posted";

export interface MockMessage {
  /** Who gets it, for the sender panel only. */
  audience: string;
  actor: string;
  title: string;
  body: string;
  url: string;
}

export const MOCK_MESSAGES: Record<MockMessageType, MockMessage> = {
  "refund-decided": {
    audience: "buyer",
    actor: "Cadence",
    title: "Refund Request approved",
    body: "Your Refund Request for Introduction to TypeScript was approved. The Refund of $79.00 is on its way.",
    url: "/dashboard",
  },
  "refund-raised": {
    audience: "all Platform Admins",
    actor: "Liam Carter",
    title: "New Refund Request",
    body: "Liam Carter raised a Refund Request for Introduction to TypeScript: “The course moved too fast for me.”",
    url: "/admin/refunds",
  },
  "seat-claimed": {
    audience: "Team Admin",
    actor: "Priya Shah",
    title: "Seat claimed",
    body: "Priya Shah claimed a Seat on Advanced React Patterns. 3 of 10 Seats left.",
    url: "/team",
  },
  "comment-posted": {
    audience: "course's Instructor",
    actor: "Sam Okafor",
    title: "New Comment on your course",
    body: "Sam Okafor commented on “Generics in Practice”: “Why does the constraint need extends here?”",
    url: "/instructor/questions",
  },
  "reply-posted": {
    audience: "thread starter",
    actor: "Ana Ruiz",
    title: "New Reply to your Comment",
    body: "Ana Ruiz replied to your Comment on “Generics in Practice”: “Because T could be anything otherwise.”",
    url: "/courses",
  },
};

export const MOCK_MESSAGE_TYPES = Object.keys(MOCK_MESSAGES) as MockMessageType[];
