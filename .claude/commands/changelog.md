Update CHANGELOG.md for the next release.

## What to do

1. **Read the version files** to know what version is being released:
   - `src-tauri/tauri.conf.json` → `"version"` field (Tauri canonical version)
   - `package.json` → `"version"` field (must always match tauri.conf.json)
   - If they don't match, flag it and ask which is correct before continuing.

2. **Read `CHANGELOG.md`** to understand the current content and the format already in use.

3. **Read recent commits** since the last git tag to understand what changed:
   ```bash
   git log $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD --oneline
   ```
   If there are no tags yet (first release), read all commits: `git log --oneline`.

4. **Read the staged/unstaged diff** to catch anything not yet committed:
   ```bash
   git diff HEAD
   ```

5. **Draft a new changelog entry** using this exact format (Keep a Changelog):

   ```markdown
   ## [X.Y.Z] — YYYY-MM-DD

   ### Added
   - New features

   ### Changed
   - Changes to existing behaviour

   ### Fixed
   - Bug fixes

   ### Removed
   - Removed features
   ```

   Rules:
   - Only include sections that have entries — omit empty sections entirely
   - Use plain English, present tense imperative ("Add", "Fix", "Remove")
   - Group related items together
   - Keep each entry to one line, no trailing period
   - The date is today's date

6. **Insert the new entry** directly below the `## [Unreleased]` heading (or at the top if there is no Unreleased section), keeping the existing entries below it.

7. **Update the bottom reference links** in CHANGELOG.md. They follow this pattern:
   ```
   [Unreleased]: https://github.com/slothlabs/cloudorbit/compare/vX.Y.Z...HEAD
   [X.Y.Z]: https://github.com/slothlabs/cloudorbit/compare/vPREV...vX.Y.Z
   ```
   Add the new version link and update `[Unreleased]` to compare from the new tag.

8. **Show the user the draft entry** and ask for confirmation before writing it. After confirmation, write the file.

9. **Remind the user** that both version files must be bumped before tagging:
   - `src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
   - `package.json` → `"version": "X.Y.Z"`
   And that the git tag must match: `git tag vX.Y.Z && git push origin vX.Y.Z`
