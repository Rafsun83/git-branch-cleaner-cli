# git-branch-cleaner-cli 🌿

Interactive CLI tool to bulk-delete local Git branches — with a protected list so you never accidentally remove `main`, `prod`, or your important branches.

## Install

```bash
# From npm (once published)
npm install -g git-branch-cleaner-cli

# Or use directly with npx
npx git-branch-cleaner-cli
```

## Usage

```bash
git-cleaner              # Interactive mode — pick branches to delete
git-cleaner --all        # Pre-select all deletable branches (still asks to confirm)
git-cleaner config       # Manage your protected branches list
git-cleaner --help       # Show help
```

## How it works

1. Reads your **protected list** (stored in `~/.git-cleaner.json`)
2. Shows all local branches **except** protected ones and your current branch
3. You **check the ones** you want to delete (space to toggle)
4. Confirms before deleting
5. Lets you choose `-D` (force) or `-d` (safe, merged only)

## Protected branches

Default protected: `main`, `master`, `prod`, `develop`, `staging`

Your currently checked-out branch is **always protected** during a session.

### Customize your protected list

```bash
git-cleaner config
```

This lets you add, remove, or replace the protected list. Config is saved globally at `~/.git-cleaner.json`.

You can also edit it directly:

```json
{
  "protected": ["main", "prod", "test-1", "test-2"]
}
```

## Equivalent to

```bash
git branch | grep -v -E "^\*|main|prod|my-branch" | xargs git branch -D
```

...but interactive, safer, and reusable.

## Requirements

- Node.js >= 16
- Must be run inside a Git repository

## License

MIT
