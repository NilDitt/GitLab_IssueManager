# GitLab Issue Manager

A Next.js dashboard plus terminal CLI to list, filter, label, and create GitLab issues using the GraphQL/REST APIs with the same styling as the Time Tracker app.

## Features

- Load all issues for a project (paginated on the GitLab side, collected here).
- Filter/search issues locally and view their JSON payload.
- Create new issues with description and labels.
- Edit labels inline for each issue.
- Use a Node.js CLI to create, list, and update issues directly from the terminal (including JSON dumps for scripting).
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

## Environment configuration

1. Duplicate `.env.example` to `.env` and fill in:
  - `NEXT_PUBLIC_GITLAB_PROJECT_PATH` / `NEXT_PUBLIC_GITLAB_TOKEN` for the dashboard defaults.
  - `GITLAB_PROJECT_PATH`, `GITLAB_TOKEN`, and optionally `GITLAB_API_URL` / `GITLAB_REST_URL` for the CLI.
2. Both CLI commands (`create-issue`, `issue-cli`) automatically load `.env`, so you usually do **not** need to pass `--token`/`--project` unless you deliberately override them.
3. Never commit real credentials; use `.env.example` to document expected values.

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

Every `list` invocation prints the human-friendly summary/table **and** the full JSON payload of the matching issues. Add `--json` if you prefer JSON-only output for scripting or piping to other tools.

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
- `--estimate <hours>` converts to GitLab’s `time_estimate` seconds field (GitLab’s REST API currently ignores this when updating existing issues, but it remains reflected when creating new ones)
- `--state close|reopen`
- `--data-file <path>` provide a JSON body; CLI flags override the file contents
- `--json` outputs the raw GitLab response

Run `npm run issue-cli -- --help` to view the full argument list anytime.

### Full CLI guide

1. **Common setup**
   - Ensure `.env` contains `GITLAB_PROJECT_PATH` and `GITLAB_TOKEN` (or export them in the shell).
   - Optionally set `GITLAB_API_URL` / `GITLAB_REST_URL` if you use self-managed GitLab.
   - All commands work via `npm run issue-cli -- …` (list/update) or `npm run create-issue -- …` (create).

2. **Creating issues** (`npm run create-issue`)
   - Minimal example:
     ```bash
     npm run create-issue -- --title "My bug" --description "Steps to reproduce" \
       --labels "Bug,Implementierung & Tests,M,priority::1" --health needs_attention --estimate 4
     ```
   - Use `--project`, `--token`, `--api-url` to override envs when targeting another space.
   - `--estimate` accepts hours (floats); the script converts them to seconds for GitLab’s `time_estimate`.

3. **Listing issues** (`npm run issue-cli -- list …`)
   - Combine filters freely:
     ```bash
     # opened issues containing "frontend" sorted by creation date
     npm run issue-cli -- list --state opened --filter frontend --sort created_desc --limit 10
     ```
   - Output formats:
     - Default: summary + table + trailing JSON payload of matching issues.
     - `--json`: JSON only (useful for `jq`, `tee`, etc.).
     - Example piping the JSON into `jq` to print titles:
       ```bash
       npm run issue-cli -- list --state opened --json | jq -r '.issues[].title'
       ```
   - Pagination: `--page-size` adjusts GraphQL fetch size (default 50) if your project has many issues.

4. **Updating issues** (`npm run issue-cli -- update …`)
   - Field flags mirror the dashboard edit form. Example:
     ```bash
     npm run issue-cli -- update --iid 71 --title "Wiki Navigation: final polish" \
       --labels "Projektmanagement,S,priority::2" --state close --json
     ```
   - JSON form mode: place the payload in a file and pass `--data-file path.json`. CLI flags still override values from the file.
   - Limitations: GitLab’s REST API currently ignores `time_estimate` updates (it works during creation), so use the web UI/time-tracking API to adjust estimates for existing issues.

5. **Advanced tips**
   - Set `GITLAB_TOKEN` and `GITLAB_PROJECT_PATH` once in `.env` so both CLIs work without extra flags.
   - Use the `--json` output together with tools like `jq`, `rg`, or custom scripts to automate dashboards (e.g., `jq '.issues | length'`).
   - The `list` command prints labels in the JSON under `labels` (per project) and `issues[].labels` (per issue), making it easy to audit missing taxonomies.

## Issue workflow reference

Need guidance on crafting the “perfect” issue (Beschreibung → Definition of Done → Checkliste, required labels, etc.)? See [`issueguide.md`](./issueguide.md) for the full workflow, label taxonomy, and branch/time-tracking expectations.

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
