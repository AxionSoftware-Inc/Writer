export type PlotPoint = {
    x: number;
    y: number;
};

export const LIVE_WRITER_BRIDGE_CHANNEL = "mathsphere-live-writer-bridge";
export const LIVE_WRITER_BLOCK_LANGUAGE = "lab-result";
export const LIVE_WRITER_EXPORT_KEY = "mathsphere_laboratory_export";
export const LIVE_WRITER_EXPORT_VERSION = 1;
export const LIVE_WRITER_TARGETS_STORAGE_KEY = "mathsphere_live_writer_targets";
export const LIVE_WRITER_SELECTED_TARGET_KEY = "mathsphere_live_writer_selected_target";
export const LIVE_WRITER_TARGET_SYNC_STORAGE_KEY = "mathsphere_live_writer_target_sync";
export const LIVE_WRITER_TARGET_TTL_MS = 20000;
export const LIVE_WRITER_SYNC_EVENT = "mathsphere-live-writer-sync";

export type WriterBridgeMetric = {
    label: string;
    value: string;
};

export type WriterBridgeCoefficient = {
    order: number;
    derivativeValue: number;
    coefficient: number;
};

export type WriterBridgeMatrixTable = {
    label: string;
    matrix: number[][];
};

export type WriterBridgePlotSeries = {
    label: string;
    color: string;
    points: PlotPoint[];
};

export type WriterBridgeSyncMeta = {
    revision: number;
    pushedAt: string;
    acknowledgedAt?: string;
    sourceLabel: string;
};

export type WriterBridgePublicationProfile = "summary" | "full" | "appendix" | "figures";

export type WriterBridgeBlockData = {
    id: string;
    status: "waiting" | "ready";
    moduleSlug: string;
    kind: string;
    profile?: WriterBridgePublicationProfile;
    title: string;
    summary: string;
    generatedAt: string;
    metrics: WriterBridgeMetric[];
    savedResultId?: string;
    savedResultRevision?: number;
    integrity?: {
        sourceHash?: string;
        resultHash?: string;
        method?: string;
        trustLabel?: string;
        trustScore?: number | null;
    };
    notes?: string[];
    coefficients?: WriterBridgeCoefficient[];
    matrixTables?: WriterBridgeMatrixTable[];
    plotSeries?: WriterBridgePlotSeries[];
    sync?: WriterBridgeSyncMeta;
};

export type WriterBridgeTarget = {
    id: string;
    paperId?: number;
    paperTitle?: string;
    title: string;
    profile?: WriterBridgePublicationProfile;
    status: WriterBridgeBlockData["status"];
    generatedAt: string;
    revision?: number;
    savedResultId?: string;
    savedResultRevision?: number;
    lastPublishedAt?: string;
    lastAcknowledgedAt?: string;
    sourceLabel?: string;
    sectionLabel?: string;
    sectionPath?: string;
};

export type WriterImportPayload = {
    requestId?: string;
    version: typeof LIVE_WRITER_EXPORT_VERSION;
    markdown: string;
    block?: WriterBridgeBlockData;
    title?: string;
    abstract?: string;
    keywords?: string;
};

export type WriterTargetsBroadcast = {
    type: "writer-targets";
    writerId: string;
    documentTitle: string;
    documentId?: string;
    targets: WriterBridgeTarget[];
};

export type WriterTargetsRequest = {
    type: "writer-targets-request";
};

export type LabPublishBroadcast = {
    type: "lab-publish";
    writerId: string;
    targetId: string;
    revision: number;
    publishedAt: string;
    sourceLabel: string;
    payload: WriterBridgeBlockData;
};

export type LabPublishAckBroadcast = {
    type: "lab-publish-ack";
    writerId: string;
    targetId: string;
    revision: number;
    acknowledgedAt: string;
    documentTitle: string;
    blockTitle: string;
    sourceLabel: string;
};

