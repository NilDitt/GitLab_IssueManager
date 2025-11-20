import { NextResponse } from "next/server";
import {
  createIssue,
  fetchProjectIssues,
  fetchProjectLabels,
  updateIssue,
  updateIssueLabels,
  type CreateIssueInput,
  type GitLabCredentials,
  type UpdateIssueInput,
  type UpdateIssueLabelsInput,
} from "../../lib/gitlab";

export const dynamic = "force-dynamic";

type IssueAction =
  | "listIssues"
  | "createIssue"
  | "updateLabels"
  | "fetchLabels"
  | "updateIssue";

interface IssueRequestPayload extends GitLabCredentials {
  action: IssueAction;
  projectPath: string;
  data?: unknown;
}

export async function POST(request: Request) {
  let payload: IssueRequestPayload;

  try {
    payload = (await request.json()) as IssueRequestPayload;
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  if (!payload?.projectPath) {
    return NextResponse.json(
      { error: "Field 'projectPath' is required." },
      { status: 400 }
    );
  }

  if (!payload?.token) {
    return NextResponse.json(
      { error: "Field 'token' is required." },
      { status: 400 }
    );
  }

  const credentials: GitLabCredentials = {
    apiUrl: payload.apiUrl,
    token: payload.token,
  };

  try {
    switch (payload.action) {
      case "listIssues": {
        const result = await fetchProjectIssues(
          payload.projectPath,
          credentials
        );
        return NextResponse.json(result);
      }
      case "fetchLabels": {
        const labels = await fetchProjectLabels(
          payload.projectPath,
          credentials
        );
        return NextResponse.json({ labels });
      }
      case "createIssue": {
        const data = payload.data as CreateIssueInput | undefined;
        if (!data?.title) {
          return NextResponse.json(
            { error: "Field 'data.title' is required for createIssue." },
            { status: 400 }
          );
        }
        const issue = await createIssue(
          payload.projectPath,
          credentials,
          data
        );
        return NextResponse.json(issue);
      }
      case "updateLabels": {
        const data = payload.data as UpdateIssueLabelsInput | undefined;
        if (!data?.issueIid) {
          return NextResponse.json(
            { error: "Field 'data.issueIid' is required for updateLabels." },
            { status: 400 }
          );
        }
        const labels = await updateIssueLabels(
          payload.projectPath,
          credentials,
          data
        );
        return NextResponse.json({ labels });
      }
      case "updateIssue": {
        const data = payload.data as UpdateIssueInput | undefined;
        if (!data?.issueIid) {
          return NextResponse.json(
            { error: "Field 'data.issueIid' is required for updateIssue." },
            { status: 400 }
          );
        }
        const issue = await updateIssue(
          payload.projectPath,
          credentials,
          data
        );
        return NextResponse.json(issue);
      }
      default:
        return NextResponse.json(
          { error: "Unsupported action." },
          { status: 400 }
        );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error encountered.";
    console.error("[gitlab-issue-manager]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
