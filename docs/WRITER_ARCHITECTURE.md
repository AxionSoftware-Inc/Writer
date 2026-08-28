# Writer Architecture

Writer is an embeddable scientific-writing subsystem. The Next.js app in this repository is a host/reference application, not the architectural boundary of Writer itself.

## Layer model

```text
Host application
    │
    ├─ React props / slots
    └─ WriterHostAdapter or window CustomEvent bridge
            │
            ▼
Public integration surface
  components/writer/index.ts
  lib/writer-sdk.ts
            │
            ▼
Workspace controller
  components/writer/workspace/use-writer-workspace.ts
            │
      ┌─────┼──────────────┐
      ▼     ▼              ▼
Document  Integration   Scientific services
core      port          (lab/citations/plots/python)
lib/      lib/          components + lib/
            │
            ▼
Pure UI panes
  toolbar / inspector / editor / preview / status
```

## Architectural rules

1. **`WriterDocument` is the core contract.** Persistence, templates and host applications depend on `lib/writer-document.ts`, never on a React component type.
2. **Persistence is injected.** `WriterWorkspace` receives `onChange` and `onSubmit`; the workspace does not require the repository's Django backend.
3. **Navigation is injected.** `backHref` works for simple hosts; `WriterHostAdapter.resolveBackHref` supports product-specific navigation.
4. **External commands/events use the integration port.** Hosts should not reach into controller state or DOM nodes.
5. **Scientific features are extensions, not core state.** Laboratory import, citations, plotting and Python are kept behind the Tools inspector and markdown/block contracts.
6. **Host-specific UI uses slots.** Do not fork the workspace to add one product button or panel.
7. **Compatibility imports are one-way.** `components/paper-editor-workspace.tsx` exists only so older callers do not break; new code imports from `components/writer`.
8. **Internal workspace files are private implementation details.** Avoid imports from `components/writer/workspace/*` outside this repository's Writer implementation.

## React embedding

```tsx
import { WriterWorkspace, type WriterDocument } from "@/components/writer";

function ProductWriter({ document }: { document: WriterDocument }) {
  const [value, setValue] = useState(document);

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

Important commands include `insert-markdown`, `replace-document`, `patch-document`, `open-panel`, `set-view`, `refresh-preview`, `request-save`, and `focus-editor`.

Important events include `writer.ready`, `writer.document.changed`, `writer.document.save-requested`, `writer.document.saved`, `writer.section.changed`, `writer.view.changed`, and `writer.export.requested`.

## Cross-window / microfrontend bridge

If the host cannot share React state, use the browser bridge:

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

## Scientific extension boundary

The document stores portable markdown/block representations. Heavy runtimes are lazy:

- Plotly is loaded near the preview viewport.
- Pyodide is loaded on demand and shared across Python cells.
- Laboratory result imports carry revision/integrity metadata in Writer bridge blocks.
- Citation search is an optional tool and does not define the document model.

A future host can disable or replace these extensions while preserving the same `WriterDocument` model.

## Persistence and IDs

Server IDs are not assumed to be available while drafting. Section helpers accept temporary string IDs and normalize numeric backend IDs when persisted. Revision snapshot storage uses a stable `documentId` when available. The modular workspace migrates legacy title-based local snapshot keys forward rather than discarding local history.

## Compatibility

Legacy code may continue to use:

```ts
import { PaperEditorWorkspace, type PaperFormData } from "@/components/paper-editor-workspace";
```

This file is now a tiny compatibility facade. It re-exports `WriterWorkspace` and aliases `WriterDocument`; no workspace implementation lives there.
