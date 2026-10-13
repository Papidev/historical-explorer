import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const base = process.argv[2] ?? "origin/main";
const previous = JSON.parse(
  execFileSync("git", ["show", `${base}:package.json`], { encoding: "utf8" }),
);
const current = JSON.parse(readFileSync("package.json", "utf8"));
const previousReleaseFiles = execFileSync(
  "git",
  ["ls-tree", "--name-only", base, "--", "CHANGELOG.md", ".changeset/config.json"],
  { encoding: "utf8" },
).trim();
const initialRelease = !previousReleaseFiles && readdirSync(".changeset").includes("config.json");
const changed = execFileSync("git", ["diff", "--name-only", base, "--"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

assert.deepEqual(
  readdirSync(".changeset").filter((file) => file.endsWith(".md") && file !== "README.md"),
  [],
  "Run pnpm release:version and commit the version and changelog before merging.",
);

if (current.version === previous.version && !initialRelease) {
  assert.ok(
    changed.every(
      (file) =>
        file.startsWith("docs/") ||
        file.startsWith(".agents/") ||
        [
          "README.md",
          "AGENTS.md",
          ".changeset/README.md",
          ".github/dependabot.yml",
          ".github/workflows/test.yml",
          ".github/workflows/dependabot-release.yml",
          "scripts/check-release.mjs",
          "scripts/prepare-dependabot-release.mjs",
        ].includes(file),
    ),
    "Application changes require a version increment. Run pnpm changeset, then pnpm release:version.",
  );
  console.log("Documentation or release automation only: no release required.");
} else {
  const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  assert.match(previous.version, versionPattern);
  assert.match(current.version, versionPattern);
  const [major, minor, patch] = previous.version.split(".").map(Number);
  assert.ok(
    (initialRelease && current.version === previous.version) ||
      [`${major}.${minor}.${patch + 1}`, `${major}.${minor + 1}.0`, `${major + 1}.0.0`].includes(
        current.version,
      ),
    `Prepare exactly one patch, minor, or major increment from ${previous.version}. Update from main if another release has merged.`,
  );
  const changelog = readFileSync("CHANGELOG.md", "utf8");
  assert.equal(
    changelog.split("\n").find((line) => line.startsWith("## ")),
    `## ${current.version}`,
    "The newest changelog entry must match package.json.",
  );
  const previousChangelog = execFileSync(
    "git",
    ["ls-tree", "--name-only", base, "--", "CHANGELOG.md"],
    {
      encoding: "utf8",
    },
  ).trim();
  if (previousChangelog) {
    const previousBody = execFileSync("git", ["show", `${base}:CHANGELOG.md`], {
      encoding: "utf8",
    });
    assert.ok(
      changelog.includes(previousBody.slice(previousBody.indexOf("\n## ") + 1).trim()),
      "Preserve the existing release history when updating the changelog.",
    );
  }
  console.log(
    initialRelease
      ? `Initial tracked release ready: ${current.version}`
      : `Release ready: ${previous.version} → ${current.version}`,
  );
}
