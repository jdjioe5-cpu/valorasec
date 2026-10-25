# Versioning and Automated Release Strategy

This document outlines the versioning strategy, commit conventions, changelog generation, and release automation workflow for the ValoraSec monorepo.

---

## 1. Semantic Versioning (SemVer)

All packages in the ValoraSec repository follow [Semantic Versioning 2.0.0](https://semver.org/):

$$\text{Version} = \text{MAJOR}.\text{MINOR}.\text{PATCH}$$

- **MAJOR**: Incompatible API changes or breaking contract interfaces.
- **MINOR**: Backward-compatible new functionality or enhancements.
- **PATCH**: Backward-compatible bug fixes, security patches, or maintenance updates.

### Monorepo Packages in Scope

- `@valorasec/shared`: Core types and cross-package schemas.
- `@valorasec/analyzer`: Static analysis rules and AST parsing engine.
- `@valorasec/sdk`: Developer client library.
- `@valorasec/api`: NestJS backend service.
- `@valorasec/web`: Next.js web application.
- `@valorasec/ui`: Shared design system and React component primitives.
- `@valorasec/docs`: Project documentation and guides.
- `@valorasec/test-utils`: Testing fixtures, factories, and mocks.

---

## 2. Conventional Commits & Git Hooks

Commit messages must adhere to the [Conventional Commits](https://www.conventionalcommits.org/) standard. This is automatically enforced locally by **Husky** and **Commitlint** during `git commit`.

### Commit Message Format

```text
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Allowed Types

| Type       | Description                                                 |
| :--------- | :---------------------------------------------------------- |
| `feat`     | A new feature or capability                                 |
| `fix`      | A bug fix or defect correction                              |
| `docs`     | Documentation only changes                                  |
| `style`    | Code formatting, missing semi-colons (no code logic change) |
| `refactor` | Code restructuring without fixing a bug or adding a feature |
| `perf`     | Performance optimization                                    |
| `test`     | Adding missing tests or correcting existing tests           |
| `build`    | Changes to build tools, dependencies, or compilers          |
| `ci`       | Changes to CI configuration files and scripts               |
| `chore`    | Maintenance tasks and non-src file updates                  |
| `revert`   | Reverts a previous commit                                   |

---

## 3. Changeset Workflow

We use [`@changesets/cli`](https://github.com/changesets/changesets) for managing package version bumps and changelog generation across our pnpm workspace.

### Step 1: Adding a Changeset

Whenever you make changes intended for a future release, run:

```bash
pnpm changeset
```

Follow the interactive CLI prompts:

1. Select which packages should be versioned.
2. Choose the bump severity (`major`, `minor`, `patch`).
3. Write a concise summary describing the changes.

A new Markdown file will be generated under `.changeset/`. Commit this file alongside your code.

### Step 2: Applying Changesets & Updating Versions

To consume all pending changesets, bump `package.json` versions across packages, and update `CHANGELOG.md`:

```bash
pnpm version:packages
```

### Step 3: Publishing Packages

To publish updated packages to the registry:

```bash
pnpm release
```

---

## 4. Release Automation & GitHub Releases

### GitHub Release Workflow

1. When changesets are merged into the `main` branch, a GitHub Action creates or updates a release pull request (`Version Packages`).
2. Once merged, automated tags (`vX.Y.Z`) are created for released packages.
3. GitHub Releases are generated automatically, containing notes and changelog summaries extracted from merged changesets.

### Pre-Release Checklist

Before finalizing a release tag:

- [ ] All unit and integration tests pass: `pnpm test`.
- [ ] Linting checks pass cleanly: `pnpm run lint`.
- [ ] End-to-end tests pass: `pnpm test:e2e`.
- [ ] Monorepo builds successfully: `pnpm run build`.
- [ ] No pending untracked changesets remain.
