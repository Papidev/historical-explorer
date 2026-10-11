import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Build a release using trusted main tooling; PR files are data, never executed.
export const prepareRelease = (repository, base, head) => {
  const git = (...args) => execFileSync("git", args, { cwd: repository, encoding: "utf8" });
  const ancestor = git("merge-base", base, head).trim();
  const original = JSON.parse(git("show", `${ancestor}:package.json`));
  const updated = JSON.parse(git("show", `${head}:package.json`));
  const current = JSON.parse(git("show", `${base}:package.json`));
  const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  const notes = [];

  for (const key of new Set([...Object.keys(original), ...Object.keys(updated)])) {
    if (key === "version" || sections.includes(key)) continue;
    assert.deepEqual(updated[key], original[key], `Unexpected package.json change: ${key}`);
  }
  for (const section of sections) {
    for (const name of new Set([
      ...Object.keys(original[section] ?? {}),
      ...Object.keys(updated[section] ?? {}),
    ])) {
      const before = original[section]?.[name];
      const after = updated[section]?.[name];
      if (before === after) continue;
      assert.ok(
        current[section]?.[name] === before || current[section]?.[name] === after,
        `Conflicting dependency update on main: ${name}`,
      );
      if (after === undefined) delete current[section]?.[name];
      else (current[section] ??= {})[name] = after;
      notes.push(`Update ${name} from ${before ?? "absent"} to ${after ?? "absent"}.`);
    }
  }

  const files = git("diff", "--name-only", ancestor, head).trim().split("\n").filter(Boolean);
  assert.ok(files.length > 0, "No dependency changes found.");
  assert.ok(
    files.every(
      (file) =>
        ["package.json", "pnpm-lock.yaml", "CHANGELOG.md"].includes(file) ||
        /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file),
    ),
    "Only dependency manifests, lockfiles, workflows and generated release files are supported.",
  );
  const directory = mkdtempSync(resolve(tmpdir(), "dependabot-release-"));
  const checkout = resolve(directory, "checkout");
  try {
    git("worktree", "add", "--detach", checkout, base);
    const patch = git(
      "diff",
      "--binary",
      ancestor,
      head,
      "--",
      ".",
      ":(exclude)package.json",
      ":(exclude)CHANGELOG.md",
    );
    if (patch) execFileSync("git", ["apply", "--3way"], { cwd: checkout, input: patch });
    writeFileSync(resolve(checkout, "package.json"), `${JSON.stringify(current, null, 2)}\n`);
    symlinkSync(resolve(repository, "node_modules"), resolve(checkout, "node_modules"), "dir");
    assert.ok(
      files.includes("pnpm-lock.yaml") ||
        files.some((file) => file.startsWith(".github/workflows/")),
      "Expected a Dependabot lockfile or GitHub Actions update.",
    );
    writeFileSync(
      resolve(checkout, ".changeset/dependabot-release.md"),
      `---\n${JSON.stringify(current.name)}: patch\n---\n\n${notes.join("\n") || "Update GitHub Actions dependencies."}\n`,
    );
    execFileSync(
      process.execPath,
      [resolve(repository, "node_modules/@changesets/cli/bin.js"), "version"],
      {
        cwd: checkout,
        stdio: "inherit",
      },
    );
    execFileSync(process.execPath, [resolve(repository, "scripts/check-release.mjs"), base], {
      cwd: checkout,
      stdio: "inherit",
    });
    execFileSync("git", ["add", "--all"], { cwd: checkout });
    const tree = execFileSync("git", ["write-tree"], { cwd: checkout, encoding: "utf8" }).trim();
    if (tree === git("rev-parse", `${head}^{tree}`).trim()) return head;
    // A merge commit keeps both the Dependabot change and the current main history.
    return git(
      "commit-tree",
      tree,
      "-p",
      head,
      "-p",
      base,
      "-m",
      "Prepare dependency patch release [dependabot skip] [skip ci]",
    ).trim();
  } finally {
    git("worktree", "remove", "--force", checkout);
    rmSync(directory, { recursive: true, force: true });
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repository = process.env.GITHUB_REPOSITORY;
  assert.ok(repository, "GITHUB_REPOSITORY is required.");
  const api = (...args) => JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8" }));
  if (process.argv[2] === "list") {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    const pulls = event.pull_request
      ? [event.pull_request]
      : api(
          `repos/${repository}/pulls?state=open&base=main&per_page=100`,
          "--paginate",
          "--slurp",
        ).flat();
    const numbers = pulls
      .filter(
        (pr) =>
          pr.user.login === "dependabot[bot]" &&
          pr.state === "open" &&
          pr.base.ref === "main" &&
          pr.head.repo?.full_name === repository &&
          (!event.workflow_run ||
            (event.workflow_run.head_repository?.full_name === repository &&
              event.workflow_run.head_branch === pr.head.ref)),
      )
      .map((pr) => pr.number);
    console.log(JSON.stringify(numbers));
  } else {
    assert.match(process.argv[2] ?? "", /^\d+$/, "Provide a PR number.");
    const pr = api(`repos/${repository}/pulls/${process.argv[2]}`);
    assert.equal(pr.user.login, "dependabot[bot]");
    assert.equal(pr.state, "open");
    assert.equal(pr.base.ref, "main");
    assert.equal(pr.head.repo?.full_name, repository);
    execFileSync("git", ["fetch", "origin", "main", `refs/heads/${pr.head.ref}`], {
      stdio: "inherit",
    });
    const base = execFileSync("git", ["rev-parse", "origin/main"], { encoding: "utf8" }).trim();
    const commit = prepareRelease(process.cwd(), base, pr.head.sha);
    if (commit !== pr.head.sha) {
      // Normal push rejects concurrent changes; never overwrite a newer bot/human commit.
      execFileSync("git", ["push", "origin", `${commit}:refs/heads/${pr.head.ref}`], {
        stdio: "inherit",
      });
    } else console.log("Dependency release is already prepared.");
    // [skip ci] suppresses the approval-required pull_request run from the bot push.
    // workflow_dispatch still runs CI on the prepared release with GITHUB_TOKEN.
    execFileSync(
      "gh",
      [
        "workflow",
        "run",
        "test.yml",
        "--repo",
        repository,
        "--ref",
        pr.head.ref,
        "-f",
        `release_base=${base}`,
      ],
      { stdio: "inherit" },
    );
  }
}
