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
Set defaults in `app/config/issue-config.ts` (API URL, project path, token) or paste your token into the form at runtime.

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
