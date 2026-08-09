# Chainly — AI Agent Workflow Builder

## Stack
nhost (Postgres + Hasura + Auth + Storage + Functions), Hasura GraphQL Engine, 
PostgreSQL, GraphQL (queries/mutations/subscriptions), Groq for llm_call steps, 
React/Next.js frontend.

## Data Model
- organizations — usage quota (calls used / allowed per period)
- org_members — user_id, org_id, role (owner, editor, viewer)
- workflows — belongs to an organization
- workflow_steps — ordered, type, config (JSONB)
- workflow_triggers — trigger type tied to a workflow
- workflow_runs — one per execution, overall status (must support 'paused')
- step_runs — one per step per run: status, input, output, error, attempt 
  count, approved_by, approved_at

Relationships: org -> members, org -> workflows, workflow -> steps/triggers, 
workflow -> runs -> step_runs.

## Step Types
llm_call, http_request, db_write, notify (Event Trigger), conditional_branch, 
approval_gate (pauses run until approved by correct role).

## Trigger Types
Manual, Webhook (Hasura Action as inbound endpoint), Scheduled (cron function), 
Database event (Hasura Event Trigger).

## Hasura Layer
Track all tables + relationships. One aggregation: org-level usage this month 
(computed field or Postgres view).

### Permissions — two layers
Layer 1 — org + role scoping (Hasura row-level permissions):
- owner: full control over workflows, steps, triggers, org membership
- editor: create/edit workflows and steps, trigger runs — can't manage members
- viewer: read-only, cannot trigger a run
- Every permission scoped through org_members to caller's own org, not role alone.

Layer 2 — step-level gating (enforced in code, not Hasura permissions):
- Only owner can add db_write, webhook trigger, or notify step.
- approveStep Action must check approver's role server-side before resuming — 
  this is a mid-execution decision, not a database permission.

## GraphQL Operations
- Query: org's workflows with steps, triggers, most recent run status
- Mutation: create/edit workflow, steps, triggers
- Mutation: approve a paused approval_gate step
- Subscription: step_runs filtered by workflow_run_id, incl. paused state

## Core Integration: triggerWorkflowRun(workflow_id) — Hasura Action
1. Verify caller is owner/editor in workflow's org
2. Check org's quota isn't exhausted
3. Create workflow_run, execute steps in order
4. llm_call/http_request make real external calls, at least one retry on failure
5. On approval_gate: set run to paused, stop. Second Action (approveStep) 
   checks approver's role before resuming.
6. Update step_runs/workflow_run status throughout (subscription reflects live)
7. Increment org's quota usage on completion

Plus at least one trigger beyond manual (webhook chosen), actually wired to 
start a run without a button click.

## Frontend
Auth via nhost, org context. Workflow builder (add/reorder steps, attach 
trigger). Run button (hidden for viewers), live per-step status via 
subscription, pause/approve UI. Usage/quota indicator.

## Final Task Scenario (what "done" means)
1. Two separate orgs, each with own users/roles.
2. Org A owner builds workflow: 3+ step types incl. llm_call, http_request, 
   conditional_branch that changes behavior based on LLM output.
3. Workflow started two ways: manually + webhook/event trigger.
4. One approval_gate step — run pauses, only owner/editor in that org can 
   approve forward.
5. Live status streams step-by-step with no refresh, incl. paused state.
6. Org B user cannot see, trigger, or approve anything in Org A — not even 
   by guessing an ID directly.

## Deliverables
GitHub repo + README (setup, how to run locally, API keys/stub note), 
hosted Next.js URL (Vercel), Hasura metadata/migrations, ~1 page write-up 
(schema reasoning, how the two permission layers differ, approval-gate 
pause/resume mechanics), screen recording of the Final Task scenario.