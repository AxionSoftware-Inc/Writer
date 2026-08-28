export const WRITER_EXTERNAL_RESOURCE_SCHEMA_VERSION = 1 as const;

export type WriterExternalResourceReference = {
    schemaVersion: typeof WRITER_EXTERNAL_RESOURCE_SCHEMA_VERSION;
    provider: string;
    resourceType: string;
    resourceId: string;
    revision?: number;
    integrityHash?: string;
    renderer?: string;
    metadata?: Record<string, string | number | boolean | null>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createWriterExternalResourceReference(
    input: Omit<WriterExternalResourceReference, "schemaVersion">,
): WriterExternalResourceReference {
    return {
        schemaVersion: WRITER_EXTERNAL_RESOURCE_SCHEMA_VERSION,
        ...input,
    };
}

export function isWriterExternalResourceReference(value: unknown): value is WriterExternalResourceReference {
    if (!isRecord(value) || value.schemaVersion !== WRITER_EXTERNAL_RESOURCE_SCHEMA_VERSION) return false;
    if (
        typeof value.provider !== "string" ||
        !value.provider.trim() ||
        typeof value.resourceType !== "string" ||
        !value.resourceType.trim() ||
        typeof value.resourceId !== "string" ||
        !value.resourceId.trim()
    ) {
        return false;
    }
    if (value.revision !== undefined && (typeof value.revision !== "number" || !Number.isFinite(value.revision))) return false;
    if (value.integrityHash !== undefined && typeof value.integrityHash !== "string") return false;
    if (value.renderer !== undefined && typeof value.renderer !== "string") return false;
    if (value.metadata !== undefined && !isRecord(value.metadata)) return false;
    if (
        isRecord(value.metadata) &&
        Object.values(value.metadata).some(
            (item) => item !== null && !["string", "number", "boolean"].includes(typeof item),
        )
    ) {
        return false;
    }
    return true;
}
