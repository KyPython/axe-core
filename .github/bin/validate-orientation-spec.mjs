import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.join(directory, "evidence");
const require = createRequire(path.join(process.cwd(), "package.json"));
const ts = require("typescript");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const contractBytes = readFileSync(
  path.join(directory, "orientation-acceptance.json"),
);
assert.equal(hash(contractBytes), process.env.ORIENTATION_CONTRACT_SHA256);
const contract = JSON.parse(contractBytes);
const source = process.env.SOURCE_SHA;
const phase = process.env.ORIENTATION_PHASE;
assert.match(source, /^[0-9a-f]{40}$/);
assert.ok(["baseline", "candidate"].includes(phase));
assert.equal(git("rev-parse", "HEAD"), source);
git("merge-base", "--is-ancestor", contract.base, source);
const original = execFileSync(
  "git",
  ["show", `${contract.base}:${contract.target}`],
  { encoding: "utf8" },
);
const current = readFileSync(contract.target, "utf8");
const changes = git("diff", "--name-only", contract.base, source);

function tokens(text) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    text,
  );
  const result = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    result.push([scanner.getToken(), scanner.getTokenText()]);
  }
  return result;
}

if (phase === "baseline") {
  assert.equal(source, contract.base);
  assert.equal(changes, "");
  assert.equal(current, original);
} else {
  assert.equal(
    changes,
    contract.target,
    "Only the accepted test file may change",
  );
  const helperDeclaration =
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*axe\.testUtils\.getCheckEvaluate\(\s*(['"])css-orientation-lock\2\s*\)\s*;/g;
  const declarations = [...current.matchAll(helperDeclaration)];
  assert.equal(
    declarations.length,
    1,
    "Use the helper once with default message verification",
  );
  const binding = declarations[0][1];
  const escapedBinding = binding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalized = current
    .replace(helperDeclaration, "const check = checks['css-orientation-lock'];")
    .replace(
      new RegExp(`\\b${escapedBinding}\\.call\\b`, "g"),
      "check.evaluate.call",
    );
  assert.deepEqual(
    tokens(normalized),
    tokens(original),
    "Preserve original statements, assertions, fixtures, options and context",
  );
}

const originalFileHashes = Object.fromEntries(
  [contract.target, contract.metadata].map((file) => [
    file,
    hash(readFileSync(file)),
  ]),
);
const browser = process.env.WTR_BROWSER;
assert.ok(["chrome", "firefox"].includes(browser));
mkdirSync(evidence, { recursive: true });
const summary = {
  sourceSha: source,
  runnerSha: process.env.ORIENTATION_RUNNER_SHA,
  phase,
  browser,
  contractSha256: hash(contractBytes),
  originalFileHashes,
  observations: [],
};

function flatten(suite, parent = []) {
  const names = [...parent, suite.name].filter(Boolean);
  return [
    ...(suite.tests || []).map((test) => ({
      ...test,
      title: [...names, test.name].join(" > "),
    })),
    ...(suite.suites || []).flatMap((child) => flatten(child, names)),
  ];
}

function observe(label, omit, expectedFailureTitles) {
  const resultPath = path.join(evidence, `${label}.json`);
  rmSync(resultPath, { force: true });
  const run = spawnSync(
    "pnpm",
    [
      "exec",
      "web-test-runner",
      "--config",
      path.join(directory, "orientation-wtr.config.mjs"),
    ],
    {
      stdio: "inherit",
      timeout: 240000,
      env: {
        ...process.env,
        ORIENTATION_OMIT_INCOMPLETE: omit ? "1" : "0",
        ORIENTATION_RESULTS: resultPath,
      },
    },
  );
  assert.ifError(run.error);
  assert.equal(run.signal, null);
  const sessions = JSON.parse(readFileSync(resultPath, "utf8"));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].status, "FINISHED");
  assert.deepEqual(sessions[0].errors, [], "Unexpected runner errors");
  const tests = flatten(sessions[0].testResults);
  assert.equal(tests.length, contract.testCount);
  assert.ok(
    tests.every((test) => !test.skipped),
    "No tests may be skipped",
  );
  const failures = tests.filter((test) => !test.passed);
  const proofs = (sessions[0].logs || [])
    .flat()
    .filter(
      (value) =>
        typeof value === "string" &&
        value.startsWith("ORIENTATION_MUTATION_PROOF:"),
    )
    .map((value) =>
      JSON.parse(value.slice("ORIENTATION_MUTATION_PROOF:".length)),
    );
  assert.equal(
    proofs.length,
    omit ? contract.testCount : 0,
    "Every omission test must report verified removal and restoration",
  );
  proofs.forEach((proof, index) =>
    assert.deepEqual(proof, {
      count: index + 1,
      absentBeforeTest: true,
      absentAfterTest: true,
      restored: true,
    }),
  );
  const observation = {
    label,
    omittedIncompleteMessage: omit,
    status: run.status,
    tests: tests.length,
    mutationProofs: proofs,
    failures: failures.map((test) => ({
      title: test.title,
      message: test.error?.message,
    })),
  };
  summary.observations.push(observation);
  writeFileSync(
    path.join(evidence, "summary.json"),
    JSON.stringify(summary, null, 2),
  );
  assert.equal(run.status, expectedFailureTitles.length ? 1 : 0);
  assert.deepEqual(
    failures.map((test) => test.title).sort(),
    [...expectedFailureTitles].sort(),
  );
  for (const test of failures) {
    assert.ok(
      test.error?.message.startsWith(contract.omission.errorPrefix),
      test.error?.message,
    );
  }
}

try {
  observe("valid-before", false, []);
  observe(
    "incomplete-omitted",
    true,
    phase === "baseline" ? [] : contract.omission.candidateFailures,
  );
  observe("valid-after", false, []);
  for (const [file, originalHash] of Object.entries(originalFileHashes)) {
    assert.equal(
      hash(readFileSync(file)),
      originalHash,
      `Source file changed: ${file}`,
    );
  }
  summary.accepted = true;
} finally {
  writeFileSync(
    path.join(evidence, "summary.json"),
    JSON.stringify(summary, null, 2),
  );
}
process.stdout.write(
  `Validated ${phase} acceptance against exact source ${source} in ${browser}.\n`,
);
