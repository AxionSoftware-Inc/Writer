export type NumericalTrustMeter = {
    confidence: number;
    estimatedAbsoluteError: string;
    tolerance: string;
    method: string;
    stability: "stable" | "review" | "unstable" | "unknown";
    warnings: string[];
    recommendations: string[];
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function buildNumericalTrustMeter(params: {
    method?: string;
    exactValue?: number | null;
    numericValue?: number | null;
    comparisonValues?: number[];
    warnings?: string[];
    tolerance?: string | number | null;
    runtimeMs?: number | null;
}): NumericalTrustMeter {
    const warnings = [...(params.warnings ?? [])];
    const tolerance = params.tolerance == null ? "1e-8" : String(params.tolerance);
    const method = params.method || "symbolic/numeric comparison";
    const values = (params.comparisonValues ?? []).filter((item) => Number.isFinite(item));
    const numericValue = typeof params.numericValue === "number" && Number.isFinite(params.numericValue) ? params.numericValue : null;
    const exactValue = typeof params.exactValue === "number" && Number.isFinite(params.exactValue) ? params.exactValue : null;
    let error = 0;

    if (exactValue !== null && numericValue !== null) {
        error = Math.abs(exactValue - numericValue);
    } else if (values.length >= 2) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        error = Math.abs(max - min);
    } else if (numericValue === null) {
        warnings.push("No independent numeric value is available.");
        error = Number.NaN;
    }

    const warningPenalty = warnings.length * 12;
    const errorPenalty = Number.isFinite(error) ? clamp(Math.log10(error + 1e-16) + 16, 0, 16) * 2.5 : 24;
    const runtimePenalty = typeof params.runtimeMs === "number" && params.runtimeMs > 10000 ? 8 : 0;
    const confidence = Math.round(clamp(100 - warningPenalty - errorPenalty - runtimePenalty, 0, 100));
    const stability = confidence >= 85 ? "stable" : confidence >= 60 ? "review" : confidence > 0 ? "unstable" : "unknown";

    return {
        confidence,
        estimatedAbsoluteError: Number.isFinite(error) ? `< ${Math.max(error, 1e-14).toExponential(2)}` : "unknown",
        tolerance,
        method,
        stability,
        warnings,
        recommendations:
            stability === "stable"
                ? ["Attach this trust meter to report exports."]
                : ["Run an independent method comparison before final publication.", "Tighten tolerance or inspect singularities if warnings persist."],
    };
}

export function numericalTrustToMarkdown(meter: NumericalTrustMeter) {
    return [
        "## Numerical Trust Meter",
        `- Confidence: ${meter.confidence}%`,
        `- Estimated absolute error: ${meter.estimatedAbsoluteError}`,
        `- Tolerance: ${meter.tolerance}`,
        `- Method: ${meter.method}`,
        `- Stability: ${meter.stability}`,
        meter.warnings.length ? `- Warnings: ${meter.warnings.join("; ")}` : "- Warnings: none",
    ].join("\n");
}
