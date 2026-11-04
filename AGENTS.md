# axe-core — Claude Code Context

<!-- AI-GOVERNANCE:v1 | canonical source: KyPython/ai-governance/AGENTS.governance.md | do not weaken locally; change it upstream via a PR Ky approves -->
## AI Governance (mandatory for every AI agent)

Applies to every AI coding agent working in this repo: Kiro, Codex, Cursor, Grok Bot, Claude Code, Copilot, and any sub-agent they spawn. Sub-agents inherit these rules and may not weaken, relabel, bypass, or self-attest them. Repo-specific rules below this section may tighten these rules but never loosen them. Derived from `KyLamportLogic/LamportLogic` (AGENTS.md, CODEOWNERS, PR template, `.husky/`, `.claude/`, CI and secret-scan workflows).

**Merge and deploy gate.** Nothing reaches `main` or production unless both of these are true:
1. The required checks are green: the repo's own CI plus `ai-governance / verdict`. The verdict runs install plus whichever of lint, type-check, test, and build the repo defines as scripts, then policy checks (including the spec gate) and a gitleaks secret scan, all through the reusable workflow in `KyPython/ai-governance`.
2. Ky (@KyPython) merges the PR. Checks are the gate; only Ky merges.

Agents never merge, approve, or deploy their own work.

