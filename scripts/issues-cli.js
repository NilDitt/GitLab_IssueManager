#!/usr/bin/env node
"use strict";

const { loadEnv } = require("./utils/load-env");
loadEnv();

const fs = require("fs");
const path = require("path");

const DEFAULT_GRAPHQL_ENDPOINT = "https://gitlab.com/api/graphql";
const DEFAULT_REST_ENDPOINT = "https://gitlab.com/api/v4";
const DEFAULT_ISSUE_PAGE_SIZE = 50;

const ISSUE_LIST_QUERY = `
  query ProjectIssues($fullPath: ID!, $first: Int!, $after: String) {
    project(fullPath: $fullPath) {
      id
      name
      webUrl
      labels(first: 100) {
        nodes {
          title
          color
          description
        }
      }
      issues(first: $first, after: $after, sort: UPDATED_DESC) {
        nodes {
          id
          iid
          title
          description
          state
          webUrl
          healthStatus
          timeEstimate
          createdAt
          updatedAt
          author {
            id
            name
            username
          }
          assignees(first: 10) {
            nodes {
              id
              name
              username
            }
          }
          labels(first: 20) {
            nodes {
              title
              color
              description
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token.startsWith("--")) {
      const [rawKey, inlineValue] = token.slice(2).split("=");
      const key = rawKey.trim();
      if (inlineValue !== undefined) {
        parsed[key] = inlineValue;
        continue;
      }
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        i += 1;
      }
      continue;
    }
    parsed._.push(token);
  }
  return parsed;
}

function isTruthy(value) {
  if (value === undefined || value === null) return false;
  if (value === false) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "" ||
      normalized === "0" ||
      normalized === "false" ||
      normalized === "no"
    ) {
      return false;
    }
  }
  return Boolean(value);
}

function printHelp() {
  const help = `
GitLab Issue CLI
Usage:
  npm run issue-cli -- [command] [flags]

Commands:
  list                Fetch issues and apply local filters (default)
  update              Update a specific issue using the same fields as the UI

Shared flags:
  --project <path>    GitLab project path (group/sub/project)
  --token <token>     Personal access token (api scope)
  --api-url <url>     GraphQL endpoint (defaults to ${DEFAULT_GRAPHQL_ENDPOINT})
  --rest-url <url>    Optional REST endpoint (defaults to ${DEFAULT_REST_ENDPOINT})
  --page-size <n>     GraphQL page size (default ${DEFAULT_ISSUE_PAGE_SIZE})

List flags:
  --filter <text>     Text filter (matches title/description/labels)
  --state <all|opened|closed>
  --sort <updated_desc|updated_asc|created_desc|created_asc|title_asc>
  --limit <n>         Limit printed rows
  --json              Output JSON instead of table

Update flags:
  --iid <number>      Issue IID to update (required)
  --title <text>
  --description <text>
  --labels "foo,bar"
  --health <on_track|needs_attention|at_risk>
  --estimate <hours>  Time estimate in hours
  --state <close|reopen>
  --data-file <path>  JSON payload (fields: title, description, labels, healthStatus, timeEstimateSeconds)
  --json              Output JSON response
`;
  // eslint-disable-next-line no-console
  console.log(help.trim());
}

function requireValue(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function parsePositiveInt(value, label) {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return Math.floor(parsed);
}

function resolveRestEndpoint(graphqlUrl, explicitRestUrl) {
  if (explicitRestUrl) return explicitRestUrl.replace(/\/$/, "");
  if (!graphqlUrl) return DEFAULT_REST_ENDPOINT;
  if (graphqlUrl.endsWith("/api/graphql")) {
    return graphqlUrl.replace("/api/graphql", "/api/v4");
  }
  return DEFAULT_REST_ENDPOINT;
}

function parseLabels(input) {
  if (typeof input !== "string") return undefined;
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseHoursToSeconds(value) {
  if (value === undefined || value === null) return undefined;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error("Estimate must be a non-negative number.");
  }
  return Math.round(hours * 3600);
}

function normalizeState(state) {
  if (!state) return "all";
  const normalized = String(state).toLowerCase();
  if (["opened", "closed"].includes(normalized)) {
    return normalized;
  }
  if (normalized === "open") return "opened";
  return "all";
}

function normalizeSort(value) {
  const allowed = new Set([
    "updated_desc",
    "updated_asc",
    "created_desc",
    "created_asc",
    "title_asc",
  ]);
  if (!value || !allowed.has(String(value))) {
    return "updated_desc";
  }
  return String(value);
}

function applyFilters(issues, { filterText, state, sort }) {
  const needle = (filterText ?? "").trim().toLowerCase();
  const stateFilter = normalizeState(state);
  const sortMode = normalizeSort(sort);

  const filtered = issues.filter((issue) => {
    if (stateFilter !== "all" && issue.state !== stateFilter) {
      return false;
    }
    if (!needle) return true;
    const haystack = [
      issue.title,
      issue.description ?? "",
      issue.state,
      ...(issue.labels ?? []).map((label) => label.title ?? ""),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });

  const toTime = (value) => new Date(value).getTime();
  filtered.sort((a, b) => {
    switch (sortMode) {
      case "updated_asc":
        return toTime(a.updatedAt) - toTime(b.updatedAt);
      case "created_desc":
        return toTime(b.createdAt) - toTime(a.createdAt);
      case "created_asc":
        return toTime(a.createdAt) - toTime(b.createdAt);
      case "title_asc":
        return a.title.localeCompare(b.title);
      case "updated_desc":
      default:
        return toTime(b.updatedAt) - toTime(a.updatedAt);
    }
  });

  return filtered;
}

function buildIssuesPayload(result, filtered) {
  return {
    project: result.project,
    labels: result.labels,
    totalIssues: result.issues.length,
    matchingIssues: filtered.length,
    issues: filtered,
  };
}

function formatIssueLine(issue) {
  const columns = [
    `#${issue.iid}`.padEnd(6),
    `[${issue.state}]`.padEnd(10),
    new Date(issue.updatedAt).toISOString().split("T")[0].padEnd(12),
    (issue.healthStatus ?? "-").padEnd(15),
    issue.title,
  ];
  let line = columns.join("  ");
  if (issue.labels?.length) {
    line += `\n      labels: ${issue.labels
      .map((label) => label.title)
      .join(", ")}`;
  }
  if (issue.timeEstimate) {
    const hours = (issue.timeEstimate / 3600).toFixed(1);
    line += `\n      estimate: ${hours}h`;
  }
  return line;
}

