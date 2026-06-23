export type AssumptionKind = "domain" | "sign" | "integer" | "parameter" | "time" | "custom";

export type Assumption = {
    id: string;
    variable: string;
    statement: string;
    kind: AssumptionKind;
    source: "inferred" | "user" | "solver";
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique<T>(items: T[], key: (item: T) => string) {
    const seen = new Set<string>();
    return items.filter((item) => {
        const nextKey = key(item);
        if (seen.has(nextKey)) return false;
        seen.add(nextKey);
        return true;
    });
}

export function extractVariablesFromText(value: string) {
    const blocked = new Set(["sin", "cos", "tan", "log", "ln", "exp", "sqrt", "pi", "inf", "sum", "int", "line", "surface"]);
    return unique(
        Array.from(value.matchAll(/\b[a-zA-Z]\w*\b/g))
            .map((match) => match[0])
            .filter((token) => !blocked.has(token.toLowerCase()) && token.length <= 8),
        (item) => item,
    ).slice(0, 8);
}

export function inferAssumptions(params: {
    input?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    fallbackText?: string;
}): Assumption[] {
    const metadata = params.metadata ?? {};
    const rawAssumptions = metadata.assumptions;
    if (Array.isArray(rawAssumptions) && rawAssumptions.length > 0) {
        return rawAssumptions
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((statement, index) => ({
                id: `user-${index}-${statement}`,
                variable: statement.split(/\s+/)[0] || "global",
                statement,
                kind: statement.includes(">") || statement.includes("<") ? "sign" : statement.includes("integer") || statement.includes("Z") ? "integer" : "custom",
                source: "user",
            }));
    }

    const inputText = [
        params.fallbackText,
        ...Object.values(params.input ?? {}).filter((item) => typeof item === "string"),
    ].join(" ");
    const variables = extractVariablesFromText(inputText);
    const inferred: Assumption[] = variables.map((variable) => ({
        id: `inferred-${variable}-real`,
        variable,
        statement: `${variable} in R`,
        kind: "domain",
        source: "inferred",
    }));

    if (isRecord(metadata.computation) && typeof metadata.computation.method === "string" && metadata.computation.method.includes("ODE")) {
        inferred.push({ id: "inferred-t-time", variable: "t", statement: "t >= 0", kind: "time", source: "inferred" });
    }

    return unique(inferred, (item) => item.statement);
}

export function assumptionsToStatements(assumptions: Assumption[]) {
    return unique(assumptions.map((item) => item.statement).filter(Boolean), (item) => item);
}

export function buildAssumptionImpactSummary(next: Assumption[], previous: Assumption[] = []) {
    const nextSet = new Set(next.map((item) => item.statement));
    const previousSet = new Set(previous.map((item) => item.statement));
    const added = next.filter((item) => !previousSet.has(item.statement));
    const removed = previous.filter((item) => !nextSet.has(item.statement));
    const changed = added.length + removed.length;
    return {
        changed,
        added,
        removed,
        affected: changed
            ? ["solve result", "domain restrictions", "graph range", "verification certificate", "report wording", "generated code"]
            : [],
    };
}
