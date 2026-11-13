# Tasks

## 1. Tooling

- [x] 1.1 Add `wrangler` as an exact-pinned dev dependency (`npm install -D -E wrangler@4.161.0`) and the script `"deploy": "wrangler pages deploy dist --project-name green-max-chat"` (design: Wrangler is a pinned dev dependency); verify that `npx wrangler --version` prints the pinned version from `node_modules` and that `package-lock.json` locks it
- [x] 1.2 Add `.nvmrc` containing `24` (design: Node version from `.nvmrc`); verify that `node -v` matches its major version locally and that `npm run build` still succeeds
- [ ] 1.3 Check that the local deploy path works with the pinned version: on a scratch branch, run `npm run build && npm run deploy` and confirm Wrangler deploys a preview to the branch alias (not to Workers, and without `--force`); record the exact fields of the `pages-deploy-detailed` entry Wrangler writes when `WRANGLER_OUTPUT_FILE_DIRECTORY` is set, for use in 2.3

## 2. Workflow

- [ ] 2.1 Create `.github/workflows/ci.yml` with `pull_request` (branches: `main`) and `push` (branches: `main`) triggers, workflow-level `permissions: contents: read`, the per-event concurrency group (production never cancels, previews cancel in progress), and a `checks` job: a matrix over `typecheck`, `test`, `lint`, and `lint:fsd` with `fail-fast: false`, using `actions/setup-node` with `node-version-file: .nvmrc` and `cache: npm`, then `npm ci` and `npm run <check>` (spec: Run checks on pull requests and main); verify with `actionlint` if available, otherwise by review, and in 4.1
- [ ] 2.2 Add the `deploy` job: `needs: checks`; `if:` push event or a same-repo PR (spec: Keep credentials away from untrusted code); `env` sets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `VITE_GREEN_API_URL: ${{ vars.VITE_GREEN_API_URL }}`; steps run `npm ci`, `npm run build`, then `npm run deploy -- --branch <main | head_ref> --commit-hash <sha> --commit-message <msg>`, with `--branch main` on push and `github.head_ref` and the PR head SHA on pull requests (spec: Deploy production from main, Deploy a preview for each pull request); verify by review against the spec scenarios, then in 4.1–4.2
- [ ] 2.3 Get the deploy and alias URLs from Wrangler's output file (`WRANGLER_OUTPUT_FILE_DIRECTORY` + `jq`, with the field names from 1.3) and expose them as step outputs; add a pull-request-only step with `pull-requests: write` that uses `gh api` to update the PR comment containing `<!-- cf-pages-preview -->` or create it, showing the alias URL, the deploy URL, and the short commit SHA (spec: Post the preview URL on the pull request); verify in 4.1
- [ ] 2.4 Add a "Deployment" section to `README.md`: what CI does on PRs and on `main`, the required secrets (`CLOUDFLARE_API_TOKEN` scoped to *Account > Cloudflare Pages > Edit*, `CLOUDFLARE_ACCOUNT_ID`), the optional `VITE_GREEN_API_URL` repo variable, `npm run deploy` for manual deploys (with branch inference: `main` deploys production, other branches deploy previews), and rollback through the Pages dashboard; add `npm run deploy` to the Commands table; verify by reading the README against the spec and design

## 3. Repository setup (done by the repository owner)

- [ ] 3.1 The repository owner creates a Cloudflare API token scoped to *Account > Cloudflare Pages > Edit* for account `11484df580215e96521fc542c97eb226`, and adds the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to `leerman/green` (optionally the variable `VITE_GREEN_API_URL`); verify that `gh secret list` shows both secrets

## 4. End-to-end verification

- [ ] 4.1 Open the PR for this change: confirm that four separate check statuses appear, the deploy job runs after them, the branch alias URL serves the app, exactly one preview comment appears, and a second push to the PR updates that comment instead of adding another; then push a deliberately failing commit (for example, a type error) and confirm that the failing check blocks the deploy, and revert it
- [ ] 4.2 Merge the PR: confirm that the push to `main` runs the checks and the production deploy, that `https://green-max-chat.pages.dev` serves the merge commit (its deployment appears as Production in `npx wrangler pages deployment list --project-name green-max-chat`), and that the preview comment step did not run

## Workflow follow-up

- Archive the change after 4.2 passes.
