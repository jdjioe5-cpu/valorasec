# Changesets in ValoraSec

Welcome to Changesets! This directory tracks change descriptions and intent for automated semantic versioning and changelog generation across our monorepo packages.

## How to add a changeset

When you make changes to one or more packages in this repository, run:

```bash
pnpm changeset
```

Follow the prompts to select affected packages, choose SemVer bump type (`major`, `minor`, `patch`), and write a summary of changes.

## How to version packages

To consume pending changesets and update package version numbers and `CHANGELOG.md` files:

```bash
pnpm version:packages
```

## How to publish releases

To publish updated packages:

```bash
pnpm release
```
