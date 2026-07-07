# Release procedure

How to cut a release of agmsg Office. Releases are versioned `vX.Y.Z`
(e.g. `v0.4.0`) with a matching git tag and a GitHub release page.

## 1. Decide the version

Loosely following semver, while the project is pre-1.0:

- **Minor** (`0.X.0`): new features or user-visible behavior changes. When a
  release contains both features and fixes, a single minor bump covers both.
- **Patch** (`0.x.Y`): bug fixes only.

Check what has landed since the last release:

```bash
git log v<last-version>..main --oneline
```

## 2. Bump the version

On an up-to-date `main`:

```bash
# edit "version" in package.json, then sync the lockfile
npm install --package-lock-only

npm run lint
npm run build

git add package.json package-lock.json
git commit -m "Bump version to X.Y.Z"
git push
```

## 3. Create the GitHub release

Create the release as a **draft** first — drafts are not publicly visible, send
no notifications, and create no tag until published, so the notes can be
reviewed (or the release abandoned) without anyone seeing it:

```bash
gh release create vX.Y.Z --draft --title "vX.Y.Z" --notes "..."
```

Review the draft (`gh release view vX.Y.Z`, or open the printed URL), then
publish it:

```bash
gh release edit vX.Y.Z --draft=false
```

Publishing creates the `vX.Y.Z` tag and makes the release public.

Release notes format (see past releases for examples):

- A `## Highlights` section with a short `###` subsection per feature area,
  written for users (what changed and why it matters), with PR links where
  useful.
- A `### Fixes` subsection for bug fixes.
- End with a full-changelog compare link:
  `**Full changelog:** https://github.com/shinshin86/agmsg-office/compare/v<prev>...vX.Y.Z`

## 4. Verify

- The release appears at
  https://github.com/shinshin86/agmsg-office/releases with the new tag.
- `git fetch --tags && git tag` shows the new `vX.Y.Z` tag.
