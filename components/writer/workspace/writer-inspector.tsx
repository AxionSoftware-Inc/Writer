"use client";

import { WriterProjectPanel } from "@/components/writer-project-panel";
import { getWriterSectionKey } from "@/lib/writer-project";
import type { WriterInspectorSection } from "@/lib/writer-document";
import { WriterDocumentInspector } from "./inspector-document";
import { WriterReviewInspector } from "./inspector-review";
import { WriterToolsInspector } from "./inspector-tools";
import type { WriterWorkspaceController, WriterWorkspaceSlots } from "./workspace-types";

const inspectorTabs: Array<{ id: WriterInspectorSection; label: string }> = [
    { id: "navigator", label: "Files" },
    { id: "tools", label: "Tools" },
    { id: "review", label: "Review" },
    { id: "document", label: "Document" },
];

export function WriterInspector({
    controller,
    slots,
}: {
    controller: WriterWorkspaceController;
    slots?: WriterWorkspaceSlots;
}) {
    const {
        inspectorSection,
        setInspectorSection,
        normalizedSections,
        activeSection,
        formData,
        handleSelectSection,
        handleUpdateActiveSection,
        handleAddSection,
        handleDuplicateSection,
        handleMoveSection,
        handleRemoveSection,
    } = controller;

    return (
        <aside
            className="site-panel flex min-h-0 w-full shrink-0 flex-col overflow-hidden p-3 lg:h-full print:hidden"
            style={controller.canResizeSidebar ? { width: `${controller.sidebarWidth}px` } : undefined}
        >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="site-panel-strong p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Workspace</div>
                        <div className="site-status-pill px-2.5 py-1 text-[10px] tracking-[0.14em]">{normalizedSections.length}</div>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                        {inspectorTabs.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setInspectorSection(item.id)}
                                className={`min-w-0 rounded-lg px-2 py-2 text-[9px] font-bold uppercase tracking-[0.09em] transition-colors ${
                                    inspectorSection === item.id
                                        ? "bg-foreground text-background"
                                        : "site-soft-panel text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {inspectorSection === "navigator" ? (
                    <WriterProjectPanel
                        sections={normalizedSections}
                        activeSectionId={getWriterSectionKey(activeSection)}
                        activeSection={activeSection}
                        documentKind={formData.document_kind}
                        onSelectSection={handleSelectSection}
                        onUpdateActiveSection={handleUpdateActiveSection}
                        onAddSection={handleAddSection}
                        onDuplicateSection={handleDuplicateSection}
                        onMoveSection={handleMoveSection}
                        onRemoveSection={handleRemoveSection}
                    />
                ) : null}

                {inspectorSection === "tools" ? <WriterToolsInspector controller={controller} slots={slots} /> : null}
                {inspectorSection === "review" ? <WriterReviewInspector controller={controller} /> : null}
                {inspectorSection === "document" ? <WriterDocumentInspector controller={controller} /> : null}
            </div>
        </aside>
    );
}