function printList(result, filtered, options) {
  const { project } = result;
  const summary =
    `Project: ${project.name} (${project.webUrl || "no URL"})\n` +
    `Issues fetched: ${result.issues.length}\n` +
    `Matching filters: ${filtered.length}`;
  // eslint-disable-next-line no-console
  console.log(summary);

  if (!filtered.length) {
    // eslint-disable-next-line no-console
    console.log("No issues matched the provided filters.");
    return;
  }

  const limit = parsePositiveInt(options.limit, "--limit");
  const rows = limit ? filtered.slice(0, limit) : filtered;
  // eslint-disable-next-line no-console
  console.log("\nIID     State      Updated      Health          Title");
  // eslint-disable-next-line no-console
  console.log("------------------------------------------------------------");
  rows.forEach((issue) => {
    // eslint-disable-next-line no-console
    console.log(formatIssueLine(issue));
  });
  if (limit && filtered.length > limit) {
    // eslint-disable-next-line no-console
    console.log(
      `\n… ${
        filtered.length - limit
      } more issue(s) hidden. Increase --limit to see all.`
    );
  }
}

async function fetchProjectIssues({
  projectPath,
  token,
  graphqlEndpoint,
  pageSize,
}) {
  const endpoint = (graphqlEndpoint || DEFAULT_GRAPHQL_ENDPOINT).replace(
    /\/$/,
    ""
  );
  const issues = [];
  let labels = [];
  let project = null;
  let pageInfo = { hasNextPage: true, endCursor: null };

  while (pageInfo?.hasNextPage !== false) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: ISSUE_LIST_QUERY,
        variables: {
          fullPath: projectPath,
          first: pageSize ?? DEFAULT_ISSUE_PAGE_SIZE,
          after: pageInfo?.endCursor ?? null,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `GitLab GraphQL responded ${response.status} ${response.statusText}`
      );
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((err) => err.message).join("; "));
    }
    if (!payload.data?.project) {
      throw new Error("Project not found or access denied.");
    }

    const projectNode = payload.data.project;
    project = {
      id: projectNode.id,
      name: projectNode.name,
      webUrl: projectNode.webUrl,
    };
    labels = projectNode.labels?.nodes ?? labels;

    const pageIssues = projectNode.issues?.nodes ?? [];
    pageIssues.forEach((node) => {
      issues.push({
        id: node.id,
        iid: node.iid,
        title: node.title,
        description: node.description,
        state: node.state,
        webUrl: node.webUrl,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        author: node.author,
        assignees: node.assignees?.nodes ?? [],
        labels: node.labels?.nodes ?? [],
        healthStatus: node.healthStatus,
        timeEstimate: node.timeEstimate,
      });
    });

    pageInfo = projectNode.issues?.pageInfo ?? { hasNextPage: false };
    if (!pageInfo?.hasNextPage) break;
  }

  return {
    project: project ?? {
      id: "unknown",
      name: projectPath,
      webUrl: "",
    },
    issues,
    labels,
  };
}

function readJsonFile(filePath) {
  const absolute = path.resolve(process.cwd(), filePath);
  const content = fs.readFileSync(absolute, "utf8");
  return JSON.parse(content);
}

function normalizeStateEvent(value) {
  if (!value) return undefined;
  const normalized = String(value).toLowerCase();
  if (["close", "closed"].includes(normalized)) return "close";
  if (["open", "opened", "reopen", "reopened"].includes(normalized))
    return "reopen";
  throw new Error("state must be one of close|reopen.");
}

