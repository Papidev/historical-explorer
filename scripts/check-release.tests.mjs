import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("./check-release.mjs", import.meta.url));

for (const scenario of [
  {
    name: "runtime dependency update",
    package: { dependencies: { next: "2.0.0" } },
    success: true,
  },
  {
    name: "development dependency update",
    package: { devDependencies: { vitest: "2.0.0" } },
    success: true,
  },
  {
    name: "optional dependency update",
    package: { optionalDependencies: { sharp: "2.0.0" } },
    success: true,
  },
  {
    name: "peer dependency update",
    package: { peerDependencies: { react: "2.0.0" } },
    success: true,
  },
  {
    name: "lockfile-only update",
    files: { "pnpm-lock.yaml": "updated lockfile\n" },
    success: true,
  },
  {
    name: "Actions dependency update",
    files: { ".github/workflows/test.yml": "name: Updated CI\n" },
    success: true,
  },
  {
    name: "domain documentation update",
    files: { "CONTEXT.md": "# Domain\n\nSaving complete content publishes it.\n" },
    success: true,
  },
  {
    name: "domain documentation and source change",
    files: {
      "CONTEXT.md": "# Domain\n\nSaving complete content publishes it.\n",
      "src/app.ts": "export const value = 2;\n",
    },
    success: false,
  },
  { name: "package script change", package: { scripts: { build: "other-build" } }, success: false },
  { name: "package engine change", package: { engines: { node: "26.x" } }, success: false },
  {
    name: "dependency and source change",
    package: { dependencies: { next: "2.0.0" } },
    files: { "src/app.ts": "export const value = 2;\n" },
    success: false,
  },
  {
    name: "unreleased changelog change",
    files: { "CHANGELOG.md": "# Changelog\n\n## 1.0.0\n\nChanged\n" },
    success: false,
  },
  {
    name: "pending dependency changeset",
    files: { ".changeset/update.md": "---\napp: patch\n---\n\nUpdate dependency\n" },
    success: false,
  },
  {
    name: "application patch release",
    package: { version: "1.0.1" },
    files: {
      "src/app.ts": "export const value = 2;\n",
      "CHANGELOG.md": "# Changelog\n\n## 1.0.1\n\nFix application\n\n## 1.0.0\n\nInitial release\n",
    },
    success: true,
  },
]) {
  test(scenario.name, () => {
    const directory = mkdtempSync(join(tmpdir(), "check-release-test-"));
    try {
      const original = {
        name: "app",
        version: "1.0.0",
        scripts: { build: "build" },
        engines: { node: "24.x" },
        dependencies: { next: "1.0.0" },
        devDependencies: { vitest: "1.0.0" },
      };
      mkdirSync(join(directory, ".changeset"));
      mkdirSync(join(directory, ".github/workflows"), { recursive: true });
      mkdirSync(join(directory, "src"));
      writeFileSync(join(directory, "package.json"), JSON.stringify(original));
      writeFileSync(join(directory, ".changeset/config.json"), "{}");
      writeFileSync(
        join(directory, "CHANGELOG.md"),
        "# Changelog\n\n## 1.0.0\n\nInitial release\n",
      );
      writeFileSync(join(directory, "pnpm-lock.yaml"), "original lockfile\n");
      writeFileSync(join(directory, "src/app.ts"), "export const value = 1;\n");
      execFileSync("git", ["init", "--quiet"], { cwd: directory });
      execFileSync("git", ["add", "."], { cwd: directory });
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@example.com",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--quiet",
          "-m",
          "Initial release",
        ],
        { cwd: directory },
      );
      writeFileSync(
        join(directory, "package.json"),
        JSON.stringify({ ...original, ...scenario.package }),
      );
      for (const [path, content] of Object.entries(scenario.files ?? {})) {
        writeFileSync(join(directory, path), content);
      }
      execFileSync("git", ["add", "."], { cwd: directory });
      const result = spawnSync(process.execPath, [script, "HEAD"], {
        cwd: directory,
        encoding: "utf8",
      });
      assert.equal(result.status === 0, scenario.success, result.stdout + result.stderr);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
