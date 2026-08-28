# MathSphere Writer

Writer is an embeddable scientific-document subsystem for MathSphere products and other host applications. The Next.js application in this repository is a reference host, not Writer's architectural boundary.

Writer supports section-based documents, Markdown/LaTeX, publication preview, citations, external scientific results, 2D/3D plots, Python cells, revision snapshots and publication review.

## Public integration surface

New integrations should use only these entrypoints:

- `@/components/writer` — React `WriterWorkspace`, props, slots, document helpers and host types.
- `@/lib/writer-sdk` — framework-neutral document, section, external-resource and integration contracts.

`components/paper-editor-workspace.tsx` is a backwards-compatibility facade for older callers; it no longer contains workspace implementation.

See [`docs/WRITER_ARCHITECTURE.md`](docs/WRITER_ARCHITECTURE.md) for embedding, host commands/events and architectural boundaries.

## Versioned document contract

`WriterDocument` is the portable frontend contract and carries an explicit `schemaVersion`.

Legacy/backend-shaped payloads should cross into Writer through `normalizeWriterDocument(...)`. Runtime integrations can use `isWriterDocument(...)` and `isWriterDocumentPatch(...)` before accepting external state.

The current Django adapter intentionally strips the frontend-only schema version before persistence, so the frontend contract can evolve without requiring the reference backend to change in lockstep.

## External scientific resources

Writer does not require every source application to become part of its core model. External results use a provider-neutral reference:

```ts
{
  schemaVersion: 1,
  provider: "mathematics",
  resourceType: "solver-result",
  resourceId: "result-42",
  revision: 3,
  integrityHash: "sha256:...",
  renderer: "plot2d"
}
```

Laboratory imports currently map into this contract while retaining their existing markdown/block representation for backwards compatibility. The same contract can represent Mathematics, Notebook, BIM, simulation or future services.

## Repository layout

- `components/writer/workspace/` — private modular workspace implementation.
- `components/writer/workspace/use-writer-section-session.ts` — section editing/document synchronization session.
- `components/writer/workspace/use-writer-host-bridge.ts` — host command/event lifecycle.
- `components/writer/workspace/use-writer-layout.ts` — layout and responsive workspace state.
- `components/writer/workspace/use-writer-revisions.ts` — local revision snapshots.
- `lib/writer-document.ts` — versioned core `WriterDocument` contract and migration/validation utilities.
- `lib/writer-integration.ts` — typed host adapter, CustomEvent bridge and secure postMessage bridge.
- `lib/writer-external-resource.ts` — provider-neutral external result references.
- `lib/writer-sdk.ts` — framework-neutral public exports.
- `components/writer/index.ts` — React public exports.
- `lib/writer-project.ts` — section normalization/compilation.
- `components/` + `lib/` — optional scientific extensions such as citation, plot, Python and Laboratory support.
- `app/` — reference Next.js host application, consuming the public Writer entrypoint.
- `backend/` — current Django persistence implementation; Writer UI is not architecturally coupled to it.

## Frontend development

```bash
npm install
npm run dev
```

Optional environment file:

```bash
cp .env.example .env.local
npm run dev
```

Checks:

```bash
npm test
npm run lint
npm run build
```

The repository includes regression tests for document migration/validation, integration payload validation, external-resource references and architecture boundaries.

## Backend reference host

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

A product embedding Writer can replace this backend entirely by supplying its own state/persistence, navigation and `WriterHostAdapter` implementation.
