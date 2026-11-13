# Design

## Context

- The Pages project `green-max-chat` already exists as a **direct-upload** project. It was created on 2026-11-13 with `wrangler pages project create --force`, because current Wrangler sends new Pages projects to Workers unless forced. Cloudflare can't convert a direct-upload project to its built-in Git integration, so CI has to upload builds with `wrangler pages deploy`. Because the project already exists, later `wrangler pages` commands target it directly and never need `--force`.
- The repo is private on GitHub (`leerman/green`). Work lands through PRs into `main`. There is no `.github/` directory yet.
- The four checks are npm scripts: `typecheck`, `test`, `lint`, `lint:fsd`. All pass on `main` today. `build` runs `tsc -b && vite build`.
- The only build-time configuration is `VITE_GREEN_API_URL`, which is optional and defaults to `https://api.green-api.com`. The bundle contains no secrets, because users enter GREEN-API credentials at runtime.
- `engines` requires Node `>=22.18.0`. Development uses Node 24.

## Goals / Non-Goals

**Goals:**
- A single workflow file that is easy to read top to bottom: checks, then deploy.
- The same Wrangler version and the same deploy command locally and in CI.
- No third-party actions beyond `actions/checkout` and `actions/setup-node`.

**Non-Goals:**
- Custom domains, Cloudflare Access protection for previews, or cleanup of old previews.
- Migrating the project to Workers static assets.
- Release tagging, changelogs, or deploy approvals (GitHub Environments with reviewers).

## Decisions

### One workflow, `.github/workflows/ci.yml`, with two jobs

```
on: pull_request (-> main), push (main)

  checks (matrix: typecheck | test | lint | lint:fsd, fail-fast: false)
     |
     | needs: checks   (any failure -> deploy skipped)
     v
  deploy
     - push to main      -> --branch main            (production)
     - same-repo PR      -> --branch <head_ref>      (preview) + PR comment
     - fork PR           -> job skipped by `if:`
```

- **The checks run as a matrix of four jobs.** Each check then shows as its own status on the PR, as the spec requires, and `fail-fast: false` makes all four report even when one fails. The alternative was one job with four steps, which saves three `npm ci` runs. But that job stops at the first failure and gives the PR a single status, which hides the other results. With `setup-node`'s npm cache, the extra installs take seconds.
- **There is a single `deploy` job that branches on the event**, not separate production and preview jobs. The build and upload steps are the same for both. Only the `--branch` value, the permissions, and the PR comment step differ.
- **`deploy` declares `needs: checks`.** It runs only if every matrix leg succeeded, which is how a failing check blocks the deploy.

### Trigger is `pull_request`, never `pull_request_target`

With `pull_request`, GitHub withholds repository secrets from runs triggered by forks, so credentials can't leak to forked code by construction. The `deploy` job also has `if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`. With that guard, fork PRs show the deploy as *skipped*, not *failed with a missing token*. `pull_request_target` would hand secrets to code from the PR, so it's ruled out.

### Concurrency

- Production: `group: deploy-production`, `cancel-in-progress: false`. Deploys queue up and none is interrupted halfway.
- Preview: `group: preview-${{ github.event.pull_request.number }}`, `cancel-in-progress: true`. A new commit cancels the stale run for the same PR.
- Concurrency is set at the workflow level with an expression that picks the group by event, so the checks for a superseded PR commit are cancelled too.

### Wrangler is a pinned dev dependency, with an `npm run deploy` script

- `wrangler` goes into `devDependencies`, locked to an exact version (the 4.x currently in use, 4.161.0) by `package-lock.json`.
- The script is `"deploy": "wrangler pages deploy dist --project-name green-max-chat"`.
- CI calls `npm run deploy -- --branch <name> --commit-hash <sha> --commit-message <msg>`. It always passes `--branch` explicitly, because PR runs check out a detached merge ref, so Wrangler can't infer the branch from git.
- Locally, `npm run build && npm run deploy` infers the branch from the current git branch: `main` deploys production and any other branch deploys a preview. The README documents this.
- The alternative, `cloudflare/wrangler-action`, provides URL outputs but pins the version only in the YAML, and it doesn't give a local command. See the exploration notes: an unpinned `npx` is what caused today's surprise with Workers delegation.

### Reading the deploy URL

The deploy step sets `WRANGLER_OUTPUT_FILE_DIRECTORY` to a temporary directory. Wrangler writes ND-JSON output entries there, and a `pages-deploy-detailed` entry carries the deployment URL and the branch alias URL. A short shell step extracts them with `jq` and passes them to the comment step as step outputs. If the entry's exact field names differ in the pinned Wrangler version, the fallback is to `grep` the `https://*.green-max-chat.pages.dev` URL out of stdout. Task 3.3 verifies this against the real output.

### PR comment via `gh`, with a hidden marker

The comment body starts with `<!-- cf-pages-preview -->`. The step uses `gh api` to find an existing PR comment that contains the marker, then `PATCH`es it or `POST`s a new one. That avoids a third-party sticky-comment action, and the `gh` CLI is preinstalled on the runners. Only this step needs `pull-requests: write`. The rest of the workflow runs with `contents: read`.

### Node version from `.nvmrc`

`.nvmrc` contains `24`, and every job uses `actions/setup-node` with `node-version-file: .nvmrc` and `cache: npm`. That keeps CI on the same major version as development and inside `engines`.

### Build-time configuration

The `deploy` job sets `VITE_GREEN_API_URL: ${{ vars.VITE_GREEN_API_URL }}`. When the repo variable isn't set, the value is empty and the app falls back to its built-in default, which `src/shared/config/env.ts` already does with `||`.

## Risks / Trade-offs

- [The API token is too broad, or leaks] → Create a token scoped only to *Account > Cloudflare Pages > Edit* for this account. It's stored as a repo secret and only the `deploy` job references it. Never use the local OAuth login in CI.
- [Preview URLs are public] → Accepted. The app ships no secrets, and every user has to bring their own GREEN-API credentials. Cloudflare Access can be added later if needed.
- [A Wrangler upgrade changes Pages behavior again] → The version is locked. Upgrades happen only in a PR, and that PR's own preview deploy exercises the new version before it reaches `main`.
- [Deploying a merge ref instead of the PR head] → A `pull_request` run builds GitHub's test merge of the PR into `main`. That's the more accurate thing to preview. `--commit-hash` records the head SHA so the Pages dashboard links to the PR commit.
- [Secrets aren't configured yet when the workflow lands] → The first `push` to `main` after merging would fail the deploy job. The README lists the secrets, and the tasks put creating them before the merge.

## Migration Plan

1. The repository owner creates `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (and optionally `VITE_GREEN_API_URL`) in the GitHub repo settings.
2. Open the PR that adds the workflow. The PR itself has to produce a preview and a comment, which checks the preview path.
3. Merge it. The push to `main` has to deploy production, which checks the production path.
4. Rollback: if a bad build reaches production, use *Rollback* on an earlier deployment in the Cloudflare Pages dashboard, or revert the commit on `main`. To disable CI deploys, delete or disable the workflow. Manual `npm run deploy` keeps working.
