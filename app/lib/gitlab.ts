const DEFAULT_GRAPHQL_ENDPOINT = "https://gitlab.com/api/graphql";
const DEFAULT_REST_ENDPOINT = "https://gitlab.com/api/v4";
const DEFAULT_ISSUE_PAGE_SIZE = 50;

export interface GitLabCredentials {
  apiUrl?: string;
  token: string;
}

export interface ProjectRef {
  id: string;
  name: string;
  webUrl: string;
}

export interface IssueAssignee {
  id: string;
  name: string;
  username: string;
}

export interface IssueLabel {
  title: string;
  color?: string | null;
  description?: string | null;
}

export interface GitLabIssue {
  id: string;
  iid: string;
  title: string;
  description?: string | null;
  state: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
  author?: IssueAssignee | null;
  assignees: IssueAssignee[];
  labels: IssueLabel[];
  healthStatus?: "on_track" | "needs_attention" | "at_risk" | null;
  timeEstimate?: number | null;
}

export interface ProjectIssuesResult {
  project: ProjectRef;
  issues: GitLabIssue[];
  labels: IssueLabel[];
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type IssuePageResponse = {
  project: {
    id: string;
    name: string;
    webUrl: string;
    labels: {
      nodes: IssueLabel[];
    };
    issues: {
      nodes: Array<{
        id: string;
        iid: string;
        title: string;
        description: string | null;
        state: string;
        webUrl: string;
        createdAt: string;
        updatedAt: string;
        author: IssueAssignee | null;
        assignees: {
          nodes: IssueAssignee[];
        };
        labels: {
          nodes: IssueLabel[];
        };
        healthStatus?: "on_track" | "needs_attention" | "at_risk" | null;
        timeEstimate?: number | null;
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
};

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

function resolveRestEndpoint(graphqlEndpoint?: string) {
  if (!graphqlEndpoint) return DEFAULT_REST_ENDPOINT;
  if (graphqlEndpoint.endsWith("/api/graphql")) {
    return graphqlEndpoint.replace("/api/graphql", "/api/v4");
  }
  return DEFAULT_REST_ENDPOINT;
}

export async function fetchProjectIssues(
  projectFullPath: string,
  credentials: GitLabCredentials,
  pageSize: number = DEFAULT_ISSUE_PAGE_SIZE
): Promise<ProjectIssuesResult> {
  if (!projectFullPath) {
    throw new Error("Missing GitLab project full path.");
  }
  if (!credentials.token) {
    throw new Error("Missing GitLab access token.");
  }

  const apiUrl = credentials.apiUrl?.trim() || DEFAULT_GRAPHQL_ENDPOINT;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${credentials.token}`,
  };

  const issues: GitLabIssue[] = [];
  type ProjectNode = NonNullable<IssuePageResponse["project"]>;
  let pageInfo: ProjectNode["issues"]["pageInfo"] | null = null;
  let projectMeta: ProjectRef | null = null;
  let labels: IssueLabel[] = [];

  do {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: ISSUE_LIST_QUERY,
        variables: {
          fullPath: projectFullPath,
          first: pageSize,
          after: pageInfo?.endCursor ?? null,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `GitLab GraphQL responded with ${response.status} ${response.statusText}`
      );
    }

    const payload = (await response.json()) as GraphQLResponse<IssuePageResponse>;
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((err) => err.message).join("; "));
    }
    if (!payload.data?.project) {
      throw new Error("Project not found or access denied.");
    }

    const project = payload.data.project!;
    projectMeta = {
      id: project.id,
      name: project.name,
      webUrl: project.webUrl,
    };
    labels = project.labels.nodes ?? labels;

    const pageIssues =
      project.issues.nodes?.map((node) => ({
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
      })) ?? [];

    issues.push(...pageIssues);
    pageInfo = project.issues.pageInfo;
  } while (pageInfo?.hasNextPage);

  return {
    project:
      projectMeta ?? {
        id: "unknown",
        name: projectFullPath,
        webUrl: "",
      },
    issues,
    labels,
  };
}

export async function fetchProjectLabels(
  projectFullPath: string,
  credentials: GitLabCredentials
): Promise<IssueLabel[]> {
  const restBase = resolveRestEndpoint(credentials.apiUrl);
  const encodedProject = encodeURIComponent(projectFullPath);
  const url = `${restBase}/projects/${encodedProject}/labels?per_page=100`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch labels (${response.status} ${response.statusText}).`
    );
  }
  const json = (await response.json()) as Array<{
    name: string;
    color?: string;
    description?: string | null;
  }>;
  return json.map((entry) => ({
    title: entry.name,
    color: entry.color,
    description: entry.description,
  }));
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  labels?: string[];
  healthStatus?: "on_track" | "needs_attention" | "at_risk";
  timeEstimateSeconds?: number;
}

export async function createIssue(
  projectFullPath: string,
  credentials: GitLabCredentials,
  input: CreateIssueInput
): Promise<GitLabIssue> {
  const restBase = resolveRestEndpoint(credentials.apiUrl);
  const encodedProject = encodeURIComponent(projectFullPath);
  const url = `${restBase}/projects/${encodedProject}/issues`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.token}`,
    },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      labels: input.labels?.join(","),
      health_status: input.healthStatus,
      time_estimate: input.timeEstimateSeconds,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create issue (${response.status} ${response.statusText}).`
    );
  }

  const payload = (await response.json()) as {
    id: number | string;
    iid: number | string;
    title: string;
    description?: string | null;
    state: string;
    web_url: string;
    created_at: string;
    updated_at: string;
    author?: { id: number; name: string; username: string };
    assignees?: Array<{ id: number; name: string; username: string }>;
    labels?: string[];
    health_status?: string | null;
    time_stats?: { time_estimate?: number | null };
  };

  return {
    id: String(payload.id),
    iid: String(payload.iid),
    title: payload.title,
    description: payload.description,
    state: payload.state,
    webUrl: payload.web_url,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    author: payload.author
      ? {
          id: String(payload.author.id),
          name: payload.author.name,
          username: payload.author.username,
        }
      : undefined,
    assignees:
      payload.assignees?.map((assignee) => ({
        id: String(assignee.id),
        name: assignee.name,
        username: assignee.username,
      })) ?? [],
    labels:
      payload.labels?.map((name) => ({
        title: name,
      })) ?? [],
    healthStatus:
      payload.health_status as "on_track" | "needs_attention" | "at_risk" | undefined,
    timeEstimate: payload.time_stats?.time_estimate ?? null,
  };
}

