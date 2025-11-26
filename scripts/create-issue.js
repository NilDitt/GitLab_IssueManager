"use strict";

/**
 * Lightweight CLI to create a GitLab issue without running the Next.js app.
 *
 * Usage:
 *   npm run create-issue -- --title "My bug" --description "Details" --labels "bug,ui" --health on_track --estimate 2
 *
 * Environment (preferred) or flags:
 *   GITLAB_PROJECT_PATH / --project   (group/subgroup/project)
 *   GITLAB_TOKEN        / --token     (PAT with api scope)
 *   GITLAB_API_URL      / --api-url   (defaults to https://gitlab.com/api/v4)
 */

const DEFAULT_API = "https://gitlab.com/api/v4";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = args[i + 1]?.startsWith("--") || args[i + 1] === undefined ? true : args[i + 1];
    parsed[key] = value;
    if (value !== true) i += 1;
  }
  return parsed;
}

async function main() {
  const args = parseArgs();
  const token = args.token || process.env.GITLAB_TOKEN || process.env.NEXT_PUBLIC_GITLAB_TOKEN;
  const projectPath =
    args.project ||
    process.env.GITLAB_PROJECT_PATH ||
    process.env.NEXT_PUBLIC_GITLAB_PROJECT_PATH;
  const apiBase = (args["api-url"] || process.env.GITLAB_API_URL || DEFAULT_API).replace(/\/$/, "");

  if (!token) {
    throw new Error("Missing token. Set GITLAB_TOKEN or pass --token.");
  }
  if (!projectPath) {
    throw new Error("Missing project path. Set GITLAB_PROJECT_PATH or pass --project.");
  }

  const title = args.title;
  if (!title) {
    throw new Error("Missing required --title.");
  }

  const description = args.description || "";
  const labels = typeof args.labels === "string" ? args.labels : "";
  const health = args.health;
  const estimateHours = args.estimate ? Number(args.estimate) : null;

  const payload = {
    title,
    description,
    labels,
  };
  if (health === "on_track" || health === "needs_attention" || health === "at_risk") {
    payload.health_status = health;
  }
  if (Number.isFinite(estimateHours) && estimateHours > 0) {
    payload.time_estimate = Math.round(estimateHours * 3600);
  }

  const encodedProject = encodeURIComponent(projectPath);
  const url = `${apiBase}/projects/${encodedProject}/issues`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitLab responded ${res.status} ${res.statusText}: ${text}`);
  }

  const json = await res.json();
  // eslint-disable-next-line no-console
  console.log(
    `Created issue #${json.iid}: ${json.title}\nURL: ${json.web_url}\nState: ${json.state}`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
