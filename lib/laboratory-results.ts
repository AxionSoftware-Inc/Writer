import { fetchPublic } from "@/lib/api";
import {
    LIVE_WRITER_EXPORT_VERSION,
    createWriterImportRequestId,
    type WriterBridgeBlockData,
    type WriterBridgePublicationProfile,
    type WriterImportPayload,
} from "@/lib/live-writer-bridge";
import {
    applyPublicationProfileToBlock,
    applyPublicationProfileToMarkdown,
} from "@/lib/laboratory-publication-profile";
import {
    buildComputationalCitationMarkdown,
    buildReproducibilityAppendixMarkdown,
    buildReproducibilityCapsule,
    deterministicHash,
    summarizeComputationalTrust,
} from "@/lib/computational-integrity";
import { assumptionsToStatements, inferAssumptions } from "@/lib/assumptions";
import { buildNumericalTrustMeter } from "@/lib/numerical-trust";

export const SAVED_LAB_RESULT_SCHEMA_VERSION = 1;

type SavedLabComputationStatus = "exact" | "numeric" | "hybrid" | "approximate" | "failed" | "unknown";

export type SavedLaboratoryResult = {
    id: string;
    module_slug: string;
    module_title: string;
    mode: string;
    title: string;
    summary: string;
    report_markdown: string;
    input_snapshot: Record<string, unknown>;
    structured_payload: WriterBridgeBlockData;
    metadata: Record<string, unknown>;
    revision: number;
    created_at: string;
    updated_at: string;
};

