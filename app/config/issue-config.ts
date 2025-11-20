export const GITLAB_CONFIG = {
  API_URL: "https://gitlab.com/api/graphql",
  PROJECT_PATH:
    process.env.NEXT_PUBLIC_GITLAB_PROJECT_PATH ?? "your-group/your-project",
  // Use NEXT_PUBLIC_GITLAB_TOKEN to prefill the client form (dev only).
  TOKEN: process.env.NEXT_PUBLIC_GITLAB_TOKEN ?? "",
} as const;

export const COLORS = {
  PRIMARY: ["#38bdf8", "#fb7185", "#facc15", "#4ade80"],
  BADGE: ["#38bdf8", "#a855f7", "#f97316", "#10b981", "#e11d48", "#0ea5e9"],
} as const;
