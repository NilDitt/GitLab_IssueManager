# GitLab Issue Manager

A Next.js dashboard to list, filter, label, and create GitLab issues using the GraphQL/REST APIs with the same styling as the Time Tracker app.

## Features

- Load all issues for a project (paginated on the GitLab side, collected here).
- Filter/search issues locally and view their JSON payload.
- Create new issues with description and labels.
- Edit labels inline for each issue.
- Dark glassy UI matching the Time Tracker.

## Prerequisites

- Node.js 18+
- A GitLab personal access token with `api` scope (needed to read/write issues).
- GitLab project full path (`group/subgroup/project`).

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Set defaults in `app/config/issue-config.ts` (API URL, project path). To prefill the form, add entries to `.env` (see `.env.example`):

```
NEXT_PUBLIC_GITLAB_PROJECT_PATH=group/subgroup/project
NEXT_PUBLIC_GITLAB_TOKEN=your-pat-with-api-scope
```

Values are only read on the client for convenience; do not commit real tokens.

## CLI: create an issue from the terminal

You can create an issue without running the UI:

```bash
# set envs (or place them in .env)
GITLAB_PROJECT_PATH=group/subgroup/project
GITLAB_TOKEN=your-pat-with-api-scope

npm run create-issue -- --title "Bug" --description "Details" --labels "bug,ui" --health on_track --estimate 2
```

Flags:

- `--title` (required), `--description` (optional)
- `--labels "label1,label2"`
- `--health on_track|needs_attention|at_risk`
- `--estimate <hours>` (numeric, converted to seconds)
- `--project`, `--token`, `--api-url` can override envs

> Both CLI commands automatically load a `.env` file in the project root, so the
> same `NEXT_PUBLIC_*` values you use for the dashboard are picked up by the
> terminal tools without additional flags.

## CLI: list, filter, and update issues

Use the same filters and fields as the dashboard without leaving the terminal:

```bash
# list open frontend tickets sorted by latest update
npm run issue-cli -- list --state opened --sort updated_desc --filter "frontend"

# output JSON for scripting
npm run issue-cli -- list --json --limit 5

# update an issue using JSON form mode
echo '{"title":"New title","labels":["ui","bug"]}' > ./tmp-issue.json
npm run issue-cli -- update --iid 123 --data-file ./tmp-issue.json --health needs_attention --estimate 3
```

Shared flags mirror the UI fields: `--project`, `--token`, `--api-url`, and `--rest-url`. You can also rely on `GITLAB_PROJECT_PATH`, `GITLAB_TOKEN`, and `GITLAB_API_URL` environment variables.

Every `list` invocation prints the human-friendly summary/table **and** the full JSON payload of the matching issues. Add `--json` if you prefer JSON-only output for scripting.

List filters:

- `--filter <text>` searches title, description, and labels (like the dashboard search box)
- `--state all|opened|closed`
- `--sort updated_desc|updated_asc|created_desc|created_asc|title_asc`
- `--limit <n>` to trim the table output
- `--json` to suppress the summary/table and print only the structured payload

Update options (matching the edit form + JSON mode):

- `--iid <number>` (required)
- `--title`, `--description`
- `--labels "foo,bar"`
- `--health on_track|needs_attention|at_risk`
- `--estimate <hours>` converts to `time_estimate`
- `--state close|reopen`
- `--data-file <path>` provide a JSON body; CLI flags override the file contents
- `--json` outputs the raw GitLab response

## Production build

```bash
npm run build
npm start
```

## Deployment notes

- The app relies on Next.js API routes (`/api/gitlab`) to proxy your token to GitLab. Static hosting (e.g., GitHub Pages) cannot run these routes. Use a serverful target such as Vercel, Netlify functions, or your own Node host.
- If you must use GitHub Pages, you would need to export a static build and point the API calls to a separate backend that implements the same `/api/gitlab` contract. By default, `next export` will not work because API routes are required.

## Project structure

```
app/
  api/gitlab/route.ts     # Proxy for list/create/update issue actions
  components/IssueManagerDashboard.tsx
  config/issue-config.ts  # Default GitLab settings and colors
  lib/gitlab.ts           # GitLab client helpers (GraphQL + REST)
  globals.css             # Shared styling
```

## Scripts

- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run start` – run built app
- `npm run lint` – Next lint rules
- `npm run type-check` – TypeScript only