function mergeUpdatePayload(args) {
  const filePayload = args["data-file"] ? readJsonFile(args["data-file"]) : {};
  const payload = { ...filePayload };

  if (args.title !== undefined) payload.title = args.title;
  if (args.description !== undefined) payload.description = args.description;
  if (args.labels !== undefined) payload.labels = parseLabels(args.labels);
  if (args.health !== undefined || args["health-status"] !== undefined) {
    payload.healthStatus = args.health ?? args["health-status"];
  }
  if (args.estimate !== undefined)
    payload.timeEstimateSeconds = parseHoursToSeconds(args.estimate);
  if (args.state !== undefined)
    payload.stateEvent = normalizeStateEvent(args.state);

  return payload;
}

async function updateIssue({ projectPath, token, restEndpoint, args }) {
  const issueIid = requireValue(
    args.iid ?? args.issue,
    "--iid (issue internal ID) is required for update."
  );
  const mergedPayload = mergeUpdatePayload(args);
  const payload = { ...mergedPayload, issueIid };

  const allowedHealth = ["on_track", "needs_attention", "at_risk"];
  if (
    payload.healthStatus !== undefined &&
    !allowedHealth.includes(payload.healthStatus)
  ) {
    throw new Error("health must be one of on_track|needs_attention|at_risk.");
  }

  if (payload.labels && !Array.isArray(payload.labels)) {
    throw new Error("labels must be a comma-separated string or array.");
  }

  if (
    payload.title === undefined &&
    payload.description === undefined &&
    payload.labels === undefined &&
    payload.stateEvent === undefined &&
    payload.healthStatus === undefined &&
    payload.timeEstimateSeconds === undefined
  ) {
    throw new Error("No fields provided to update. Add at least one flag.");
  }

  const url = `${restEndpoint}/projects/${encodeURIComponent(
    projectPath
  )}/issues/${encodeURIComponent(issueIid)}`;

  const body = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.labels !== undefined) body.labels = payload.labels.join(",");
  if (payload.stateEvent !== undefined) body.state_event = payload.stateEvent;
  if (payload.healthStatus !== undefined)
    body.health_status = payload.healthStatus;
  if (payload.timeEstimateSeconds !== undefined)
    body.time_estimate = payload.timeEstimateSeconds;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `GitLab update failed ${response.status} ${response.statusText}: ${text}`
    );
  }

  return response.json();
}

async function listIssues({ projectPath, token, graphqlEndpoint, args }) {
  const result = await fetchProjectIssues({
    projectPath,
    token,
    graphqlEndpoint,
    pageSize:
      parsePositiveInt(args["page-size"], "--page-size") ||
      DEFAULT_ISSUE_PAGE_SIZE,
  });

  const filtered = applyFilters(result.issues, {
    filterText: args.filter ?? args.search,
    state: args.state,
    sort: args.sort,
  });

  const payload = buildIssuesPayload(result, filtered);

  if (isTruthy(args.json)) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  printList(result, filtered, args);
  // eslint-disable-next-line no-console
  console.log(
    "\nJSON payload for matching issues:\n" + JSON.stringify(payload, null, 2)
  );
}

async function main() {
  const args = parseArgs();
  if (args.help || args.h) {
    printHelp();
    return;
  }

  const command = args._[0] ?? "list";

  const token =
    args.token ||
    process.env.GITLAB_TOKEN ||
    process.env.NEXT_PUBLIC_GITLAB_TOKEN ||
    process.env.GITLAB_PRIVATE_TOKEN;
  const projectPath =
    args.project ||
    process.env.GITLAB_PROJECT_PATH ||
    process.env.NEXT_PUBLIC_GITLAB_PROJECT_PATH;
  const apiUrl = (
    args["api-url"] ||
    process.env.GITLAB_API_URL ||
    DEFAULT_GRAPHQL_ENDPOINT
  ).replace(/\/$/, "");
  const restUrl = resolveRestEndpoint(
    apiUrl,
    args["rest-url"] || process.env.GITLAB_REST_URL
  );

  requireValue(token, "Missing token. Set GITLAB_TOKEN or pass --token.");
  requireValue(
    projectPath,
    "Missing project path. Set GITLAB_PROJECT_PATH or pass --project."
  );

  switch (command) {
    case "list":
      await listIssues({ projectPath, token, graphqlEndpoint: apiUrl, args });
      break;
    case "update": {
      const updated = await updateIssue({
        projectPath,
        token,
        restEndpoint: restUrl,
        args,
      });
      if (isTruthy(args.json)) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(updated, null, 2));
      } else {
        const iid = updated?.iid ?? args.iid ?? args.issue;
        const state = updated?.state ? ` (state: ${updated.state})` : "";
        // eslint-disable-next-line no-console
        console.log(`Issue #${iid} updated successfully${state}.`);
      }
      break;
    }
    default:
      throw new Error(
        `Unknown command '${command}'. Run with --help for usage.`
      );
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
