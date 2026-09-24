# Project Knowledge Layer — Kamyab Legal Registration Institute Operations System

This folder is the project's **Knowledge Layer**: an exact summary of the reference document, the glossary, the founding principles, the manager-defined lists, the pages, the flows, and the critical rules. Every implementation decision must be consistent with these documents. **If code ever conflicts with these documents, these documents are authoritative and the code must be fixed.**

> Source: `کامیاب-سند-کامل-نسخه۳.pdf` (Version 3 — Mehr 1405) in the project root.

## Language policy (project-wide)

- **English only** for: knowledge-layer files, roadmap files, reports, code comments, file names, commit messages.
- **Persian only** for: user-interface text (labels, buttons, messages, validation errors, tooltips), SMS templates, institute information, and any text shown on screen to the end user.
- A Persian secondary reference of these documents is kept in [`fa-reference/`](fa-reference/) and is **frozen** (not updated). The English versions are the primary reference.

## Knowledge-layer documents

| File | Contents | Source section |
|------|----------|----------------|
| [01-summary.md](01-summary.md) | Full plain-language summary of the document | Whole document |
| [02-glossary.md](02-glossary.md) | Exact project glossary (fixed meaning of each term) | A-2 |
| [03-principles.md](03-principles.md) | Three founding principles + deliberately-fixed items | A-1, B-0 |
| [04-manager-defined.md](04-manager-defined.md) | Everything the manager defines himself | Section B |
| [05-pages-fields.md](05-pages-fields.md) | Pages, field by field | Section C |
| [06-flows.md](06-flows.md) | Complete work flows | Section D |
| [07-critical-rules.md](07-critical-rules.md) | Rules that must never be violated | E-3 |

## Roadmap documents (sibling folder)

| File | Contents |
|------|----------|
| [../roadmap/ROADMAP.md](../roadmap/ROADMAP.md) | Phase-based project roadmap by priority |
| [../roadmap/tech-stack.md](../roadmap/tech-stack.md) | Recommended technologies and the reason for each |
| [../roadmap/folder-structure.md](../roadmap/folder-structure.md) | Recommended project folder structure |
| [../roadmap/database-schema.md](../roadmap/database-schema.md) | Database schema: tables, fields, relationships |
| [../roadmap/database-indexes.md](../roadmap/database-indexes.md) | Required indexes |
| [../REPORT.md](../REPORT.md) | Phase-one report, open questions, and suggestions |

## The golden rule

> **Anywhere this rule is broken and something is hardcoded, six months later someone has to write code again just to change a phrase. This is the yardstick for every decision.**
