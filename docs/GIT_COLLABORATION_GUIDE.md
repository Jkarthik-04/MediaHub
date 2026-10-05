# MediaHub Individual Git Collaboration Guide

This guide explains how every contributor should work independently while keeping the shared project stable. It does not assign phases or features to particular people.

## Branch structure

- `main` - stable, tested submission-ready code.
- `dev` - shared integration branch for completed work.
- `feature/<short-name>` - new functionality.
- `fix/<short-name>` - bug fixes.
- `docs/<short-name>` - documentation-only changes.

Do not develop directly on `main`. Avoid working directly on `dev` except for an agreed emergency correction.

## Starting a task

Before coding, create or select a GitHub issue describing the task and its acceptance criteria. Keep one branch focused on one issue.

Update local `dev` and create a branch:

```bash
git switch dev
git pull origin dev
git switch -c feature/library-search
```

Example branch names:

```text
feature/google-auth
feature/library-search
feature/tmdb-adapter
fix/progress-validation
docs/api-examples
```

## Working and committing

Make small, related changes and test them before committing.

```bash
git status
git add <specific-files>
git commit -m "feat: add paginated library search"
```

Prefer `git add <specific-files>` over `git add .` so temporary or unrelated files are not accidentally committed.

Use clear commit prefixes:

| Prefix | Use |
|---|---|
| `feat:` | New functionality |
| `fix:` | Bug correction |
| `docs:` | Documentation only |
| `test:` | Tests |
| `refactor:` | Internal change without new behavior |
| `chore:` | Setup, tooling, or maintenance |
| `ci:` | CI/CD workflow |

Never commit `.env`, API keys, OAuth secrets, database passwords, access tokens, uploaded user files, or production database backups.

## Staying updated

Before opening a pull request, update the branch with the latest `dev`:

```bash
git switch dev
git pull origin dev
git switch feature/library-search
git merge dev
```

Resolve conflicts carefully, run tests again, and commit the resolution if Git requests it. Do not use destructive commands such as `git reset --hard` to solve shared-work conflicts.

## Database migration rules

- Pull the latest `dev` before creating a Prisma migration.
- Never edit or delete a migration that teammates may already have applied.
- Create a new migration for every later schema correction.
- Include the Prisma schema, migration, seed changes, ER diagram, and data-dictionary updates in the same pull request when applicable.
- Mention migration and environment steps in the pull-request description.

## Pushing and opening a pull request

Push the feature branch:

```bash
git push -u origin feature/library-search
```

Open a pull request into `dev`, not `main`. The pull request should include:

- What was changed.
- Why it was needed.
- How it was tested.
- Screenshots for visible UI changes.
- API request/response examples for endpoint changes.
- Migration or environment instructions.
- The related GitHub issue.

At least one other contributor should review the pull request. Address review comments with additional commits, then merge only after tests and CI pass.

## After a pull request is merged

Update local branches and remove the completed local feature branch:

```bash
git switch dev
git pull origin dev
git branch -d feature/library-search
```

Deleting the local feature branch is safe only after confirming the pull request was merged.

## Releasing to `main`

When a tested group of features is ready, open a pull request from `dev` into `main`. Run the complete test suite and deployment checks before merging. Tag important stable submissions, for example:

```bash
git switch main
git pull origin main
git tag -a v1.0.0 -m "MediaHub version 1.0.0"
git push origin v1.0.0
```

## Daily checklist

1. Select one clear issue.
2. Pull the latest `dev`.
3. Create a focused feature/fix/docs branch.
4. Implement and test the change.
5. Commit small, meaningful units.
6. Merge the latest `dev` into the branch and retest.
7. Push and open a pull request into `dev`.
8. Obtain review and passing CI before merging.
9. Update local `dev` after the merge.

Following this workflow allows everyone to contribute independently without overwriting another person's work or destabilizing `main`.
