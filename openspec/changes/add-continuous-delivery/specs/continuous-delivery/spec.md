# Spec Delta

## Purpose

Defines when and how the app reaches Cloudflare Pages: merges to `main` deploy production, pull requests get preview deploys, a deploy happens only after every check passes, and Cloudflare credentials never reach untrusted code.

## ADDED Requirements

### Requirement: Run checks on pull requests and main
For every pull request targeting `main`, on each new commit, and for every push to `main`, the system SHALL run four checks: type-check, unit tests, lint, and the Feature-Sliced Design structure check. It SHALL report each check's result on the commit in GitHub.

#### Scenario: Pull request opened
- **WHEN** a pull request targeting `main` is opened or receives a new commit
- **THEN** the type-check, unit tests, lint, and FSD structure check run against that commit, and their results appear on the pull request

#### Scenario: Push to main
- **WHEN** a commit is pushed to `main`, including by merging a pull request
- **THEN** the same four checks run against that commit

### Requirement: Deploy only after all checks pass
The system SHALL deploy, to production or to a preview, only a commit for which all four checks passed. When any check fails, the system SHALL NOT deploy that commit, and whatever was previously deployed SHALL stay in place.

#### Scenario: A check fails on main
- **WHEN** a commit pushed to `main` fails any of the four checks
- **THEN** no production deploy runs, and the production site keeps serving the last successfully deployed build

#### Scenario: A check fails on a pull request
- **WHEN** a pull request commit fails any of the four checks
- **THEN** no preview deploy runs for that commit

### Requirement: Deploy production from main
When all checks pass on a commit pushed to `main`, the system SHALL build the app and deploy it as the production deployment of the `green-max-chat` Cloudflare Pages project, served at `https://green-max-chat.pages.dev`.

#### Scenario: Merge to main
- **WHEN** a pull request is merged into `main` and all checks pass on the merge commit
- **THEN** `https://green-max-chat.pages.dev` serves the build of that commit

#### Scenario: Consecutive merges
- **WHEN** two commits are pushed to `main` in quick succession
- **THEN** their production deploys run one after another, not concurrently, and production ends up serving the later commit

### Requirement: Deploy a preview for each pull request
When all checks pass on a commit of a pull request from this repository, the system SHALL build the app and deploy it as a preview of the `green-max-chat` Pages project under the pull request's branch name. The preview SHALL NOT change the production deployment.

#### Scenario: Preview deployed
- **WHEN** all checks pass on a commit of a pull request from branch `feat/x`
- **THEN** the build of that commit is served at the branch alias URL for `feat/x` on `green-max-chat.pages.dev`, and `https://green-max-chat.pages.dev` is unchanged

#### Scenario: New commit replaces the preview
- **WHEN** a new commit is pushed to a pull request while an earlier preview deploy for it is still running
- **THEN** the earlier run is cancelled, and the branch alias serves the newest commit once its deploy completes

### Requirement: Post the preview URL on the pull request
After a preview deploys, the system SHALL show its URL in a comment on the pull request. Each pull request SHALL have at most one such comment, updated in place on each new preview deploy.

#### Scenario: First preview
- **WHEN** the first preview deploy for a pull request completes
- **THEN** a comment on the pull request shows the preview URL

#### Scenario: Later preview
- **WHEN** another preview deploy for the same pull request completes
- **THEN** the existing comment is updated to show the new deploy, and no second comment is added

### Requirement: Keep credentials away from untrusted code
The system SHALL make Cloudflare credentials available only to runs for pushes to `main` and for pull requests whose source branch is in this repository. Pull requests from forks SHALL still run the checks, without credentials and without a preview deploy.

#### Scenario: Pull request from a fork
- **WHEN** a pull request is opened from a fork of the repository
- **THEN** the checks run, no preview deploy runs, and the run has no access to the Cloudflare credentials

#### Scenario: Pull request from this repository
- **WHEN** a pull request is opened from a branch in this repository and its checks pass
- **THEN** a preview deploy runs with access to the Cloudflare credentials