export type CreateSavedLaboratoryResultPayload = {
    module_slug: string;
    module_title: string;
    mode: string;
    title: string;
    summary: string;
    report_markdown: string;
    input_snapshot: Record<string, unknown>;
    structured_payload: WriterBridgeBlockData;
    metadata?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function inferComputationStatus(block: WriterBridgeBlockData, metadata: Record<string, unknown>): SavedLabComputationStatus {
    const explicit = metadata.computation_status ?? metadata.status ?? metadata.exactness_tier;
    if (typeof explicit === "string") {
        const normalized = explicit.toLowerCase();
        if (["exact", "numeric", "hybrid", "approximate", "failed"].includes(normalized)) {
            return normalized as SavedLabComputationStatus;
        }
    }
    if (block.status !== "ready") {
        return "failed";
    }
    if (block.plotSeries?.length || block.coefficients?.length || block.matrixTables?.length) {
        return "hybrid";
    }
    return "unknown";
}

function buildCanonicalMetadata(payload: CreateSavedLaboratoryResultPayload) {
    const sourceMetadata = isRecord(payload.metadata) ? payload.metadata : {};
    const sourceComputation = isRecord(sourceMetadata.computation) ? sourceMetadata.computation : {};
    const sourceProvenance = isRecord(sourceMetadata.provenance) ? sourceMetadata.provenance : {};
    const inputSnapshot = isRecord(payload.input_snapshot) ? payload.input_snapshot : {};
    const structuredPayload = payload.structured_payload;
    const savedAt = new Date().toISOString();
    const assumptions = inferAssumptions({
        input: inputSnapshot,
        metadata: sourceMetadata,
        fallbackText: payload.report_markdown,
    });
    const reproducibilityCapsule = buildReproducibilityCapsule({
        input: inputSnapshot,
        result: {
            structured_payload: structuredPayload,
            report_markdown: payload.report_markdown,
        },
        metadata: { ...sourceMetadata, assumptions: assumptionsToStatements(assumptions) },
        createdAt: savedAt,
    });
    const verificationCertificate = isRecord(sourceMetadata.verification_certificate)
        ? sourceMetadata.verification_certificate
        : {
              status: "not_requested",
              trust_score: null,
              checks: [],
              warnings: [],
              recommendations: ["Run verification certificate before final publication export."],
          };
    const computationWarnings = normalizeStringList(sourceComputation.warnings ?? sourceMetadata.warnings);
    const computationErrors = normalizeStringList(sourceComputation.errors ?? sourceMetadata.errors);
    const numericalTrustMeter = buildNumericalTrustMeter({
        method: reproducibilityCapsule.method,
        warnings: computationWarnings,
        tolerance: reproducibilityCapsule.numericSettings.tolerance,
        runtimeMs: typeof sourceComputation.runtime_ms === "number" ? sourceComputation.runtime_ms : null,
    });

    return {
        ...sourceMetadata,
        schema_version:
            typeof sourceMetadata.schema_version === "number"
                ? sourceMetadata.schema_version
                : SAVED_LAB_RESULT_SCHEMA_VERSION,
        result_standard: "mathsphere.saved_lab_result",
        original_input: isRecord(sourceMetadata.original_input) ? sourceMetadata.original_input : inputSnapshot,
        assumptions: assumptionsToStatements(assumptions),
        assumption_contract: {
            assumptions,
            source: assumptions.some((item) => item.source === "user") ? "user" : "inferred",
            affected_outputs: ["solve", "limit", "integral", "graph", "code", "report", "verification"],
        },
        provenance: {
            app: "MathSphere Laboratory",
            source_label:
                typeof sourceMetadata.sourceLabel === "string"
                    ? sourceMetadata.sourceLabel
                    : typeof sourceProvenance.source_label === "string"
                      ? sourceProvenance.source_label
                      : payload.module_title,
            module_slug: payload.module_slug,
            module_title: payload.module_title,
            mode: payload.mode,
            generated_at: structuredPayload.generatedAt,
            saved_at: savedAt,
            ...sourceProvenance,
        },
        computation: {
            status: inferComputationStatus(structuredPayload, sourceMetadata),
            method:
                typeof sourceComputation.method === "string"
                    ? sourceComputation.method
                    : typeof sourceMetadata.method === "string"
                      ? sourceMetadata.method
                      : structuredPayload.kind,
            tolerance:
                typeof sourceComputation.tolerance === "string" || typeof sourceComputation.tolerance === "number"
                    ? sourceComputation.tolerance
                    : null,
            runtime_ms:
                typeof sourceComputation.runtime_ms === "number"
                    ? sourceComputation.runtime_ms
                    : typeof sourceMetadata.runtime_ms === "number"
                      ? sourceMetadata.runtime_ms
                      : null,
            engine:
                typeof sourceComputation.engine === "string"
                    ? sourceComputation.engine
                    : typeof sourceMetadata.engine === "string"
                      ? sourceMetadata.engine
                      : "sympy/manual-js-hybrid",
            warnings: computationWarnings,
            errors: computationErrors,
            ...sourceComputation,
        },
        verification_certificate: verificationCertificate,
        reproducibility_capsule: isRecord(sourceMetadata.reproducibility_capsule)
            ? sourceMetadata.reproducibility_capsule
            : reproducibilityCapsule,
        integrity: {
            source_hash:
                typeof sourceMetadata.source_hash === "string"
                    ? sourceMetadata.source_hash
                    : reproducibilityCapsule.sourceHash,
            result_hash:
                typeof sourceMetadata.result_hash === "string"
                    ? sourceMetadata.result_hash
                    : reproducibilityCapsule.resultHash,
            report_hash: deterministicHash(payload.report_markdown),
            dependency_contract: [
                "final answer",
                "step-by-step explanation",
                "graph / visual",
                "Python code",
                "report paragraph",
                "notebook conclusion",
            ],
            outdated_detection: "revision-and-hash",
        },
        numerical_trust: {
            ...summarizeComputationalTrust({
                ...sourceMetadata,
                verification_certificate: verificationCertificate,
                computation: {
                    warnings: computationWarnings,
                    errors: computationErrors,
                },
            }),
            meter: numericalTrustMeter,
        },
        report_contract: isRecord(sourceMetadata.report_contract)
            ? sourceMetadata.report_contract
            : {
                  required_sections: [
                      "Problem Statement",
                      "Method",
                      "Solution",
                      "Verification",
                      "Graph Interpretation",
                      "Code Appendix",
                      "Conclusion",
                  ],
                  export_formats: ["PDF", "LaTeX", "DOCX", "Writer"],
                  readiness: payload.report_markdown.trim().length > 0 ? "draft-ready" : "blocked",
              },
        billing_signal: isRecord(sourceMetadata.billing_signal)
            ? sourceMetadata.billing_signal
            : {
                  tier: "pro",
                  feature: "saved-lab-result-report-bridge",
                  reason: "Saved result, report export, writer import, and verification certificate are paid-value workflow features.",
              },
    };
}

export function normalizeCreateSavedLaboratoryResultPayload(
    payload: CreateSavedLaboratoryResultPayload,
): CreateSavedLaboratoryResultPayload {
    return {
        ...payload,
        input_snapshot: isRecord(payload.input_snapshot) ? payload.input_snapshot : {},
        metadata: buildCanonicalMetadata(payload),
    };
}

function normalizeSavedLaboratoryResult(payload: Record<string, unknown>): SavedLaboratoryResult | null {
    if (
        typeof payload.id !== "string" ||
        typeof payload.module_slug !== "string" ||
        typeof payload.module_title !== "string" ||
        typeof payload.title !== "string" ||
        typeof payload.report_markdown !== "string"
    ) {
        return null;
    }

    return {
        id: payload.id,
        module_slug: payload.module_slug,
        module_title: payload.module_title,
        mode: typeof payload.mode === "string" ? payload.mode : "",
        title: payload.title,
        summary: typeof payload.summary === "string" ? payload.summary : "",
        report_markdown: payload.report_markdown,
        input_snapshot:
            typeof payload.input_snapshot === "object" && payload.input_snapshot
                ? (payload.input_snapshot as Record<string, unknown>)
                : {},
        structured_payload:
            typeof payload.structured_payload === "object" && payload.structured_payload
                ? (payload.structured_payload as WriterBridgeBlockData)
                : ({
                      id: payload.id,
                      status: "ready",
                      moduleSlug: typeof payload.module_slug === "string" ? payload.module_slug : "laboratory",
                      kind: typeof payload.mode === "string" ? payload.mode : "report",
                      title: payload.title,
                      summary: typeof payload.summary === "string" ? payload.summary : "",
                      generatedAt: typeof payload.updated_at === "string" ? payload.updated_at : new Date().toISOString(),
                      metrics: [],
                  } satisfies WriterBridgeBlockData),
        metadata:
            typeof payload.metadata === "object" && payload.metadata ? (payload.metadata as Record<string, unknown>) : {},
        revision: typeof payload.revision === "number" ? payload.revision : 1,
        created_at: typeof payload.created_at === "string" ? payload.created_at : "",
        updated_at: typeof payload.updated_at === "string" ? payload.updated_at : "",
    };
}

async function parseApiError(response: Response) {
    try {
        const data = (await response.json()) as Record<string, unknown>;
        if (typeof data.detail === "string") {
            return data.detail;
        }
        if (typeof data.report_markdown === "string") {
            return data.report_markdown;
        }
        return JSON.stringify(data);
    } catch {
        return `Request failed with status ${response.status}`;
    }
}

export async function createSavedLaboratoryResult(payload: CreateSavedLaboratoryResultPayload) {
    const normalizedPayload = normalizeCreateSavedLaboratoryResultPayload(payload);
    const response = await fetchPublic("/api/laboratory/results/", {
        method: "POST",
        body: JSON.stringify(normalizedPayload),
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response));
    }

    const data = (await response.json()) as Record<string, unknown>;
    const normalized = normalizeSavedLaboratoryResult(data);
    if (!normalized) {
        throw new Error("Saved laboratory result response is malformed.");
    }

    return normalized;
}

