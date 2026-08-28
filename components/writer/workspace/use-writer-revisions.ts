"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    compareWriterRevisions,
    createWriterRevisionSnapshot,
    type WriterRevisionSnapshot,
} from "@/lib/writer-intelligence";

function safeRandomId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `writer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useWriterRevisions({
    storageKey,
    currentContent,
    currentAbstract,
}: {
    storageKey: string;
    currentContent: string;
    currentAbstract: string;
}) {
    const [snapshots, setSnapshots] = useState<WriterRevisionSnapshot[]>([]);
    const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

    const selectedSnapshot =
        snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? snapshots[0] ?? null;

    const comparison = useMemo(
        () =>
            selectedSnapshot
                ? compareWriterRevisions(
                      currentContent,
                      selectedSnapshot.content,
                      currentAbstract,
                      selectedSnapshot.abstract,
                  )
                : null,
        [currentAbstract, currentContent, selectedSnapshot],
    );

    const createSnapshot = useCallback((input: {
        label: string;
        title: string;
        abstract: string;
        content: string;
        sectionCount: number;
    }) => {
        const snapshot = createWriterRevisionSnapshot({
            id: safeRandomId(),
            ...input,
        });
        setSnapshots((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 12));
        setSelectedSnapshotId(snapshot.id);
        return snapshot;
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
                setSnapshots([]);
                setSelectedSnapshotId(null);
                return;
            }
            const parsed = JSON.parse(raw) as WriterRevisionSnapshot[];
            const next = Array.isArray(parsed) ? parsed.slice(0, 12) : [];
            setSnapshots(next);
            setSelectedSnapshotId(next[0]?.id ?? null);
        } catch {
            setSnapshots([]);
            setSelectedSnapshotId(null);
        }
    }, [storageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(snapshots.slice(0, 12)));
        } catch {
            // Revision history is a local convenience and must not block editing.
        }
    }, [snapshots, storageKey]);

    return {
        snapshots,
        selectedSnapshot,
        comparison,
        setSelectedSnapshotId,
        createSnapshot,
    };
}
