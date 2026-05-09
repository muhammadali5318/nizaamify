# 0009 — Decision log structure

## Context

User asked for a `decisions/` folder for context management. Two viable formats: one running log, or one ADR file per decision.

## Decision

ADR-style: one file per decision under `decisions/`. Numeric prefix preserves order: `decisions/NNNN-kebab-title.md`. Each ADR has four sections: `Context`, `Decision`, `Alternatives considered`, `Consequences`.

`decisions/README.md` keeps an index of all ADRs with one-line hooks.

## Alternatives considered

- **Single running log** — easy to write, hard to grep across topics; appendices balloon over time. Rejected.
- **Per-feature decision sections in `tasks.md`** — mixes ephemeral progress with durable decisions. Rejected.

## Consequences

- Adding a decision = one new file + one line in the README index.
- Future agents (and humans) can grep by topic: `grep -l 'router' decisions/*.md`.
- Granularity rule: ADR a decision when it reverses a PRD assumption or makes a cross-cutting architectural choice. Skip small CSS / naming choices.
- Expected count for the MVP: ~10–15 ADRs.
