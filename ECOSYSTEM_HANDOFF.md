# Ecosystem Handoff — Writer

Branch: `ecosystem-v1-foundation-2026-08-28`
Base: `main` at `77af4009540250f726a7c2a06dca4be2a095090b`

## Role

Writer is the ecosystem's **publication instrument**. It turns research objects, reasoning and evidence into papers, reports, books and other publication-ready documents.

Writer does not own mathematical or physical compute.

## Strong existing assets

Preserve and evolve:

- `components/paper-editor-workspace.tsx` — main manuscript workspace;
- citation management;
- scientific/math rendering;
- existing project/document concepts;
- export/publishing capabilities;
- current lab-result cards/import UI as migration input.

## Major architecture problem to remove

`backend/laboratory/` contains a large private copy of Mathematics solver infrastructure (integrals, differential equations, matrices, probability, series, SymPy service, jobs and verification).

This is explicitly **legacy duplication**. No new solver work belongs in Writer.

Do not delete it until existing Writer consumers are moved to Project/Scientific Object references. Once the object pipeline is working, retire the duplicated laboratory backend and all Writer-side assumptions that a scientific result must be recomputed locally by Writer.

## Future Writer workflow

The core interaction becomes:

```text
Insert
  → From Project
      → Calculations
      → Simulations
      → Visualizations / Scenes
      → Datasets / Tables
      → Notebook Findings
```

A selected item is inserted as a `ScientificObjectReference`, not copied as a PNG or Writer-specific result payload.

## Reference semantics

Writer must make evidence stability explicit:

- **Live** — follow the latest compatible revision while drafting;
- **Pinned** — bind to an explicit revision;
- **Frozen** — immutable publication snapshot.

A scientific figure/result inspector should eventually show source app, object title, revision, provenance, where it is used, and whether a newer revision exists.

## Backend migration boundary

Keep `paper_builder` and current document persistence working during migration, but move shared concerns to Platform Core:

```text
Platform Core
  projects / objects / revisions / references / artifacts / identity

Writer domain
  manuscript structure / publication settings / export-specific state
```

Writer must never read Mathematics or Notebook databases directly.

## First integration pipeline

```text
Open Project
  → open/create manuscript
  → Insert from Project
  → choose Scientific Object
  → create live/pinned/frozen reference
  → render through object/scene adapter
  → export publication view
```

## Near-term implementation order

1. Add shared Project context + Platform Core client.
2. Introduce an ecosystem object browser behind `Insert from Project`.
3. Adapt `laboratory-result-import-panel` to consume generic object references.
4. Render the current Math result payload through the same object adapter.
5. Add live/pinned/frozen reference controls.
6. Migrate document/project ownership assumptions toward shared Project IDs.
7. Remove `backend/laboratory` and duplicated solver code after no frontend consumer depends on it.
8. Keep only Writer-specific server logic that cannot reasonably be local or shared.

## Design rule

The manuscript is the hero. Ecosystem chrome and object metadata must stay quiet until invoked. Avoid card-heavy dashboards inside the editor; use contextual insertion, inspectors and progressive disclosure instead.
