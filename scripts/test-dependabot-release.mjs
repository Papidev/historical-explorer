import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { prepareRelease } from "./prepare-dependabot-release.mjs";

for (const scenario of ["workflow", "old workflow release", "lockfile", "package and workflow"]) {
  test(scenario, () => {
    const repository = mkdtempSync(resolve(tmpdir(), "dependabot-test-"));
    const git = (...args) =>
      execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
    const write = (file, content) => writeFileSync(resolve(repository, file), content);
    try {
      git("init", "-b", "main");
      git("config", "user.name", "Release test");
      git("config", "user.email", "release-test@example.com");
      for (const directory of [".changeset", ".github/workflows", "scripts"]) {
        mkdirSync(resolve(repository, directory), { recursive: true });
      }
      copyFileSync(".changeset/config.json", resolve(repository, ".changeset/config.json"));
      copyFileSync("scripts/check-release.mjs", resolve(repository, "scripts/check-release.mjs"));
      write(".gitignore", "node_modules\n");
      write(
        "package.json",
        JSON.stringify(
          { name: "historical-explorer", version: "0.2.7", dependencies: { react: "19.3.0" } },
          null,
          2,
        ) + "\n",
      );
      write("CHANGELOG.md", "# historical-explorer\n\n## 0.2.7\n\nExisting release.\n");
      write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
      write(".github/workflows/ci.yml", "steps:\n  - uses: actions/checkout@v5\n");
      git("add", ".");
      git("commit", "-m", "Initial release");
      git("checkout", "-b", "dependency-update");
      if (scenario !== "lockfile") {
        write(".github/workflows/ci.yml", "steps:\n  - uses: actions/checkout@v7\n");
      }
      if (scenario === "old workflow release") {
        write(
          "package.json",
          JSON.stringify(
            { name: "historical-explorer", version: "0.2.8", dependencies: { react: "19.3.0" } },
            null,
            2,
          ) + "\n",
        );
        write(
          "CHANGELOG.md",
          "# historical-explorer\n\n## 0.2.8\n\nUpdate GitHub Actions.\n\n## 0.2.7\n\nExisting release.\n",
        );
      }
      if (scenario === "package and workflow") {
        write(
          "package.json",
          JSON.stringify(
            { name: "historical-explorer", version: "0.2.7", dependencies: { react: "19.3.1" } },
            null,
            2,
          ) + "\n",
        );
      }
      if (scenario === "lockfile" || scenario === "package and workflow") {
        write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n# Updated dependencies\n");
      }
      git("add", ".");
      git("commit", "-m", "Dependency update");
      const head = git("rev-parse", "HEAD");
      git("checkout", "main");
      if (scenario === "old workflow release") {
        write(
          "package.json",
          JSON.stringify(
            { name: "historical-explorer", version: "0.2.9", dependencies: { react: "19.3.0" } },
            null,
            2,
          ) + "\n",
        );
        write(
          "CHANGELOG.md",
          "# historical-explorer\n\n## 0.2.9\n\nNew main release.\n\n## 0.2.7\n\nExisting release.\n",
        );
        git("add", ".");
        git("commit", "-m", "Advance main release");
      }
      const base = git("rev-parse", "HEAD");
      symlinkSync(resolve("node_modules"), resolve(repository, "node_modules"), "dir");
      const prepared = prepareRelease(repository, base, head);
      const manifest = JSON.parse(git("show", `${prepared}:package.json`));
      assert.equal(
        manifest.version,
        scenario === "old workflow release" ? "0.2.9" : scenario === "workflow" ? "0.2.7" : "0.2.8",
      );
      assert.equal(
        manifest.dependencies.react,
        scenario === "package and workflow" ? "19.3.1" : "19.3.0",
      );
      if (scenario === "workflow" || scenario === "old workflow release") {
        assert.equal(git("show", `${prepared}:CHANGELOG.md`), git("show", `${base}:CHANGELOG.md`));
        assert.equal(git("diff", "--name-only", base, prepared), ".github/workflows/ci.yml");
      }
      assert.equal(
        prepareRelease(repository, base, prepared),
        prepared,
        "Repeated preparation must be idempotent",
      );
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });
}
