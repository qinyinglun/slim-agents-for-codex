---
name: slim-orchestration
description: Orchestrate large, high-risk, multi-phase Codex execution through the five built-in Slim specialists with dependency planning, persistent state, review gates, bounded delegation, and final verification. Use for cross-cutting changes, unsafe-to-partially-ship migrations, or sustained specialist coordination. Do not activate for routine multi-file changes, simple fixes, or quick documentation work.
---

# Slim Orchestration

Act as the scheduler for one root-approved execution subtree. Coordinate work; do not become the default worker.

Use this skill only when the task is large enough to justify persistent planning and several specialist lanes. For smaller work, return control to Root so it can use a specialist directly or work without orchestration.

## Fixed team

Route work only to these five built-in Slim specialists:

- `explorer`: inspect the repository, trace symbols and dependencies, and gather local evidence.
- `librarian`: verify external documentation, APIs, compatibility, and source-backed facts.
- `oracle`: review architecture, plans, risk, correctness, and integration decisions.
- `designer`: define or implement visual and interaction work when design judgment is material.
- `fixer`: implement scoped changes and run proportionate verification.

Do not draw from arbitrary custom roles. Do not spawn `orchestrator`, `council`, or another meta-coordinator. The Council owns deliberation; this skill owns execution of an approved direction.

## Start and persist the work

1. Confirm the assigned objective, non-goals, constraints, approval boundary, and observable completion criteria.
2. Inspect `.gitignore`. If needed, add `.slim/deepwork/` so orchestration state remains local and is not committed accidentally.
3. Create `.slim/deepwork/<task-slug>.md` before substantial delegation. Keep it current throughout the task.
4. Record:
   - objective, non-goals, constraints, and assumptions;
   - verified evidence, open questions, and research findings accepted from `librarian` as confirmed context;
   - work phases, dependencies, lane owners, and write ownership;
   - validation gates, Oracle review budget, failures, and recovery decisions;
   - final verification and unresolved risk.

Keep `.slim/deepwork/` strictly for progress files. Save code and documentation deliverables to project paths (`src/`, `docs/`).

The state file is a recovery aid, not a substitute for reporting meaningful checkpoints to Root.

## Build the execution plan

1. Ask `explorer` to map the affected repository surface when cross-file ownership or call paths are not already known.
2. Ask `librarian` to verify current external contracts when versions, providers, APIs, or standards materially affect the work.
3. Convert evidence into dependency-ordered phases with a measurable validation gate after each phase.
4. Ask `oracle` to review the plan before risky, irreversible, security-sensitive, or cross-cutting implementation; never dispatch from an unreviewed guess when missing evidence could change direction.
5. If visual or interaction work is material, obtain a concrete `designer` handoff before assigning implementation. The handoff must state the intended behavior, states, and acceptance evidence.
6. Assign implementation to `fixer`, or to `designer` when the owned deliverable is specifically visual or interaction-focused.
7. Before dispatch, show Root a compact overview containing only the phase titles and order, each delegated specialist with its ownership or scope, and the total planned Oracle reviews with the gate after each phase and a short reason for each gate.

## Schedule specialist lanes

- Prefer independent lanes in parallel only when they do not depend on each other's output.
- Use the smallest specialist set that covers the work; do not spawn agents merely to fill every role.
- Default to `fork_turns="none"` with a self-contained assignment (objective, non-goals, evidence, owned files or responsibility, expected output, required checks). A full-history fork inherits current type, model, and effort, so do not combine it with selecting a different specialist type.
- Tell writing specialists that they are not alone in the codebase. They must preserve unrelated changes and accommodate concurrent edits.
- Keep at most one writer responsible for an overlapping file surface.
- Track each spawned agent by task name or identity, scope, and actual status; wait for every required lane before integration.
- If a lane fails, times out, or returns unusable evidence, diagnose the cause before retrying. Revise the prompt, narrow the task, or reassign to another one of the five specialists only when the new action addresses that cause.
- Respect the Codex depth boundary (configured as `max_depth = 2`): specialists must not delegate further.

## Validate each phase

Plan a small number of coherent phases from the task's dependencies and delivery boundaries before dispatch, and record the phase order and review gates in the state file. After every planned implementation phase:

1. Inspect the actual diff or artifact, not only the specialist summary.
2. Run the focused checks that encode the phase's intent.
3. Ask `oracle` to review the phase result as an automatic gate before continuing.
4. Before the Oracle review, add relevant confirmed research findings and file references to the state file so Oracle assesses the decision from accepted context instead of redoing discovery.
5. Triage and batch material actionable Oracle findings into one bounded remediation pass, then validate it with focused evidence; request a follow-up Oracle review only if that remediation changes the reviewed decision or risk.
6. Record results and remaining risk in the state file.
7. Continue only when the current gate passes or Root explicitly accepts the documented exception.

Avoid micro-phases created only to make reviews smaller or cheaper. Larger, complex tasks can have broader phases, broader patches, and correspondingly broader phase reviews. Never add an extra Oracle review merely to re-confirm a mechanical fixer change.

## Scheduler discipline

- Wait for each spawned agent to reach a terminal result before consuming it; do not advance to the next phase while relevant lanes are running or terminal results are unreconciled.
- If no independent work remains while a lane runs, stop briefly instead of blocking or fabricating results.
- Reconcile shared-worktree changes across concurrent writers before integration.

## Designer handoff guardrail

When a phase includes `designer`, treat the delivered UI/UX as accepted design intent for later phases. Record important design decisions in the state file before continuing.

After designer work:

- preserve design intent: layout, rhythm, hierarchy, motion, spacing, color, affordances, responsiveness, and component feel; improve user-facing copy with grounded, normal wording without changing visual structure or interaction intent;
- route visual, responsive, motion, hierarchy, polish, or component-feel follow-ups back to `designer`; use `fixer` only for bounded mechanical follow-up that preserves the design exactly (wiring, tests, type fixes, non-visual behavior changes);
- if design intent must change, record why in the state file before changing it.

## Return to Root

Return a concise integration report containing:

- what was implemented and by which specialist lanes;
- the evidence and checks that passed;
- every skipped or failed check with the reason;
- unresolved risks, disagreements, or decisions still requiring Root;
- whether the assigned subtree satisfies its observable completion criteria.

Do not claim the overall task is complete, approve your own scope expansion, deploy, publish, or make an external decision reserved for Root.