export interface UpdateIssueLabelsInput {
  issueIid: string;
  labels: string[];
}

export interface UpdateIssueInput {
  issueIid: string;
  title?: string;
  description?: string;
  labels?: string[];
  stateEvent?: "close" | "reopen";
  healthStatus?: "on_track" | "needs_attention" | "at_risk";
  timeEstimateSeconds?: number | null;
}

export async function updateIssueLabels(
  projectFullPath: string,
  credentials: GitLabCredentials,
  input: UpdateIssueLabelsInput
): Promise<IssueLabel[]> {
  const restBase = resolveRestEndpoint(credentials.apiUrl);
  const encodedProject = encodeURIComponent(projectFullPath);
  const url = `${restBase}/projects/${encodedProject}/issues/${encodeURIComponent(
    input.issueIid
  )}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.token}`,
    },
    body: JSON.stringify({
      labels: input.labels.join(","),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to update labels (${response.status} ${response.statusText}).`
    );
  }

  const payload = (await response.json()) as { labels?: string[] };
  return (
    payload.labels?.map((title) => ({
      title,
    })) ?? []
  );
}

export async function updateIssue(
  projectFullPath: string,
  credentials: GitLabCredentials,
  input: UpdateIssueInput
): Promise<GitLabIssue> {
  if (!input.issueIid) {
    throw new Error("Missing issueIid.");
  }

  const restBase = resolveRestEndpoint(credentials.apiUrl);
  const encodedProject = encodeURIComponent(projectFullPath);
  const url = `${restBase}/projects/${encodedProject}/issues/${encodeURIComponent(
    input.issueIid
  )}`;

  const body: Record<string, unknown> = {};
  if (input.title) body.title = input.title;
  if (input.description !== undefined) body.description = input.description;
  if (input.labels) body.labels = input.labels.join(",");
  if (input.stateEvent) body.state_event = input.stateEvent;
  if (input.healthStatus) body.health_status = input.healthStatus;
  if (input.timeEstimateSeconds !== undefined)
    body.time_estimate = input.timeEstimateSeconds;

  if (Object.keys(body).length === 0) {
    throw new Error("No fields provided to update.");
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to update issue (${response.status} ${response.statusText}).`
    );
  }

  const payload = (await response.json()) as {
    id: number | string;
    iid: number | string;
    title: string;
    description?: string | null;
    state: string;
    web_url: string;
    created_at: string;
    updated_at: string;
    author?: { id: number; name: string; username: string };
    assignees?: Array<{ id: number; name: string; username: string }>;
    labels?: string[];
    health_status?: string | null;
    time_stats?: { time_estimate?: number | null };
  };

  return {
    id: String(payload.id),
    iid: String(payload.iid),
    title: payload.title,
    description: payload.description,
    state: payload.state,
    webUrl: payload.web_url,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    author: payload.author
      ? {
          id: String(payload.author.id),
          name: payload.author.name,
          username: payload.author.username,
        }
      : undefined,
    assignees:
      payload.assignees?.map((assignee) => ({
        id: String(assignee.id),
        name: assignee.name,
        username: assignee.username,
      })) ?? [],
    labels:
      payload.labels?.map((name) => ({
        title: name,
      })) ?? [],
    healthStatus:
      payload.health_status as "on_track" | "needs_attention" | "at_risk" | undefined,
    timeEstimate: payload.time_stats?.time_estimate ?? null,
  };
}