export async function updateSavedLaboratoryResult(id: string, payload: CreateSavedLaboratoryResultPayload) {
    const normalizedPayload = normalizeCreateSavedLaboratoryResultPayload(payload);
    const response = await fetchPublic(`/api/laboratory/results/${encodeURIComponent(id)}/`, {
        method: "PUT",
        body: JSON.stringify(normalizedPayload),
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response));
    }

    const data = (await response.json()) as Record<string, unknown>;
    const normalized = normalizeSavedLaboratoryResult(data);
    if (!normalized) {
        throw new Error("Updated laboratory result response is malformed.");
    }

    return normalized;
}

export async function fetchSavedLaboratoryResults(params: { moduleSlug?: string; search?: string; mode?: string; ordering?: string } = {}) {
    const query = new URLSearchParams();
    if (params.moduleSlug) {
        query.set("module_slug", params.moduleSlug);
    }
    if (params.mode) {
        query.set("mode", params.mode);
    }
    if (params.search) {
        query.set("search", params.search);
    }
    if (params.ordering) {
        query.set("ordering", params.ordering);
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await fetchPublic(`/api/laboratory/results/${suffix}`, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response));
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
        return [];
    }

    return data
        .map((item) => normalizeSavedLaboratoryResult(item as Record<string, unknown>))
        .filter((item): item is SavedLaboratoryResult => Boolean(item));
}

