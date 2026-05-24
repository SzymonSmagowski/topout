# diagrams

Draw.io source files for the TopOut app. This directory is the canonical
location for all architectural diagrams produced by the Architect agent
(and, later, AIEngineer + CloudEngineer if/when those phases run for
this app).

## Convention

- One diagram set per app, living at `apps/<app>/diagrams/` — not under `.claude/designs/`.
- File naming: `<topic>.drawio` (kebab-case). Rendered exports (`.png`, `.svg`) live alongside the source if generated.
- Regenerate whenever the topology drifts.

## Current diagrams

- `convex-schema-erd.drawio` — Convex data model: 6 tables (`users`, `gyms`, `sessions`, `attempts`, `follows`, `weeklyReports`) plus `authTables.*`, with indexes annotated. Source for `apps/topout/docs/architecture.md`'s schema section.
- `service-topology.drawio` — System context: Browser → Next.js (Vercel) → Convex Cloud → Sidecar → OpenAI, with Langfuse as a downstream trace sink. Calls out that the sidecar is the single LLM gateway and has no Convex client (data flows IN only).
- `llm-flows.drawio` — Both LangGraph topologies side by side: `/summarize-session` (load_payload → format_prompt → synthesize) and `/weekly-report` (load_payload → analyze_stats → synthesize_narrative). Includes the Langfuse wiring callout.

## Rendering

PNG export:

```bash
drawio -x -f png -s 2 -t -o convex-schema-erd.png convex-schema-erd.drawio
```

(`-s 2` = 2x scale; `-t` = transparent background.)

## What lives elsewhere

- **Cloud architecture** — owned by CloudEngineer, written to a `system-cloud-architecture.drawio` companion file when this app ships to GCP. Not present in v1 because the sidecar is local-only.
- **Sequence diagrams for mutations** — covered as Mermaid blocks inside the feature specs at `docs/specs/topout/*.md`. Only promote to .drawio if a flow earns its own pixels.