### Rules
1. **Branch + PR only.** Never push to `main`. Work on a branch such as `feat/*`, `fix/*`, `chore/*`, `docs/*`, `ci/*`, `refactor/*`, or `governance/*`, then open a PR. Do not merge it, approve it, enable auto-merge, or trigger a deploy. Ky merges.
2. **Fixed roles. Spec first: no spec, no code.** Every agent has one role, defined in `KyPython/ai-governance/roles.yml`. Ky owns that file, and the gate reads it in every repo.
   - **Spec author: Kiro (`kiro-agent[bot]`) only**, with Ky as owner override. Kiro writes specs and requirements in **spec-only PRs**, which Ky reviews and merges before any code is built from them.
   - **Coders** (Kiro's own builders, Codex `chatgpt-codex-connector[bot]`, Cursor `cursor[bot]`, Copilot, Claude Code, Grok Bot, and any other coding agent) **implement existing specs only**.
     - Coders cooperate. Each task in the spec's `tasks.md` goes to **one coder in its own PR**, and a **different agent reviews** that PR.
     - Coders never create, edit, or delete files under `specs/` or `.kiro/specs/` in a code PR. That includes Kiro when it codes.
     - Before writing code, read the spec on `main`. If none exists, stop and ask Ky to have Kiro write it.
     - Requirement sentences are the requirement. Do not paraphrase, reword, or weaken them to fit the code. If one is wrong, stop and route it back to Kiro or Ky.
   - **Approver: Ky (@KyPython)** reviews and merges. Agents never merge.
   - **Format.** A spec lives in `specs/<slug>/` or `.kiro/specs/<slug>/`, in Kiro's layout: `requirements.md` (required) plus optional `design.md` and `tasks.md`; templates are in `KyPython/ai-governance/templates/spec/`.
     - `requirements.md` gives a Spec ID and the issue, then user stories, then numbered EARS acceptance criteria with stable IDs, e.g. `GOV-1.1 WHEN <trigger> THEN the system SHALL <response>`.
   - **What the gate enforces** (`ai-governance / verdict`, no label or branch bypass):
     1. A PR that changes code must link an issue (`Closes #<n>` / `Relates to #<n>`).
     2. It must reference, with a `Spec: specs/<slug>` line in the body, a spec that **already exists on the base branch** with numbered EARS criteria.
     3. It must add or change tests whose names or comments cite the criterion IDs they verify, e.g. `it("GOV-1.1 ...")`, `# GOV-1.1`, or `test_GOV_1_1`.
     4. It must not touch spec paths.
     5. A PR that touches spec paths fails unless the PR opener and every commit's author and committer are in the spec-author role.
   - **Exemptions** apply only by the gate's explicit path rule: docs, spec and contract files, repo metadata and workflow/template config, lockfiles, and dependency-only manifest changes. Labels, branch names, and authors never exempt a PR.
   - **Limit:** git author/committer fields are self-declared, and an agent pushing with Ky's token appears as KyPython. Do not use Ky's identity to pass the role gate. That is impersonation, and it violates rule 11.
3. **Prove it green before you stop.** Run the repo's install, lint, type-check, test, and build commands locally (whichever exist). If any of them fails, fix it or report the blocker. Never say "tests pass" without running them.
4. **Tests ship with behavior changes.** Tests check observable behavior or stable contracts, not snippets of source code. Never delete, skip, or loosen a test just to get green.
5. **PR hygiene.**
   - The PR title follows Conventional Commits: `<type>(<scope>): <description>`, where type is one of feat, fix, docs, test, refactor, style, chore, ci, perf, build, or revert.
   - The body references the issue (`Closes #<n>` / `Relates to #<n>`). The gate always requires the reference for code PRs (rule 2). It also requires it for every PR when the repo's caller sets `require-issue-reference: true`.
   - The body says what changed, why it works, how it could fail, and how it was tested.
6. **Structural changes need a contract.** Structural paths include `packages/`, workflows/validators, AGENTS/CLAUDE/.cursorrules, `docs/quality|architecture`, and SPEC/empire-spec files. If the repo has `.systems-thinking/contracts/`, add a `SYSTEMS_THINKING_CONTRACT` JSON file there. Its `scope` must cover every structural path, and it fills in event → pattern → structure → archetype → intervention → leading_indicators → transfer. No placeholders.
7. **Do not touch the governance itself.** Agents do not edit, weaken, disable, or route around these:
   - `.github/workflows/ai-governance.yml` and its pinned SHA
   - other CI workflows
   - `CODEOWNERS`
   - this section
   - `.husky/`, `.claude/`, `.cursor/rules/`
   - branch protection or rulesets

   A change to any of them needs Ky's explicit request, and Ky merges it. Never edit a gate to make it pass.
8. **Secrets.** Never commit secrets, tokens, or `.env` values, and never print credentials. If a secret leaks: rotate it at the provider first, then rewrite it out of branch history. Deleting it in a later commit is not enough.
9. **No destructive commands without explicit human authorization.** This covers `git push --force`, `git reset --hard`, `git clean -fd`, `prisma migrate reset`, `supabase db reset`, `drop database`, `terraform destroy`, and `rm -rf /`.
10. **Supply chain.** Pin third-party GitHub Actions to a full commit SHA. Every workflow declares a least-privilege `permissions:` block. Untrusted event data (PR title, body, branch name) goes through `env:` and is never spliced into `run:` scripts.
11. **Human judgment stays human.** Do not invent users, traction, metrics, or personal facts. Stop and hand formative, consequential (irreversible), and authorship decisions to Ky.
12. **Deploys follow governance.** Only Ky deploys, from main, after the repo’s required CI and governance verdict succeed for the exact deployed revision. Automated jobs use a successful workflow_run from a same-repository main push. An existing manual-only deployment remains manual-only and must enforce the same source/check conditions plus its protected human environment; agents never invoke it. Do not add an automatic deploy to a manual project or treat a check from another revision as approval.


**Last updated:** 2026-03-19

## 0. Fundamental Standards

- **Package manager:** pnpm only, pinned via `packageManager` in `package.json` — pnpm honors that field itself, and `pnpm/action-setup` reads it in CI. Never use Corepack; it is deprecated and removed in Node 25+.
- **Formatting:** Run `pnpm run fmt` (Prettier) and `pnpm run eslint` before every commit. No exceptions.
- **Zero-Exception Testing:** 100% coverage goal. Run `pnpm test` before completion. `feat`/`fix` and other behavior-changing PRs require unit + integration tests where applicable; see `doc/code-submission-guidelines.md` for exceptions (e.g., some `chore`/docs changes).
- **Import Rule:** Directory-level import restrictions are strictly enforced. See `eslint.config.js`.
- **Commits:** Angular commit convention is mandatory. PRs with non-conforming commits will be rejected. See `doc/code-submission-guidelines.md`.
- **Issues:** All unresolved issues tracked in [GitHub Issues](https://github.com/dequelabs/axe-core/issues).

## 1. Technical Guidelines

### Code Structure

- **Return Early:** Keep the happy path left-aligned. Handle errors/edge cases first with early returns — never nest when you can exit.
- **Exports:** Default export at the top of the file, immediately after imports.
- **JSDoc:** Add JSDoc/DocBlock comments where appropriate, especially for exported APIs and complex logic. Document parameters and return types. See `doc/code-submission-guidelines.md` (source of truth) and `doc/developer-guide.md` for additional guidance.
- **Naming:** Files and rule/check IDs in kebab-case. Functions in camelCase. Booleans prefixed `is`/`has`/`should`. Constants in `UPPER_SNAKE_CASE`.
- **Variables:** Declare at point of use, not at the top of the function.

### Virtual Nodes vs. HTMLElement

- **Prefer Virtual Nodes** for attribute access and property reads (`virtualNode.attr()`, `virtualNode.props`).
- **Use real DOM** only when you need DOM APIs (e.g., `getBoundingClientRect`, `getRootNode`).
- **`core/utils/` functions** should default to real DOM inputs/outputs, except utilities that are explicitly documented as operating on `VirtualNode` (for example, tree or selector helpers). Avoid introducing new `VirtualNode`-dependent utilities unless there is a clear performance or API benefit.
- **Conversion:** Use `getNodeFromTree()` from `core/utils` when you receive an ambiguous input (such as a `VirtualNode`, selector, or mixed type) and need to resolve it to a real DOM `Node`.

### Import Restrictions (Hard Rules)

- `standards/` → nothing (pure data, no imports).
- `core/utils/` → other `core/utils`, `core/base`, `standards` via **direct file paths only** (no index).
- `core/imports/` → node modules **only** (the only place npm imports are allowed).
- `commons/` → other `commons` (direct paths), `core/utils` (index OK).
- `checks/` and `rules/` → any directory (index OK).
- **Never** import `commons` from `core/utils`. This is the most commonly rejected violation.

### Checks & Rules

- **Check evaluate functions:** Return `true` (pass), `false` (fail), or `undefined` (incomplete). Use `this.data()` to pass values to message templates and to provide incomplete-result detail.
- **Rule JSON:** Use `all`, `any`, `none` check arrays. `selector` + optional `matches` to scope candidates. Valid `impact` values: `"minor"`, `"moderate"`, `"serious"`, `"critical"`.
- **Standards data:** Never hardcode ARIA/HTML lists in checks. Query from `standards/` via `commons/standards` functions.
- **Messages:** All user-facing strings live in check/rule JSON `metadata.messages`. Use `${data.property}` templates. Support singular/plural variants. Update `locales/_template.json` whenever messages change (auto-synced on `pnpm run build`).

### High-Risk Areas (Extra Scrutiny Required)

- **Color contrast:** Handles all CSS color formats, opacity, blend modes, stacking contexts, text-shadow. Return `undefined` when background cannot be determined. See `doc/developer-guide.md`.
- **ARIA validation:** Must stay current with spec. Query roles/attrs from `standards/aria-roles.js` and `standards/aria-attrs.js`. Handle implicit vs. explicit roles. See `doc/rule-development.md`.
- **Hidden elements:** Use `isVisibleToScreenReaders()`, not CSS visibility alone. Account for `aria-hidden="true"` and Shadow DOM boundaries.
- **i18n:** Update `locales/_template.json` on every message change and commit the generated file alongside source.

## 2. Testing

- **Structure:** Mirror `lib/` exactly under `test/`. File `lib/commons/text/sanitize.js` → `test/commons/text/sanitize.js`.
- **Checks:** Use `axe.testUtils.MockCheckContext()`. Only reset `checkContext` in `afterEach` — `fixture` and `axe._tree` are auto-cleared.
- **Integration tests:** All rule changes require an HTML + JSON pair. Use `test/integration/rules/<rule-name>/` for mocha-hosted tests or `test/integration/full/<rule-name>/` when the rule requires a full HTML page. JSON selectors must use axe array format (`["#id"]`; iframes: `["iframe", "#id"]`). Also update or create virtual-rules tests where appropriate.
- **Shadow DOM:** Add a Shadow DOM test only when the behavior under test crosses a shadow boundary: something on the host (or above it) affects a node inside the shadow tree, or vice versa (slotted content, idrefs resolving across roots). If the target and everything that decides the result are in the same root, a shadow test exercises nothing new, so leave it out. Use declarative Shadow DOM; see the Shadow DOM example in `doc/examples/test-patterns.md`.
- **Logging:** Do not commit `console.log` statements.

## 3. Build & Commits

- **Bundles (`axe.js`, `axe.min.js`)** are auto-generated for releases/publishing and are not committed to the repo (they are gitignored).
- **Locales template (`locales/_template.json`)** is auto-generated. When message strings change, regenerate this file and commit it in the same commit as the source changes — never in a separate commit.
- **One change per PR.** Do not mix refactoring with feature work.
- **Commit format:** `<type>(<scope>): <subject>` — imperative, lowercase, no period, ≤100 chars total. Body explains motivation. Footer: `Closes: #123` or full URL; use a separate `Closes:` line for each issue. See `doc/code-submission-guidelines.md` for the full type list.

**Example:**

```
fix(aria-valid-attr-value): handle multiple aria-errormessage IDs

When aria-errormessage contains multiple space-separated IDs, verify
all IDs exist in aria-describedby instead of matching the full string.

Closes: #4957
```

## 4. Documentation & API Changes

- **New rules:** Update `CHANGELOG.md`. `doc/rule-descriptions.md` is auto-generated by `pnpm run build`.
- **API changes:** Update `doc/API.md` and `axe.d.ts` TypeScript definitions.
- **Breaking changes:** Avoid breaking changes — prefer supporting both old and new formats simultaneously. If unavoidable, add `BREAKING CHANGE: description` to commit footer, include migration guide in `CHANGELOG.md`, and tag deprecated code with `@deprecated` JSDoc.

## 5. Examples (Copy-Paste Reference)

- **Code patterns:** `doc/examples/code-patterns.md` — return early, default export, imports, JSDoc, Virtual Node usage
- **Test patterns:** `doc/examples/test-patterns.md` — unit tests, check tests, Shadow DOM tests, integration test HTML+JSON
- **Rule & check templates:** `doc/examples/rule-check-templates.md` — JSON templates for rules and checks, evaluate function pattern
- **PR review patterns:** `doc/examples/pr-review-patterns.md` — common reviewer feedback, anti-patterns, what reviewers look for

## 6. Reference Docs & Help

- **Contributing guide:** `CONTRIBUTING.md`
- **Import rules detail:** `eslint.config.js`
- **Code submission standards:** `doc/code-submission-guidelines.md`
- **Developer guide:** `doc/developer-guide.md`
- **Rule development:** `doc/rule-development.md`
- **API reference:** `doc/API.md`
- **Pull Request Checklist:** `doc/pull-request-checklist.md`
- **Slack:** [axe-community](https://accessibility.deque.com/axe-community)
- **Issues:** [GitHub Issues](https://github.com/dequelabs/axe-core/issues)
