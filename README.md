# MathSphere Writer

Writer is a scientific-writing subsystem designed to run inside larger products as well as in this repository's reference Next.js host.

It supports section-based documents, Markdown/LaTeX, publication preview, citations, laboratory-result linking, 2D/3D plots, Python cells, revision snapshots and publication review.

## Public integration surface

New integrations should use only these entrypoints:

- `@/components/writer` — React `WriterWorkspace`, props, slots and host types.
- `@/lib/writer-sdk` — framework-neutral document/core/integration contracts.

`components/paper-editor-workspace.tsx` is a backwards-compatibility facade for older callers; it no longer contains the workspace implementation.

See [`docs/WRITER_ARCHITECTURE.md`](docs/WRITER_ARCHITECTURE.md) for embedding, host commands/events and architectural boundaries.

## Repository layout

- `components/writer/workspace/` — modular workspace controller and UI panes.
- `lib/writer-document.ts` — core `WriterDocument` contract and pure document utilities.
- `lib/writer-integration.ts` — typed host adapter and browser event bridge.
- `lib/writer-sdk.ts` — framework-neutral public exports.
- `components/writer/index.ts` — React public exports.
- `lib/writer-project.ts` — section normalization/compilation.
- `components/` + `lib/` — optional scientific extensions such as lab/citation/plot/Python support.
- `app/` — reference Next.js host application.
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

## Backend reference host

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

A product embedding Writer can replace this backend entirely by supplying its own `onChange`, `onSubmit`, navigation and `WriterHostAdapter` implementation.
