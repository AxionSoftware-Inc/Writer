export type ReproducibilityCapsule = {
    input: Record<string, unknown>;
    method: string;
    engine: string;
    engineVersion: string;
    assumptions: string[];
    parameters: Record<string, unknown>;
    numericSettings: {
        tolerance: string | number | null;
        maxIterations: number | null;
    };
    sourceHash: string;
    resultHash: string;
    createdAt: string;
};

export type ComputationalTrustSummary = {
    label: "verified" | "review" | "blocked" | "unknown";
    score: number | null;
    detail: string;
};

export type ChangeImpactItem = {
    label: string;
    reason: string;
};

export type ChangeImpactMap = {
    stale: boolean;
    reason: string;
    affected: ChangeImpactItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    if (isRecord(value)) {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}

export function deterministicHash(value: unknown): string {
    const input = stableStringify(value);
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `h${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function buildReproducibilityCapsule(params: {
    input: Record<string, unknown>;
    result: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdAt?: string;
}): ReproducibilityCapsule {
    const metadata = params.metadata ?? {};
    const computation = isRecord(metadata.computation) ? metadata.computation : {};
    const numericSettings = isRecord(metadata.numeric_settings) ? metadata.numeric_settings : {};
    const assumptions = normalizeStringList(metadata.assumptions ?? computation.assumptions);
    const method =
        typeof computation.method === "string"
            ? computation.method
            : typeof metadata.method === "string"
              ? metadata.method
              : "auto";
    const engine =
        typeof computation.engine === "string"
            ? computation.engine
            : typeof metadata.engine === "string"
              ? metadata.engine
              : "sympy/manual-js-hybrid";
    const engineVersion =
        typeof computation.engine_version === "string"
            ? computation.engine_version
            : typeof metadata.engineVersion === "string"
              ? metadata.engineVersion
              : "unknown";
    const tolerance =
        typeof computation.tolerance === "string" || typeof computation.tolerance === "number"
            ? computation.tolerance
            : typeof numericSettings.tolerance === "string" || typeof numericSettings.tolerance === "number"
              ? numericSettings.tolerance
              : null;
    const maxIterations = typeof numericSettings.maxIterations === "number" ? numericSettings.maxIterations : null;

    return {
        input: params.input,
        method,
        engine,
        engineVersion,
        assumptions,
        parameters: isRecord(metadata.parameters) ? metadata.parameters : {},
        numericSettings: {
            tolerance,
            maxIterations,
        },
        sourceHash: deterministicHash({ input: params.input, method, assumptions, parameters: metadata.parameters ?? {} }),
        resultHash: deterministicHash({ result: params.result, method, engine, tolerance }),
        createdAt: params.createdAt ?? new Date().toISOString(),
    };
}

export function summarizeComputationalTrust(metadata: Record<string, unknown>): ComputationalTrustSummary {
    const certificate = isRecord(metadata.verification_certificate) ? metadata.verification_certificate : {};
    const computation = isRecord(metadata.computation) ? metadata.computation : {};
    const score = typeof certificate.trust_score === "number" ? certificate.trust_score : null;
    const status = typeof certificate.status === "string" ? certificate.status : "";
    const warnings = normalizeStringList(certificate.warnings ?? computation.warnings);
    const errors = normalizeStringList(certificate.errors ?? computation.errors);

    if (errors.length > 0 || status === "blocked") {
        return { label: "blocked", score, detail: errors[0] ?? "Verification blocked this result." };
    }
    if (score !== null && score >= 82 && status !== "review") {
        return { label: "verified", score, detail: warnings[0] ?? "Verification checks passed." };
    }
    if (score !== null || warnings.length > 0 || status === "review") {
        return { label: "review", score, detail: warnings[0] ?? "Review recommended before final publication." };
    }
    return { label: "unknown", score: null, detail: "Verification certificate is not attached yet." };
}

export function buildChangeImpactMap(params: {
    currentRevision: number;
    latestRevision: number;
    latestMetadata: Record<string, unknown>;
    currentIntegrity?: {
        sourceHash?: string;
        resultHash?: string;
        method?: string;
    } | null;
}): ChangeImpactMap {
    const stale = params.latestRevision > params.currentRevision;
    const computation = isRecord(params.latestMetadata.computation) ? params.latestMetadata.computation : {};
    const latestCapsule = isRecord(params.latestMetadata.reproducibility_capsule)
        ? (params.latestMetadata.reproducibility_capsule as Partial<ReproducibilityCapsule>)
        : {};
    const method = typeof computation.method === "string" ? computation.method : "current solver method";
    const methodChanged = Boolean(params.currentIntegrity?.method && latestCapsule.method && params.currentIntegrity.method !== latestCapsule.method);
    const sourceChanged = Boolean(params.currentIntegrity?.sourceHash && latestCapsule.sourceHash && params.currentIntegrity.sourceHash !== latestCapsule.sourceHash);
    const resultChanged = Boolean(params.currentIntegrity?.resultHash && latestCapsule.resultHash && params.currentIntegrity.resultHash !== latestCapsule.resultHash);
    const dependencyLabels = [
        "final answer",
        "step-by-step explanation",
        "graph / visual",
        "Python code",
        "report paragraph",
        "notebook conclusion",
    ];

    return {
        stale,
        reason: stale
            ? methodChanged
                ? `Method changed from ${params.currentIntegrity?.method} to ${latestCapsule.method}.`
                : sourceChanged
                  ? "Original problem, parameters, or assumptions changed since this section was imported."
                  : resultChanged
                    ? "Computed result hash changed while the source contract stayed comparable."
                    : `Saved result changed from revision ${params.currentRevision} to ${params.latestRevision}; latest method: ${method}.`
            : "Writer section is aligned with the saved laboratory result revision.",
        affected: stale
            ? dependencyLabels.map((label) => ({
                  label,
                  reason: `${label} depends on the saved result payload or reproducibility capsule.`,
              }))
            : [],
    };
}

export function buildComputationalCitationMarkdown(params: {
    resultId: string;
    title: string;
    moduleTitle: string;
    revision: number;
    metadata: Record<string, unknown>;
    updatedAt: string;
}) {
    const capsule = isRecord(params.metadata.reproducibility_capsule)
        ? (params.metadata.reproducibility_capsule as Partial<ReproducibilityCapsule>)
        : null;
    const trust = summarizeComputationalTrust(params.metadata);
    const ref = `R${params.resultId.slice(0, 8).toUpperCase()}`;
    const method = capsule?.method ?? (isRecord(params.metadata.computation) ? params.metadata.computation.method : "unknown");
    const sourceHash = typeof capsule?.sourceHash === "string" ? capsule.sourceHash : "pending";
    const resultHash = typeof capsule?.resultHash === "string" ? capsule.resultHash : "pending";

    return [
        `> **Computed from ${ref}** · ${params.moduleTitle} · revision ${params.revision} · trust: ${trust.label}${trust.score === null ? "" : ` ${trust.score}/100`}.`,
        `> Source: ${params.title}. Method: ${String(method || "unknown")}. Generated: ${params.updatedAt || "unknown"}.`,
        `> Reproducibility capsule: source ${sourceHash}, result ${resultHash}.`,
    ].join("\n");
}

export function buildReproducibilityAppendixMarkdown(metadata: Record<string, unknown>) {
    if (!isRecord(metadata.reproducibility_capsule)) {
        return "";
    }

    const capsule = metadata.reproducibility_capsule as Partial<ReproducibilityCapsule>;
    const assumptions = Array.isArray(capsule.assumptions) && capsule.assumptions.length ? capsule.assumptions.join(", ") : "not specified";
    return [
        "## Reproducibility Appendix",
        `- Engine: ${capsule.engine ?? "unknown"} (${capsule.engineVersion ?? "unknown"})`,
        `- Method: ${capsule.method ?? "unknown"}`,
        `- Assumptions: ${assumptions}`,
        `- Numeric tolerance: ${capsule.numericSettings?.tolerance ?? "not specified"}`,
        `- Source hash: ${capsule.sourceHash ?? "pending"}`,
        `- Result hash: ${capsule.resultHash ?? "pending"}`,
    ].join("\n");
}
