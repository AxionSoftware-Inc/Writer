import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
    return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Writer frontend architecture boundaries", () => {
    it("keeps framework-neutral core modules independent from React components", () => {
        const coreFiles = [
            "lib/writer-document.ts",
            "lib/writer-integration.ts",
            "lib/writer-external-resource.ts",
            "lib/writer-api.ts",
            "lib/writer-sdk.ts",
        ];

        for (const file of coreFiles) {
            expect(readProjectFile(file), file).not.toContain("@/components/");
        }
    });

    it("makes the reference app consume only the public Writer React entrypoint", () => {
        for (const file of ["app/new/page.tsx", "app/[id]/page.tsx"]) {
            const source = readProjectFile(file);
            expect(source, file).toContain('from "@/components/writer"');
            expect(source, file).not.toContain("@/components/writer/workspace/");
        }
    });

    it("keeps the legacy PaperEditorWorkspace as a tiny compatibility facade", () => {
        const source = readProjectFile("components/paper-editor-workspace.tsx");
        expect(source.length).toBeLessThan(1200);
        expect(source).not.toContain("useState(");
        expect(source).not.toContain("useEffect(");
        expect(source).toContain("WriterWorkspace as PaperEditorWorkspace");
    });
});
