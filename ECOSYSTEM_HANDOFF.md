# Ecosystem Handoff — Writer

Branch: `ecosystem-v1-foundation-2026-08-28`
Base: `main` at `77af4009540250f726a7c2a06dca4be2a095090b`

## Role

Writer is the ecosystem's **publication instrument**. It turns research objects, reasoning and evidence into papers, reports, books and other publication-ready documents.

Writer does not own mathematical or physical compute.

## Current milestone: Project result → draft

Keep the integration deliberately small:

```text
Math result saved in active Project
        ↓
Writer Project Results
        ↓
New document
        ↓
result/report markdown is inserted into the first draft section
```

This path now uses the shared local Scientific Object store and does not require a server-side import job.

Do not add live/pinned/frozen UI, collaboration, sync, or a generic object-reference framework until this simple flow is visually and functionally stable.

## Strong existing assets

Preserve and evolve:

- `components/paper-editor-workspace.tsx` — main manuscript workspace;
- citation management;
- scientific/math rendering;
- existing project/document concepts;
- export/publishing capabilities;
- current lab-result import path as a migration fallback.

## Major architecture problem to remove later

`backend/laboratory/` contains a large private copy of Mathematics solver infrastructure (integrals, differential equations, matrices, probability, series, SymPy service, jobs and verification).

This is legacy duplication. No new solver work belongs in Writer.

Do not delete it yet if an existing frontend consumer still depends on it. Do not expand it either. Once current consumers have moved to Project results, retire the duplicated laboratory backend.

## Backend boundary

Keep Writer-specific document persistence working during migration. Shared server concerns may later move to Platform Core, but ordinary local Project-result insertion must not wait for that migration.

Writer must never read Mathematics or Notebook databases directly. Shared local objects are exchanged through the ecosystem contract/store, and future cloud sync can mirror the same objects.

## Current integration files

- `app/project/page.tsx` — simple active Project result browser;
- `app/new/page.tsx` — supports `source=project&objectId=...` and starts a draft from that local result;
- `lib/ecosystem/local-object-store.ts` — shared browser object store contract;
- `lib/ecosystem/project-context.ts` — active Project context.

## Near-term implementation order

1. Verify active Project survives navigation.
2. Verify Math-saved objects appear on `/project`.
3. Verify `New document` preloads the result into the first Writer section.
4. Keep the manuscript editor visually primary.
5. Only after this is stable, decide whether true reference semantics are necessary for drafting.
6. Remove duplicated solver backend only after no current consumer needs it.

## Design rule

The manuscript is the hero. Ecosystem chrome and object metadata must stay quiet until invoked. Avoid card-heavy dashboards inside the editor; use contextual insertion and progressive disclosure instead.
