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
   - objective and non-goals;
   - constraints and assumptions;
   - verified evidence and open questions;
   - work phases and dependencies;
   - lane owners and write ownership;
   - validation gates, failures, and recovery decisions;
   - final verification and unresolved risk.

The state file is a recovery aid, not a substitute for reporting meaningful checkpoints to Root.

## Build the execution plan

1. Ask `explorer` to map the affected repository surface when cross-file ownership or call paths are not already known.
2. Ask `librarian` to verify current external contracts when versions, providers, APIs, or standards materially affect the work.
3. Convert evidence into dependency-ordered phases with a measurable validation gate after each phase.
4. Ask `oracle` to review the plan before risky, irreversible, security-sensitive, or cross-cutting implementation.
5. If visual or interaction work is material, obtain a concrete `designer` handoff before assigning implementation. The handoff must state the intended behavior, states, and acceptance evidence.
6. Assign implementation to `fixer`, or to `designer` when the owned deliverable is specifically visual or interaction-focused.

Do not dispatch implementation from an unreviewed guess when the missing evidence can change the implementation direction.

## Schedule specialist lanes

- Prefer independent lanes in parallel only when they do not depend on each other's output.
- Use the smallest specialist set that covers the work; do not spawn agents merely to fill every role.
- Default to `fork_turns="none"` and send a self-contained assignment with objective, non-goals, evidence, files or responsibility owned, expected output, and required checks. A full-history fork inherits the current agent type, model, and effort, so it must not be combined with selection of a different specialist type.
- Tell writing specialists that they are not alone in the codebase. They must preserve unrelated changes and accommodate concurrent edits.
- Keep at most one writer responsible for an overlapping file surface.
- Track each spawned agent by its task name or agent identity and actual status. Wait for every required lane before integration.
- If a lane fails, times out, or returns unusable evidence, diagnose the cause before retrying. Revise the prompt, narrow the task, or reassign to another one of the five specialists only when the new action addresses that cause.
- Respect the Codex depth boundary: Root is depth 0, this Orchestrator is depth 1, and specialists are depth 2. Specialists must not delegate further.

## Validate each phase

After every implementation phase:

1. Inspect the actual diff or artifact, not only the specialist summary.
2. Run the focused checks that encode the phase's intent.
3. Ask `oracle` for a second review when the phase changes architecture, security boundaries, data contracts, or rollout risk.
4. Record results and remaining risk in the deep-work state file.
5. Continue only when the current gate passes or Root explicitly accepts the documented exception.

## Return to Root

Return a concise integration report containing:

- what was implemented and by which specialist lanes;
- the evidence and checks that passed;
- every skipped or failed check with the reason;
- unresolved risks, disagreements, or decisions still requiring Root;
- whether the assigned subtree satisfies its observable completion criteria.

Do not claim the overall task is complete, approve your own scope expansion, deploy, publish, or make an external decision reserved for Root.