export type StoredWriterTargetSession = {
    writerId: string;
    documentTitle: string;
    documentId?: string;
    lastSeen: number;
    targets: WriterBridgeTarget[];
};

export type StoredWriterTarget = WriterBridgeTarget & {
    writerId: string;
    documentTitle: string;
    documentId?: string;
    lastSeen: number;
};

export type StoredWriterTargetSync = {
    writerId: string;
    targetId: string;
    revision: number;
    state: "pending" | "acknowledged";
    lastPushedAt: number;
    lastAckAt?: number;
    blockTitle?: string;
    documentTitle?: string;
    sourceLabel: string;
};

export type LiveWriterBridgeMessage =
    | WriterTargetsBroadcast
    | WriterTargetsRequest
    | LabPublishBroadcast
    | LabPublishAckBroadcast;

const LAB_RESULT_BLOCK_REGEX = /```lab-result\n([\s\S]*?)\n```/g;

function buildId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }

    return `lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBroadcastChannel(name = LIVE_WRITER_BRIDGE_CHANNEL) {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
        return null;
    }

    return new BroadcastChannel(name);
}

export function createWriterId() {
    return buildId();
}

export function createWriterImportRequestId() {
    return buildId();
}

function buildTargetSyncKey(writerId: string, targetId: string) {
    return `${writerId}::${targetId}`;
}

function buildWriterImportStorageKey(requestId: string) {
    return `${LIVE_WRITER_EXPORT_KEY}::${requestId}`;
}

export function buildLiveWriterTargetSelectionId(ownerId: string | number, targetId: string) {
    return `${ownerId}::${targetId}`;
}

export function getLiveWriterTargetSelectionId(target: { id: string; writerId?: string; paperId?: number }) {
    const ownerId = target.writerId ?? target.paperId;
    return ownerId == null ? target.id : buildLiveWriterTargetSelectionId(ownerId, target.id);
}

export function findLiveWriterTargetBySelection<T extends { id: string; writerId?: string; paperId?: number }>(
    targets: T[],
    selectionId: string,
) {
    return targets.find((target) => getLiveWriterTargetSelectionId(target) === selectionId) ?? null;
}

export function createLaboratoryWriterDraftHref(requestId: string) {
    return `/new?source=laboratory&importId=${encodeURIComponent(requestId)}`;
}

function notifyLiveWriterSyncChanged() {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new CustomEvent(LIVE_WRITER_SYNC_EVENT));
}

export function readStoredWriterTargetSessions() {
    if (typeof window === "undefined") {
        return [] as StoredWriterTargetSession[];
    }

    const raw = window.localStorage.getItem(LIVE_WRITER_TARGETS_STORAGE_KEY);
    if (!raw) {
        return [] as StoredWriterTargetSession[];
    }

    try {
        const parsed = JSON.parse(raw) as StoredWriterTargetSession[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeStoredWriterTargetSessions(
    sessions: StoredWriterTargetSession[],
    options: { notify?: boolean } = {},
) {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(LIVE_WRITER_TARGETS_STORAGE_KEY, JSON.stringify(sessions));
    if (options.notify ?? true) {
        notifyLiveWriterSyncChanged();
    }
}

export function upsertStoredWriterTargetSession(session: StoredWriterTargetSession) {
    const nextSessions = readStoredWriterTargetSessions().filter((entry) => entry.writerId !== session.writerId);
    nextSessions.push(session);
    writeStoredWriterTargetSessions(nextSessions);
}

export function removeStoredWriterTargetSession(writerId: string) {
    const nextSessions = readStoredWriterTargetSessions().filter((entry) => entry.writerId !== writerId);
    writeStoredWriterTargetSessions(nextSessions);
}

export function flattenStoredWriterTargets(now = Date.now(), ttlMs = LIVE_WRITER_TARGET_TTL_MS) {
    const freshSessions = readStoredWriterTargetSessions().filter((session) => now - session.lastSeen < ttlMs);
    writeStoredWriterTargetSessions(freshSessions, { notify: false });

    return freshSessions.flatMap((session) =>
        session.targets.map((target) => ({
            ...target,
            writerId: session.writerId,
            documentTitle: session.documentTitle,
            documentId: session.documentId,
            lastSeen: session.lastSeen,
        })),
    ) as StoredWriterTarget[];
}

export function readStoredWriterTargetSyncs() {
    if (typeof window === "undefined") {
        return [] as StoredWriterTargetSync[];
    }

    const raw = window.localStorage.getItem(LIVE_WRITER_TARGET_SYNC_STORAGE_KEY);
    if (!raw) {
        return [] as StoredWriterTargetSync[];
    }

    try {
        const parsed = JSON.parse(raw) as StoredWriterTargetSync[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function writeStoredWriterTargetSyncs(syncs: StoredWriterTargetSync[]) {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(LIVE_WRITER_TARGET_SYNC_STORAGE_KEY, JSON.stringify(syncs));
    notifyLiveWriterSyncChanged();
}

export function upsertStoredWriterTargetSync(sync: StoredWriterTargetSync) {
    const key = buildTargetSyncKey(sync.writerId, sync.targetId);
    const nextSyncs = readStoredWriterTargetSyncs().filter(
        (entry) => buildTargetSyncKey(entry.writerId, entry.targetId) !== key,
    );
    nextSyncs.push(sync);
    writeStoredWriterTargetSyncs(nextSyncs);
}

export function getStoredWriterTargetSync(writerId: string, targetId: string) {
    const key = buildTargetSyncKey(writerId, targetId);
    return readStoredWriterTargetSyncs().find((entry) => buildTargetSyncKey(entry.writerId, entry.targetId) === key) ?? null;
}

export function markStoredWriterTargetPending(params: {
    writerId: string;
    targetId: string;
    revision: number;
    publishedAt: string;
    sourceLabel: string;
    blockTitle?: string;
    documentTitle?: string;
}) {
    const current = getStoredWriterTargetSync(params.writerId, params.targetId);

    upsertStoredWriterTargetSync({
        writerId: params.writerId,
        targetId: params.targetId,
        revision: params.revision,
        state: "pending",
        lastPushedAt: Date.parse(params.publishedAt),
        lastAckAt: current?.lastAckAt,
        blockTitle: params.blockTitle ?? current?.blockTitle,
        documentTitle: params.documentTitle ?? current?.documentTitle,
        sourceLabel: params.sourceLabel,
    });
}

export function markStoredWriterTargetAcknowledged(ack: LabPublishAckBroadcast) {
    const current = getStoredWriterTargetSync(ack.writerId, ack.targetId);

    upsertStoredWriterTargetSync({
        writerId: ack.writerId,
        targetId: ack.targetId,
        revision: ack.revision,
        state: "acknowledged",
        lastPushedAt: current?.lastPushedAt ?? Date.parse(ack.acknowledgedAt),
        lastAckAt: Date.parse(ack.acknowledgedAt),
        blockTitle: ack.blockTitle,
        documentTitle: ack.documentTitle,
        sourceLabel: ack.sourceLabel,
    });
}

export function createLiveWriterPublishMessage(params: {
    writerId: string;
    targetId: string;
    payload: WriterBridgeBlockData;
    sourceLabel: string;
}) {
    const current = getStoredWriterTargetSync(params.writerId, params.targetId);
    const revision = Math.max(current?.revision ?? 0, params.payload.sync?.revision ?? 0) + 1;
    const publishedAt = new Date().toISOString();

    return {
        type: "lab-publish",
        writerId: params.writerId,
        targetId: params.targetId,
        revision,
        publishedAt,
        sourceLabel: params.sourceLabel,
        payload: {
            ...params.payload,
            id: params.targetId,
            sync: {
                revision,
                pushedAt: publishedAt,
                sourceLabel: params.sourceLabel,
            },
        },
    } satisfies LabPublishBroadcast;
}

export function publishToLiveWriterTarget(params: {
    writerId: string;
    targetId: string;
    payload: WriterBridgeBlockData;
    sourceLabel: string;
    documentTitle?: string;
}) {
    const channel = createBroadcastChannel();
    if (!channel) {
        return null;
    }

    const message = createLiveWriterPublishMessage(params);
    markStoredWriterTargetPending({
        writerId: params.writerId,
        targetId: params.targetId,
        revision: message.revision,
        publishedAt: message.publishedAt,
        sourceLabel: params.sourceLabel,
        blockTitle: message.payload.title,
        documentTitle: params.documentTitle,
    });
    channel.postMessage(message);
    channel.close();

    return message;
}

export function createLiveWriterPublishAck(params: {
    message: LabPublishBroadcast;
    acknowledgedAt: string;
    documentTitle: string;
    blockTitle: string;
}) {
    return {
        type: "lab-publish-ack",
        writerId: params.message.writerId,
        targetId: params.message.targetId,
        revision: params.message.revision,
        acknowledgedAt: params.acknowledgedAt,
        documentTitle: params.documentTitle,
        blockTitle: params.blockTitle,
        sourceLabel: params.message.sourceLabel,
    } satisfies LabPublishAckBroadcast;
}

export function createWaitingWriterBridgeBlock(title = "Live Laboratory Block"): WriterBridgeBlockData {
    return {
        id: buildId(),
        status: "waiting",
        moduleSlug: "live-writer-bridge",
        kind: "placeholder",
        profile: "full",
        title,
        summary: "Laboratoriyadan live natija kutilyapti.",
        generatedAt: new Date().toISOString(),
        metrics: [],
        notes: [
            "Bu blok laboratoriya bilan bog'lanish uchun target sifatida ishlatiladi.",
            "Laboratoriyada shu targetni tanlab `Live push` bossangiz, blok avtomatik yangilanadi.",
        ],
    };
}

export function serializeWriterBridgeBlock(block: WriterBridgeBlockData) {
    return `\`\`\`${LIVE_WRITER_BLOCK_LANGUAGE}\n${JSON.stringify(block, null, 2)}\n\`\`\``;
}

