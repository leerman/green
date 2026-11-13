# Proposal

## Why

The app is deployed to Cloudflare Pages (`green-max-chat`) by hand, from a local machine, with whatever Wrangler version `npx` happens to fetch. Nothing runs the type-check, tests, or lint before a deploy, and a PR can't be tried on a live URL before it merges. Merging to `main` should be what deploys production, and only after every check passes.

## What Changes

- Add GitHub Actions workflows that run `typecheck`, `test`, `lint`, and `lint:fsd` on every pull request and on every push to `main`.
- On a push to `main`, build the app and deploy it to the production branch of the `green-max-chat` Pages project, only if all four checks pass.
- On a pull request, build the app and deploy a preview to the branch alias `<branch>.green-max-chat.pages.dev`, only if all four checks pass. Post the preview URL as a single comment on the PR and update that comment on each new deploy.
- Never expose Cloudflare credentials to pull requests opened from forks.
- Add `wrangler` as a pinned dev dependency and an `npm run deploy` script, so local and CI deploys use the same Wrangler version and command.
- Add `.nvmrc` so CI and local development use the same Node.js version.
- Document the required GitHub secrets and the deploy flow in the README.

## Capabilities

### New Capabilities

- `continuous-delivery`: when and how the app reaches Cloudflare Pages. It covers production deploys from `main`, preview deploys for pull requests, checks that must pass before any deploy, and how credentials are kept away from untrusted code.

### Modified Capabilities

None. App behavior does not change.

## Impact

- New files: `.github/workflows/` (CI and deploy workflows), `.nvmrc`.
- `package.json` / `package-lock.json`: new dev dependency `wrangler`, new `deploy` script.
- `README.md`: deployment section.
- GitHub repository settings: secrets `CLOUDFLARE_API_TOKEN` (scoped to Cloudflare Pages: Edit) and `CLOUDFLARE_ACCOUNT_ID`, and an optional `VITE_GREEN_API_URL` variable. The repository owner has to create these by hand.
- Cloudflare: uses the existing direct-upload Pages project `green-max-chat`. No new Cloudflare resources.
