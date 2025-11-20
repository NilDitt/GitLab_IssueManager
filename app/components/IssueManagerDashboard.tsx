"use client";

import { FormEvent, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { COLORS, GITLAB_CONFIG } from "../config/issue-config";
import type {
  GitLabIssue,
  IssueLabel,
  ProjectIssuesResult,
  IssueAssignee,
} from "../lib/gitlab";

interface FormState {
  projectPath: string;
  token: string;
  apiUrl: string;
}

interface CreateFormState {
  title: string;
  description: string;
  labels: string[];
}

const DEFAULT_FORM: FormState = {
  projectPath: GITLAB_CONFIG.PROJECT_PATH,
  token: GITLAB_CONFIG.TOKEN,
  apiUrl: GITLAB_CONFIG.API_URL,
};

const DEFAULT_CREATE: CreateFormState = {
  title: "",
  description: "",
  labels: [],
};

export function IssueManagerDashboard() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE);
  const [createMode, setCreateMode] = useState<"form" | "json">("form");
  const [createJson, setCreateJson] = useState<string>(
    JSON.stringify({ title: "New issue title", description: "Details…", labels: [] }, null, 2)
  );
  const [editingIssue, setEditingIssue] = useState<GitLabIssue | null>(null);
  const [editMode, setEditMode] = useState<"form" | "json">("form");
  const [editForm, setEditForm] = useState<CreateFormState>(DEFAULT_CREATE);
  const [editJson, setEditJson] = useState<string>("");
  const [projectData, setProjectData] = useState<ProjectIssuesResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [filterState, setFilterState] = useState<"all" | "opened" | "closed">(
    "all"
  );
  const [sortBy, setSortBy] = useState<
    "updated_desc" | "updated_asc" | "created_desc" | "created_asc" | "title_asc"
  >("updated_desc");

  const filteredIssues = useMemo(() => {
    if (!projectData) return [];
    const needle = filter.trim().toLowerCase();
    const searchFiltered = projectData.issues.filter((issue: GitLabIssue) => {
      if (filterState !== "all" && issue.state !== filterState) {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        issue.title,
        issue.description ?? "",
        issue.state,
        ...issue.labels.map((label: IssueLabel) => label.title),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
    const sorted = [...searchFiltered].sort((a, b) => {
      const toTime = (value: string) => new Date(value).getTime();
      switch (sortBy) {
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
    return sorted;
  }, [projectData, filter, filterState, sortBy]);

  const summaryCards = useMemo(() => {
    if (!projectData) return [];
    const open = projectData.issues.filter(
      (issue: GitLabIssue) => issue.state === "opened"
    )
      .length;
    const closed = projectData.issues.filter(
      (issue: GitLabIssue) => issue.state === "closed"
    )
      .length;
    const labels = projectData.labels.length;
    const assignees = new Set(
      projectData.issues.flatMap((issue: GitLabIssue) =>
        issue.assignees.map((assignee: IssueAssignee) => assignee.username)
      )
    ).size;
    return [
      { title: "Issues", value: String(projectData.issues.length), detail: "All pages returned" },
      { title: "Open", value: String(open), detail: "State: opened" },
      { title: "Closed", value: String(closed), detail: "State: closed" },
      { title: "Labels", value: String(labels), detail: "Project labels" },
      { title: "Assignees", value: String(assignees), detail: "Unique assignees" },
    ];
  }, [projectData]);

  const callApi = async (payload: object) => {
    const response = await fetch("/api/gitlab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? response.statusText);
    }
    return (await response.json()) as unknown;
  };

  const openEditIssue = (issue: GitLabIssue) => {
    setEditingIssue(issue);
    setEditMode("form");
    setEditForm({
      title: issue.title,
      description: issue.description ?? "",
      labels: issue.labels.map((label) => label.title),
    });
    setEditJson(
      JSON.stringify(
        {
          title: issue.title,
          description: issue.description ?? "",
          labels: issue.labels.map((label) => label.title),
        },
        null,
        2
      )
    );
    setEditError(null);
  };

  const closeEditIssue = () => {
    setEditingIssue(null);
    setEditError(null);
    setEditJson("");
    setEditForm(DEFAULT_CREATE);
    setIsEditing(false);
  };

  const handleLoadIssues = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = (await callApi({
        action: "listIssues",
        projectPath: form.projectPath.trim(),
        token: form.token.trim(),
        apiUrl: form.apiUrl.trim(),
      })) as ProjectIssuesResult;
      setProjectData(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load issues.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateIssue = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    if (createMode === "form" && !createForm.title.trim()) {
      setCreateError("Title is required.");
      return;
    }

    let payload: { title: string; description?: string; labels?: string[] };

    if (createMode === "json") {
      try {
        const parsed = JSON.parse(createJson);
        if (!parsed?.title || typeof parsed.title !== "string") {
          throw new Error("JSON must include a string 'title'.");
        }
        payload = {
          title: parsed.title,
          description:
            typeof parsed.description === "string"
              ? parsed.description
              : undefined,
          labels: Array.isArray(parsed.labels)
            ? parsed.labels.filter((label: unknown) => typeof label === "string")
            : undefined,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Invalid JSON payload.";
        setCreateError(message);
        return;
      }
    } else {
      payload = {
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        labels: createForm.labels,
      };
    }

    setIsCreating(true);
    setError(null);
    try {
      await callApi({
        action: "createIssue",
        projectPath: form.projectPath.trim(),
        token: form.token.trim(),
        apiUrl: form.apiUrl.trim(),
        data: payload,
      });
      setCreateForm(DEFAULT_CREATE);
      setCreateJson(
        JSON.stringify(
          { title: "New issue title", description: "Details…", labels: [] },
          null,
          2
        )
      );
      await handleRefreshIssues();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create issue.";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingIssue) return;
    setEditError(null);

    let payload: { title?: string; description?: string; labels?: string[] };

    if (editMode === "json") {
      try {
        const parsed = JSON.parse(editJson);
        if (!parsed?.title || typeof parsed.title !== "string") {
          throw new Error("JSON must include a string 'title'.");
        }
        payload = {
          title: parsed.title,
          description:
            typeof parsed.description === "string"
              ? parsed.description
              : undefined,
          labels: Array.isArray(parsed.labels)
            ? parsed.labels.filter((label: unknown) => typeof label === "string")
            : undefined,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Invalid JSON payload.";
        setEditError(message);
        return;
      }
    } else {
      if (!editForm.title.trim()) {
        setEditError("Title is required.");
        return;
      }
      payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        labels: editForm.labels,
      };
    }

    setIsEditing(true);
    try {
      const updated = (await callApi({
        action: "updateIssue",
        projectPath: form.projectPath.trim(),
        token: form.token.trim(),
        apiUrl: form.apiUrl.trim(),
        data: {
          issueIid: editingIssue.iid,
          ...payload,
        },
      })) as GitLabIssue;

      setProjectData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          issues: prev.issues.map((issue) =>
            issue.id === updated.id ? updated : issue
          ),
        };
      });
      setEditNotice(`Issue #${updated.iid} updated successfully.`);
      closeEditIssue();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to update issue.";
      setEditError(message);
    } finally {
      setIsEditing(false);
    }
  };

  const handleRefreshIssues = async () => {
    if (!projectData) return;
    try {
      const result = (await callApi({
        action: "listIssues",
        projectPath: form.projectPath.trim(),
        token: form.token.trim(),
        apiUrl: form.apiUrl.trim(),
      })) as ProjectIssuesResult;
      setProjectData(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to refresh issues.";
      setError(message);
    }
  };

  return (
    <div style={styles.page}>
      <section style={styles.intro}>
        <h1 style={styles.title}>GitLab Issue Manager</h1>
        <p style={styles.subtitle}>
          Load issues from your GitLab project, manage labels, and create new
          issues without leaving this dashboard. All requests stay in your
          browser and proxy through this Next.js app.
        </p>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Project access</h2>
        <form style={styles.form} onSubmit={handleLoadIssues}>
          <label style={styles.field}>
            <span style={styles.label}>Project full path</span>
            <input
              style={styles.input}
              type="text"
              required
              value={form.projectPath}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, projectPath: event.target.value }))
              }
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Access token</span>
            <input
              style={styles.input}
              type="password"
              required
              value={form.token}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, token: event.target.value }))
              }
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>GraphQL endpoint</span>
            <input
              style={styles.input}
              type="url"
              value={form.apiUrl}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, apiUrl: event.target.value }))
              }
            />
          </label>

          <div style={styles.actionsRow}>
            <button style={styles.submit} type="submit" disabled={isLoading}>
              {isLoading ? "Loading…" : "Load issues"}
            </button>
            {projectData ? (
              <button
                style={styles.secondaryButton}
                type="button"
                onClick={handleRefreshIssues}
                disabled={isLoading}
              >
                Refresh
              </button>
            ) : null}
          </div>
        </form>
        {error ? <p style={styles.error}>{error}</p> : null}
      </section>

      {projectData ? (
        <>
          <section style={styles.panel}>
            <header style={styles.reportHeader}>
              <div>
                <h2 style={styles.panelTitle}>{projectData.project.name}</h2>
                <p style={styles.meta}>
                  <a
                    href={projectData.project.webUrl}
                    style={styles.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {projectData.project.webUrl}
                  </a>
                </p>
              </div>
              <div style={styles.meta}>
                {projectData.issues.length} issues • {projectData.labels.length} labels
              </div>
            </header>

            <div style={styles.cards}>
              {summaryCards.map((card) => (
                <article key={card.title} style={styles.card}>
                  <span style={styles.cardLabel}>{card.title}</span>
                  <span style={styles.cardValue}>{card.value}</span>
                  <span style={styles.cardDetail}>{card.detail}</span>
                </article>
              ))}
            </div>

            <div style={styles.gridTwoCols}>
              <div style={styles.formPanel}>
                <h3 style={styles.chartTitle}>Create issue</h3>
                <div style={styles.toggleRow}>
                  <button
                    type="button"
                    style={{
                      ...styles.toggleButton,
                      ...(createMode === "form"
                        ? styles.toggleButtonActive
                        : styles.toggleButtonInactive),
                    }}
                    onClick={() => setCreateMode("form")}
                  >
                    Form
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.toggleButton,
                      ...(createMode === "json"
                        ? styles.toggleButtonActive
                        : styles.toggleButtonInactive),
                    }}
                    onClick={() => setCreateMode("json")}
                  >
                    JSON
                  </button>
                </div>
                <form style={styles.form} onSubmit={handleCreateIssue}>
                  {createMode === "form" ? (
                    <>
                      <label style={styles.field}>
                        <span style={styles.label}>Title</span>
                        <input
                          style={styles.input}
                          type="text"
                          required
                          value={createForm.title}
                          onChange={(event) =>
                            setCreateForm((prev) => ({
                              ...prev,
                              title: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Description</span>
                        <textarea
                          style={{ ...styles.input, minHeight: "120px" }}
                          value={createForm.description}
                          onChange={(event) =>
                            setCreateForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <LabelSelector
                        available={projectData.labels}
                        selected={createForm.labels}
                        onChange={(labels) =>
                          setCreateForm((prev) => ({ ...prev, labels }))
                        }
                        title="Labels"
                      />
                    </>
                  ) : (
                    <label style={styles.field}>
                      <span style={styles.label}>Issue JSON</span>
                      <textarea
                        style={{ ...styles.input, minHeight: "220px" }}
                        value={createJson}
                        onChange={(event) => setCreateJson(event.target.value)}
                        required
                      />
                      <span style={styles.meta}>
                        Provide an object like{" "}
                        <code>
                          {"{ title, description?, labels?: string[] }"}
                        </code>
                        .
                      </span>
                    </label>
                  )}
                  {createError ? (
                    <p style={styles.error}>{createError}</p>
                  ) : null}
                  <button type="submit" style={styles.submit} disabled={isCreating}>
                    {isCreating ? "Creating…" : "Create issue"}
                  </button>
                </form>
              </div>
              <div style={styles.formPanel}>
                <h3 style={styles.chartTitle}>Raw JSON</h3>
                <details style={styles.detailsBox}>
                  <summary style={styles.summaryToggle}>View payload</summary>
                  <pre style={styles.jsonPreview}>
{JSON.stringify(projectData.issues, null, 2)}
                  </pre>
                </details>
              </div>
            </div>

              <div style={styles.issueTable}>
              <div style={styles.tableToolbar}>
                <h3 style={styles.tableTitle}>Issues</h3>
                {editNotice ? <div style={styles.successBox}>{editNotice}</div> : null}
                <div style={styles.toolbarRow}>
                  <input
                    style={{ ...styles.input, maxWidth: "320px" }}
                    type="search"
                    placeholder="Search title, state, label, description…"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  />
                  <label style={styles.filterField}>
                    <span style={styles.label}>State</span>
                    <select
                      style={styles.select}
                      value={filterState}
                      onChange={(event) =>
                        setFilterState(event.target.value as "all" | "opened" | "closed")
                      }
                    >
                      <option value="all">All</option>
                      <option value="opened">Opened</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label style={styles.filterField}>
                    <span style={styles.label}>Sort</span>
                    <select
                      style={styles.select}
                      value={sortBy}
                      onChange={(event) =>
                        setSortBy(
                          event.target
                            .value as
                            | "updated_desc"
                            | "updated_asc"
                            | "created_desc"
                            | "created_asc"
                            | "title_asc"
                        )
                      }
                    >
                      <option value="updated_desc">Updated ↓</option>
                      <option value="updated_asc">Updated ↑</option>
                      <option value="created_desc">Created ↓</option>
                      <option value="created_asc">Created ↑</option>
                      <option value="title_asc">Title A→Z</option>
                    </select>
                  </label>
                  <span style={styles.meta}>
                    Showing {filteredIssues.length} of {projectData.issues.length}
                  </span>
                </div>
              </div>
              <div style={styles.tableHead}>
                <span style={{ flex: 2 }}>Title</span>
                <span style={{ flex: 1 }}>State</span>
                <span style={{ flex: 2 }}>Labels</span>
                <span style={{ flex: 1 }}>Assignees</span>
                <span style={{ flex: 1 }}>Updated</span>
                <span style={{ flex: 1 }}>Actions</span>
              </div>
              {filteredIssues.map((issue: GitLabIssue) => {
                return (
                  <div key={issue.id} style={styles.tableRow}>
                    <span style={{ flex: 2 }}>
                      <a
                        href={issue.webUrl}
                        style={styles.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        #{issue.iid} {issue.title}
                      </a>
                      {issue.description ? (
                        <div style={styles.description}>
                          {issue.description.slice(0, 180)}
                          {issue.description.length > 180 ? "…" : ""}
                        </div>
                      ) : null}
                    </span>
                    <span style={{ flex: 1 }}>
                      <Badge label={issue.state} />
                    </span>
                    <span style={{ flex: 2 }}>
                      <div style={styles.labelStack}>
                        {issue.labels.length ? (
                          issue.labels.map((label) => (
                            <LabelChip key={label.title} label={label.title} />
                          ))
                        ) : (
                          <span style={styles.meta}>No labels</span>
                        )}
                      </div>
                    </span>
                    <span style={{ flex: 1 }}>
                      {issue.assignees.length
                        ? issue.assignees
                            .map((assignee: IssueAssignee) => assignee.name)
                            .join(", ")
                        : "—"}
                    </span>
                    <span style={{ flex: 1 }}>
                      {new Date(issue.updatedAt).toLocaleDateString()}
                    </span>
                    <span style={{ flex: 1 }}>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => openEditIssue(issue)}
                      >
                        Edit issue
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {editingIssue ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                Edit issue #{editingIssue.iid}
              </h3>
              <button
                type="button"
                style={styles.closeButton}
                onClick={closeEditIssue}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={styles.toggleRow}>
              <button
                type="button"
                style={{
                  ...styles.toggleButton,
                  ...(editMode === "form"
                    ? styles.toggleButtonActive
                    : styles.toggleButtonInactive),
                }}
                onClick={() => setEditMode("form")}
              >
                Form
              </button>
              <button
                type="button"
                style={{
                  ...styles.toggleButton,
                  ...(editMode === "json"
                    ? styles.toggleButtonActive
                    : styles.toggleButtonInactive),
                }}
                onClick={() => setEditMode("json")}
              >
                JSON
              </button>
            </div>

            <form style={styles.form} onSubmit={handleSubmitEdit}>
              {editMode === "form" ? (
                <>
                  <label style={styles.field}>
                    <span style={styles.label}>Title</span>
                    <input
                      style={styles.input}
                      type="text"
                      required
                      value={editForm.title}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.label}>Description</span>
                    <textarea
                      style={{ ...styles.input, minHeight: "140px" }}
                      value={editForm.description}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <LabelSelector
                    available={projectData?.labels ?? []}
                    selected={editForm.labels}
                    onChange={(labels) =>
                      setEditForm((prev) => ({ ...prev, labels }))
                    }
                    title="Labels"
                  />
                </>
              ) : (
                <label style={styles.field}>
                  <span style={styles.label}>Issue JSON</span>
                  <textarea
                    style={{ ...styles.input, minHeight: "220px" }}
                    value={editJson}
                    onChange={(event) => setEditJson(event.target.value)}
                    required
                  />
                  <span style={styles.meta}>
                    Include keys like{" "}
                    <code>{"{ title, description?, labels?: string[] }"}</code>.
                  </span>
                </label>
              )}

              {editError ? <p style={styles.error}>{editError}</p> : null}

              <div style={styles.modalActions}>
                <button
                  type="submit"
                  style={styles.submit}
                  disabled={isEditing}
                >
                  {isEditing ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={closeEditIssue}
                  disabled={isEditing}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  const palette = COLORS.PRIMARY;
  const color =
    palette[Math.abs(hashString(label)) % palette.length] ?? "#38bdf8";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.15rem 0.45rem",
        borderRadius: "999px",
        background: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        fontSize: "0.85rem",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
}

function LabelChip({ label }: { label: string }) {
  const palette = COLORS.BADGE;
  const color =
    palette[Math.abs(hashString(label)) % palette.length] ?? "#38bdf8";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.2rem 0.5rem",
        borderRadius: "0.6rem",
        background: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        fontSize: "0.85rem",
      }}
    >
      {label}
    </span>
  );
}

function LabelSelector({
  available,
  selected,
  onChange,
  title = "Labels",
}: {
  available: IssueLabel[];
  selected: string[];
  onChange: (labels: string[]) => void;
  title?: string;
}) {
  const toggle = (label: string) => {
    if (selected.includes(label)) {
      onChange(selected.filter((item) => item !== label));
    } else {
      onChange([...selected, label]);
    }
  };

  return (
    <div style={styles.field}>
      <span style={styles.label}>{title}</span>
      <div style={styles.labelSelector}>
        {available.length ? (
          available.map((label: IssueLabel) => {
            const active = selected.includes(label.title);
            return (
              <button
                key={label.title}
                type="button"
                onClick={() => toggle(label.title)}
                style={{
                  ...styles.labelChip,
                  ...(active
                    ? styles.labelChipActive
                    : styles.labelChipInactive),
                }}
                title={label.description ?? label.title}
              >
                {label.title}
              </button>
            );
          })
        ) : (
          <span style={styles.meta}>No labels in project yet.</span>
        )}
      </div>
    </div>
  );
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1.25rem 1rem 2rem",
    maxWidth: "1280px",
    margin: "0 auto",
    color: "#e2e8f0",
    width: "100%",
  },
  intro: {
    display: "grid",
    gap: "0.75rem",
  },
  title: {
    margin: 0,
    fontSize: "2.5rem",
  },
  subtitle: {
    margin: 0,
    color: "rgba(226, 232, 240, 0.85)",
    maxWidth: "70ch",
    lineHeight: 1.6,
  },
  panel: {
    background: "rgba(15, 23, 42, 0.7)",
    borderRadius: "0.75rem",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    backdropFilter: "blur(10px)",
  },
  panelTitle: {
    margin: 0,
    fontSize: "1.35rem",
  },
  form: {
    display: "grid",
    gap: "1rem",
  },
  field: {
    display: "grid",
    gap: "0.35rem",
  },
  label: {
    fontSize: "0.85rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148, 163, 184, 0.95)",
  },
  input: {
    padding: "0.75rem 0.9rem",
    borderRadius: "0.75rem",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    background: "rgba(15, 23, 42, 0.6)",
    color: "#f8fafc",
    fontSize: "1rem",
    width: "100%",
  },
  actionsRow: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  submit: {
    padding: "0.85rem 1.2rem",
    borderRadius: "0.75rem",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "1rem",
    background:
      "linear-gradient(90deg, rgba(56, 189, 248, 0.9), rgba(251, 113, 133, 0.9))",
    color: "#0f172a",
  },
  secondaryButton: {
    padding: "0.8rem 1.1rem",
    borderRadius: "0.75rem",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    background: "rgba(15, 23, 42, 0.6)",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    margin: 0,
    padding: "0.75rem 1rem",
    borderRadius: "0.75rem",
    background: "rgba(248, 113, 113, 0.15)",
    border: "1px solid rgba(248, 113, 113, 0.35)",
    color: "#fecaca",
  },
  reportHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "1rem",
  },
  meta: {
    margin: 0,
    color: "rgba(148, 163, 184, 0.95)",
  },
  link: {
    color: "#38bdf8",
    textDecoration: "none",
  },
  cards: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  card: {
    background: "rgba(15, 23, 42, 0.6)",
    borderRadius: "0.6rem",
    padding: "0.9rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    flex: "1 1 180px",
    minWidth: "160px",
  },
  cardLabel: {
    fontSize: "0.9rem",
    color: "rgba(148, 163, 184, 0.9)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  cardValue: {
    fontSize: "1.8rem",
    fontWeight: 700,
  },
  cardDetail: {
    fontSize: "0.9rem",
    color: "rgba(148, 163, 184, 0.9)",
  },
  gridTwoCols: {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  },
  formPanel: {
    background: "rgba(15, 23, 42, 0.6)",
    borderRadius: "0.75rem",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    padding: "0.9rem",
    display: "grid",
    gap: "0.65rem",
  },
  chartTitle: {
    margin: 0,
    fontSize: "1rem",
  },
  detailsBox: {
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "0.65rem",
    padding: "0.6rem 0.8rem",
    background: "rgba(15, 23, 42, 0.5)",
  },
  summaryToggle: {
    cursor: "pointer",
    color: "#38bdf8",
  },
  jsonPreview: {
    marginTop: "0.5rem",
    maxHeight: "240px",
    overflow: "auto",
    background: "rgba(15, 23, 42, 0.8)",
    borderRadius: "0.65rem",
    padding: "0.75rem",
    color: "#cbd5e1",
    fontSize: "0.85rem",
  },
  issueTable: {
    display: "grid",
    gap: "0.75rem",
    marginTop: "1rem",
  },
  tableTitle: {
    margin: 0,
    fontSize: "1.1rem",
  },
  tableHead: {
    display: "flex",
    gap: "1rem",
    padding: "0.5rem 0.75rem",
    borderRadius: "0.6rem",
    background: "rgba(148, 163, 184, 0.08)",
    fontSize: "0.85rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "rgba(148, 163, 184, 0.9)",
  },
  tableRow: {
    display: "flex",
    gap: "1rem",
    padding: "0.85rem 0.75rem",
    borderRadius: "0.6rem",
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
  },
  description: {
    color: "rgba(148, 163, 184, 0.9)",
    fontSize: "0.9rem",
    marginTop: "0.25rem",
  },
  labelSelector: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    marginTop: "0.25rem",
  },
  labelChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    borderRadius: "999px",
    border: "1px solid transparent",
    padding: "0.35rem 0.8rem",
    fontSize: "0.85rem",
    cursor: "pointer",
    transition: "all 0.2s ease",
    background: "rgba(15, 23, 42, 0.5)",
  },
  labelChipActive: {
    background: "rgba(56, 189, 248, 0.18)",
    borderColor: "rgba(56, 189, 248, 0.5)",
    color: "#38bdf8",
  },
  labelChipInactive: {
    borderColor: "rgba(148, 163, 184, 0.25)",
    color: "rgba(226, 232, 240, 0.85)",
  },
  labelStack: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.35rem",
  },
  toggleRow: {
    display: "inline-flex",
    gap: "0.5rem",
    background: "rgba(15, 23, 42, 0.6)",
    borderRadius: "0.65rem",
    padding: "0.3rem",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    width: "fit-content",
  },
  toggleButton: {
    padding: "0.45rem 0.9rem",
    borderRadius: "0.55rem",
    border: "1px solid transparent",
    cursor: "pointer",
    background: "transparent",
    color: "#e2e8f0",
    fontWeight: 600,
  },
  toggleButtonActive: {
    background: "rgba(56, 189, 248, 0.18)",
    borderColor: "rgba(56, 189, 248, 0.5)",
    color: "#38bdf8",
  },
  toggleButtonInactive: {
    borderColor: "rgba(148, 163, 184, 0.2)",
    color: "rgba(226, 232, 240, 0.85)",
  },
  select: {
    ...({
      padding: "0.65rem 0.8rem",
      borderRadius: "0.65rem",
      border: "1px solid rgba(148, 163, 184, 0.3)",
      background: "rgba(15, 23, 42, 0.6)",
      color: "#f8fafc",
      fontSize: "0.95rem",
    } as CSSProperties),
  },
  filterRow: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  filterField: {
    display: "grid",
    gap: "0.25rem",
    minWidth: "160px",
  },
  tableToolbar: {
    display: "grid",
    gap: "0.5rem",
  },
  toolbarRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    alignItems: "flex-end",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.65)",
    backdropFilter: "blur(6px)",
    display: "grid",
    placeItems: "center",
    padding: "1rem",
    zIndex: 1000,
  },
  modal: {
    width: "min(720px, 100%)",
    background: "rgba(15, 23, 42, 0.95)",
    borderRadius: "0.9rem",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    padding: "1rem",
    boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
    display: "grid",
    gap: "0.6rem",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.5rem",
  },
  modalTitle: {
    margin: 0,
    fontSize: "1.1rem",
  },
  closeButton: {
    background: "transparent",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    color: "#e2e8f0",
    borderRadius: "0.5rem",
    padding: "0.25rem 0.65rem",
    cursor: "pointer",
    fontSize: "1.1rem",
    lineHeight: 1,
  },
  modalActions: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  successBox: {
    padding: "0.4rem 0.75rem",
    borderRadius: "0.6rem",
    background: "rgba(74, 222, 128, 0.15)",
    border: "1px solid rgba(74, 222, 128, 0.35)",
    color: "#4ade80",
    fontSize: "0.95rem",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
  },
};