export function parseWriterBridgeBlock(raw: string) {
    try {
        const parsed = JSON.parse(raw) as WriterBridgeBlockData;
        if (!parsed || typeof parsed !== "object" || typeof parsed.id !== "string") {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

export function extractWriterBridgeBlocks(content: string) {
    const blocks: WriterBridgeBlockData[] = [];
    for (const match of content.matchAll(LAB_RESULT_BLOCK_REGEX)) {
        const parsed = parseWriterBridgeBlock(match[1]);
        if (parsed) {
            blocks.push(parsed);
        }
    }

    return blocks;
}

function buildWriterSectionSnapshot(headings: string[]) {
    const sectionPath = headings.filter(Boolean).join(" > ");
    return {
        sectionLabel: headings.filter(Boolean).slice(-1)[0],
        sectionPath: sectionPath || undefined,
    };
}

export function extractWriterBridgeTargets(content: string) {
    const targets: WriterBridgeTarget[] = [];
    const headings: string[] = [];
    const lines = content.split(/\r?\n/);
    let fenceMode: "generic" | "lab-result" | null = null;
    let labBlockBuffer: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (fenceMode === "lab-result") {
            if (trimmed === "```") {
                const parsed = parseWriterBridgeBlock(labBlockBuffer.join("\n"));
                if (parsed) {
                    // Each live block inherits the nearest heading path so lab users can target an exact section.
                    targets.push(blockToTarget(parsed, buildWriterSectionSnapshot(headings)));
                }
                fenceMode = null;
                labBlockBuffer = [];
                continue;
            }

            labBlockBuffer.push(line);
            continue;
        }

        if (fenceMode === "generic") {
            if (trimmed.startsWith("```")) {
                fenceMode = null;
            }
            continue;
        }

        if (trimmed === "```lab-result") {
            fenceMode = "lab-result";
            labBlockBuffer = [];
            continue;
        }

        if (trimmed.startsWith("```")) {
            fenceMode = "generic";
            continue;
        }

        const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(trimmed);
        if (!headingMatch) {
            continue;
        }

        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        headings[level - 1] = title;
        headings.length = level;
    }

    return targets;
}

export function replaceWriterBridgeBlock(content: string, nextBlock: WriterBridgeBlockData) {
    let replaced = false;

    const nextContent = content.replace(LAB_RESULT_BLOCK_REGEX, (fullMatch, rawJson) => {
        const parsed = parseWriterBridgeBlock(rawJson);
        if (!parsed || parsed.id !== nextBlock.id) {
            return fullMatch;
        }

        replaced = true;
        return serializeWriterBridgeBlock(nextBlock);
    });

    if (replaced) {
        return nextContent;
    }

    const suffix = nextContent.trimEnd();
    return `${suffix}\n\n${serializeWriterBridgeBlock(nextBlock)}\n`;
}

export function blockToTarget(
    block: WriterBridgeBlockData,
    context: Pick<WriterBridgeTarget, "sectionLabel" | "sectionPath"> = {},
): WriterBridgeTarget {
    return {
        id: block.id,
        title: block.title,
        profile: block.profile,
        status: block.status,
        generatedAt: block.generatedAt,
        revision: block.sync?.revision,
        savedResultId: block.savedResultId,
        savedResultRevision: block.savedResultRevision,
        lastPublishedAt: block.sync?.pushedAt,
        lastAcknowledgedAt: block.sync?.acknowledgedAt,
        sourceLabel: block.sync?.sourceLabel,
        sectionLabel: context.sectionLabel,
        sectionPath: context.sectionPath,
    };
}

export function queueWriterImport(payload: WriterImportPayload | string) {
    if (typeof window === "undefined") {
        return "";
    }

    const normalizedPayload: WriterImportPayload =
        typeof payload === "string"
            ? {
                  version: LIVE_WRITER_EXPORT_VERSION,
                  markdown: payload,
              }
            : payload;

    const requestId = normalizedPayload.requestId || createWriterImportRequestId();
    const payloadWithRequestId = {
        ...normalizedPayload,
        requestId,
    } satisfies WriterImportPayload;

    // A dedicated request id prevents a stale /write/new tab from consuming another export.
    window.localStorage.setItem(buildWriterImportStorageKey(requestId), JSON.stringify(payloadWithRequestId));
    window.localStorage.setItem(LIVE_WRITER_EXPORT_KEY, JSON.stringify(payloadWithRequestId));

    return requestId;
}

export function readQueuedWriterImport(requestId?: string): WriterImportPayload | null {
    if (typeof window === "undefined") {
        return null;
    }

    const raw = requestId
        ? window.localStorage.getItem(buildWriterImportStorageKey(requestId))
        : window.localStorage.getItem(LIVE_WRITER_EXPORT_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as WriterImportPayload;
        if (!parsed || typeof parsed !== "object" || typeof parsed.markdown !== "string") {
            return {
                version: LIVE_WRITER_EXPORT_VERSION,
                markdown: raw,
            };
        }

        return parsed;
    } catch {
        return {
            version: LIVE_WRITER_EXPORT_VERSION,
            markdown: raw,
        };
    }
}

export function removeQueuedWriterImport(requestId?: string) {
    if (typeof window === "undefined") {
        return;
    }

    if (requestId) {
        window.localStorage.removeItem(buildWriterImportStorageKey(requestId));
    }

    const legacyPayload = readQueuedWriterImport();
    if (!requestId || legacyPayload?.requestId === requestId) {
        window.localStorage.removeItem(LIVE_WRITER_EXPORT_KEY);
    }
}