export async function fetchSavedLaboratoryResult(id: string) {
    const response = await fetchPublic(`/api/laboratory/results/${encodeURIComponent(id)}/`, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response));
    }

    const data = (await response.json()) as Record<string, unknown>;
    const normalized = normalizeSavedLaboratoryResult(data);
    if (!normalized) {
        throw new Error("Saved laboratory result response is malformed.");
    }

    return normalized;
}

export function createWriterImportPayloadFromSavedResult(
    result: SavedLaboratoryResult,
    profile: WriterBridgePublicationProfile = "full",
): WriterImportPayload {
    const baseBlock: WriterBridgeBlockData = {
        ...result.structured_payload,
        id: createWriterImportRequestId(),
        sync: undefined,
        savedResultId: result.id,
        savedResultRevision: result.revision,
        generatedAt: result.updated_at || result.structured_payload.generatedAt,
        title: result.structured_payload.title || result.title,
        summary: result.structured_payload.summary || result.summary,
        moduleSlug: result.structured_payload.moduleSlug || result.module_slug,
        kind: result.structured_payload.kind || result.mode || "report",
        status: "ready",
    };
    const trust = summarizeComputationalTrust(result.metadata);
    const capsule = isRecord(result.metadata.reproducibility_capsule)
        ? (result.metadata.reproducibility_capsule as Record<string, unknown>)
        : {};
    baseBlock.integrity = {
        sourceHash: typeof capsule.sourceHash === "string" ? capsule.sourceHash : undefined,
        resultHash: typeof capsule.resultHash === "string" ? capsule.resultHash : undefined,
        method: typeof capsule.method === "string" ? capsule.method : undefined,
        trustLabel: trust.label,
        trustScore: trust.score,
    };
    const block = applyPublicationProfileToBlock(baseBlock, profile);
    const profiledMarkdown = applyPublicationProfileToMarkdown(result.report_markdown, block, profile);
    const citation = buildComputationalCitationMarkdown({
        resultId: result.id,
        title: result.title,
        moduleTitle: result.module_title,
        revision: result.revision,
        metadata: result.metadata,
        updatedAt: result.updated_at,
    });
    const appendix = profile === "summary" || profile === "figures" ? "" : buildReproducibilityAppendixMarkdown(result.metadata);

    return {
        version: LIVE_WRITER_EXPORT_VERSION,
        markdown: [profiledMarkdown, citation, appendix].filter(Boolean).join("\n\n"),
        block,
        title: result.title,
        abstract: result.summary || `Imported from ${result.module_title}.`,
        keywords: `${result.module_slug},laboratory`,
    };
}
