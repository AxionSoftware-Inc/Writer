# Writer Architecture

Writer is an embeddable scientific-document subsystem. The Next.js app in this repository is a reference host, not the architectural boundary of Writer itself.

## Layer model

```text
Host application
    │
    ├─ React props / slots
    ├─ WriterHostAdapter
    ├─ CustomEvent bridge
    └─ postMessage bridge
            │
            ▼
Public integration surface
  components/writer/index.ts
  lib/writer-sdk.ts
            │
            ▼
Workspace orchestration
  use-writer-workspace.ts
      │          │
      │          ├─ use-writer-host-bridge.ts
      │          ├─ use-writer-layout.ts
      │          ├─ use-writer-revisions.ts
      │          └─ use-writer-lab-dependencies.ts
      │
      └─ use-writer-section-session.ts
            │
      ┌─────┼───────────────────────┐
      ▼     ▼                       ▼
Document  Integration          Scientific extensions
core      contracts            citations / plots /
lib/      lib/                 Python / external results
            │
            ▼
Pure UI panes
 toolbar / inspector / editor / preview / status
```

## Architectural rules

1. **`WriterDocument` is the core contract.** Persistence, templates and host applications depend on `lib/writer-document.ts`, never on a React component type.
2. **The document contract is versioned.** `schemaVersion` identifies the portable frontend schema. Legacy or backend payloads enter through `normalizeWriterDocument(...)`.
3. **Sections are the editing authority.** Compiled `content` is derived from normalized sections for preview/export/persistence compatibility.
4. **Persistence is injected.** `WriterWorkspace` receives `onChange` and `onSubmit`; the workspace does not require this repository's Django backend.
5. **Navigation is injected.** `backHref` works for simple hosts; `WriterHostAdapter.resolveBackHref` supports product-specific navigation.
6. **External commands/events use the integration port.** Hosts must not reach into controller state or DOM nodes.
7. **Cross-window payloads are validated at runtime.** TypeScript types alone are not considered a trust boundary.
8. **Scientific features are extensions, not core state.** Laboratory import, citations, plotting and Python live outside the document core.
9. **External scientific data uses provider-neutral references.** Writer core should not depend on Mathematics, Laboratory, Notebook, BIM or another product's model types.
10. **Host-specific UI uses slots.** Do not fork the workspace to add one product button or panel.
11. **Compatibility imports are one-way.** `components/paper-editor-workspace.tsx` exists only so older callers do not break; new code imports from `components/writer`.
12. **Internal workspace files are private implementation details.** Host/reference applications must not import `components/writer/workspace/*` directly.

These boundaries are also covered by `lib/writer-architecture.test.ts` so accidental coupling is visible during normal frontend test runs.

## Versioned document contract

Current documents use:

```ts
import type { WriterDocument } from "@/lib/writer-sdk";

const document: WriterDocument = {
  schemaVersion: 1,
  title: "...",
  abstract: "...",
  content: "...",
  authors: "...",
  keywords: "...",
  document_kind: "paper",
  branding_enabled: true,
  branding_label: "Powered by MathSphere Writer",
  status: "draft",
  sections: [],
};
```

External/legacy payloads should be normalized instead of cast:

```ts
import { normalizeWriterDocument } from "@/lib/writer-sdk";

const document = normalizeWriterDocument(serverPayload);
```

`isWriterDocument(...)` and `isWriterDocumentPatch(...)` provide strict runtime checks for integration boundaries. Unknown patch keys and malformed field types are rejected.

The reference Django API currently predates `schemaVersion`; `lib/writer-api.ts` strips that frontend-only field before POST/PUT. This keeps backend evolution independent from the portable Writer contract.

## React embedding

```tsx
import { WriterWorkspace, normalizeWriterDocument } from "@/components/writer";

function ProductWriter({ initialDocument }) {
  const [value, setValue] = useState(() => normalizeWriterDocument(initialDocument));

  return (
    <WriterWorkspace
      formData={value}
      onChange={setValue}
      onSubmit={(next) => productApi.save(next ?? value)}
      saveState="idle"
      errorMessage=""
      mode="edit"
      documentId={productDocumentId}
      slots={{
        toolbarEnd: <ProductPresenceIndicator />,
        inspectorToolsEnd: <ProductSpecificTool />,
      }}
    />
  );
}
```

The host owns persistence. The same Writer workspace can therefore live inside Mathematics, Laboratory, BIM, a desktop shell, or another web product without importing Writer's Django API.

## Workspace state ownership

`use-writer-workspace.ts` is orchestration rather than a monolithic editor implementation.

`use-writer-section-session.ts` owns:

- active section selection;
- section add/duplicate/reorder/delete/update;
- textarea draft state;
- debounced draft-to-document synchronization;
- section-authoritative compilation;
- external form-data reconciliation.

`use-writer-host-bridge.ts` owns:

- one-time `writer.ready` lifecycle emission;
- typed host command subscription and dispatch.

Layout, revision history and Laboratory dependency monitoring remain separate hooks. UI panes consume the resulting controller but do not own persistence or integration protocols.

## Adapter integration

Use `WriterHostAdapter` when the host and Writer need a typed command/event channel.

```ts
import type { WriterHostAdapter } from "@/lib/writer-sdk";

const host: WriterHostAdapter = {
  id: "mathematics-app",
  emit(event) {
    productEventBus.publish(event.type, event);
  },
  subscribe(listener) {
    return productEventBus.subscribe("writer.command", listener);
  },
  resolveBackHref() {
    return "/workspace";
  },
};
```

Commands include `insert-markdown`, `replace-document`, `patch-document`, `open-panel`, `set-view`, `refresh-preview`, `request-save`, and `focus-editor`.

Events include `writer.ready`, `writer.document.changed`, `writer.document.save-requested`, `writer.document.saved`, `writer.section.changed`, `writer.view.changed`, `writer.preview.refreshed`, `writer.export.requested`, and `writer.integration.error`.

`writer.document.changed` has one authoritative source at the public `WriterWorkspace` boundary so hosts see content, metadata and section changes without duplicate events.

## Same-window CustomEvent bridge

If the host shares the browser window but not React state:

```ts
import { createWindowWriterHost } from "@/lib/writer-sdk";

const host = createWindowWriterHost("mathsphere-writer");
```

Host -> Writer:

```ts
window.dispatchEvent(new CustomEvent("mathsphere-writer:command", {
  detail: { type: "insert-markdown", markdown: "## Imported result" },
}));
```

Writer -> Host:

```ts
window.addEventListener("mathsphere-writer:event", (event) => {
  console.log((event as CustomEvent).detail);
});
```

Incoming commands are validated before being forwarded to Writer.

## iframe / WebView / microfrontend postMessage bridge

For cross-window embedding, use `createPostMessageWriterHost` with an exact origin:

```ts
import { createPostMessageWriterHost } from "@/lib/writer-sdk";

const host = createPostMessageWriterHost({
  id: "mathematics-writer",
  channel: "mathsphere-writer",
  targetOrigin: "https://math.example.com",
  allowedOrigin: "https://math.example.com",
  getTargetWindow: () => window.parent,
  getAllowedSource: () => window.parent,
});
```

Security rules:

- `targetOrigin: "*"` is rejected;
- incoming messages must match the configured origin;
- channel and envelope kind must match;
- an optional source-window check can be enforced;
- command payloads are validated field-by-field;
- event payloads are also validated rather than accepting arbitrary `writer.*` strings.

This bridge can be used by iframes, browser microfrontends and desktop WebView shells without sharing Writer internals.

## External scientific resource boundary

Writer uses a provider-neutral reference for scientific data owned by another product:

```ts
import { createWriterExternalResourceReference } from "@/lib/writer-sdk";

const reference = createWriterExternalResourceReference({
  provider: "mathematics",
  resourceType: "solver-result",
  resourceId: "result-42",
  revision: 3,
  integrityHash: "sha256:...",
  renderer: "plot2d",
  metadata: { moduleSlug: "integrals" },
});
```

The contract intentionally does not contain a Laboratory-specific foreign model. A provider may be `laboratory`, `mathematics`, `notebook`, `bim`, `simulation` or a future service.

Existing Laboratory markdown blocks remain supported. Their saved-result references are mapped into this generic contract internally while legacy fields remain available during migration.

## Scientific extension boundary

The document stores portable markdown/block representations. Heavy runtimes are lazy:

- Plotly is loaded near the preview viewport.
- Pyodide is loaded on demand and shared across Python cells.
- Laboratory result imports carry revision/integrity metadata.
- Citation search is an optional tool and does not define the document model.

A future host can disable or replace these extensions while preserving the same `WriterDocument` model.

## Persistence and IDs

Server IDs are not assumed to be available while drafting. Section helpers accept temporary string IDs and normalize numeric backend IDs when persisted.

Revision snapshot storage uses a stable `documentId` when available. The modular workspace migrates legacy title-based local snapshot keys forward rather than discarding local history, and revision hydration is guarded so an empty initial React state cannot overwrite stored history before loading finishes.

## Compatibility

Legacy code may continue to use:

```ts
import { PaperEditorWorkspace, type PaperFormData } from "@/components/paper-editor-workspace";
```

That file is intentionally a tiny compatibility facade. It re-exports `WriterWorkspace` and aliases `WriterDocument`; no workspace implementation lives there.
