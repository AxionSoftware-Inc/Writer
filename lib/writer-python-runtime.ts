export type WriterPythonEngineStatus = "loading" | "ready";

export type WriterPythonExecutionResult =
    | { kind: "none" }
    | { kind: "text"; value: string }
    | { kind: "plot"; value: string };

type PendingExecution = {
    resolve: (value: WriterPythonExecutionResult) => void;
    reject: (reason: Error) => void;
    onOutput?: (value: string, stream: "stdout" | "stderr") => void;
    onStatus?: (status: WriterPythonEngineStatus) => void;
};

type WorkerMessage =
    | { id: string; type: "status"; status: WriterPythonEngineStatus }
    | { id: string; type: "output"; stream: "stdout" | "stderr"; value: string }
    | { id: string; type: "result"; resultKind: "none" | "text" | "plot"; value?: string }
    | { id: string; type: "error"; message: string };

let sharedWorker: Worker | null = null;
let sequence = 0;
const pendingExecutions = new Map<string, PendingExecution>();

function rejectAllPending(message: string) {
    const error = new Error(message);
    for (const pending of pendingExecutions.values()) pending.reject(error);
    pendingExecutions.clear();
}

function handleWorkerMessage(event: MessageEvent<WorkerMessage>) {
    const message = event.data;
    const pending = message?.id ? pendingExecutions.get(message.id) : undefined;
    if (!pending) return;

    if (message.type === "status") {
        pending.onStatus?.(message.status);
        return;
    }

    if (message.type === "output") {
        pending.onOutput?.(message.value, message.stream);
        return;
    }

    if (message.type === "error") {
        pendingExecutions.delete(message.id);
        pending.reject(new Error(message.message));
        return;
    }

    pendingExecutions.delete(message.id);
    if (message.resultKind === "plot" && typeof message.value === "string") {
        pending.resolve({ kind: "plot", value: message.value });
    } else if (message.resultKind === "text" && typeof message.value === "string") {
        pending.resolve({ kind: "text", value: message.value });
    } else {
        pending.resolve({ kind: "none" });
    }
}

function getWriterPythonWorker() {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
        throw new Error("Python engine Web Worker qo‘llab-quvvatlanadigan brauzerni talab qiladi.");
    }

    if (!sharedWorker) {
        sharedWorker = new Worker("/writer-pyodide-worker.js");
        sharedWorker.addEventListener("message", handleWorkerMessage);
        sharedWorker.addEventListener("error", () => {
            rejectAllPending("Writer Python worker ishlashdan to‘xtadi.");
            sharedWorker?.terminate();
            sharedWorker = null;
        });
        sharedWorker.addEventListener("messageerror", () => {
            rejectAllPending("Writer Python worker noto‘g‘ri javob qaytardi.");
        });
    }

    return sharedWorker;
}

export function executeWriterPython(
    code: string,
    callbacks: {
        onOutput?: (value: string, stream: "stdout" | "stderr") => void;
        onStatus?: (status: WriterPythonEngineStatus) => void;
    } = {},
) {
    const worker = getWriterPythonWorker();
    const id = `writer-python-${Date.now()}-${sequence++}`;

    return new Promise<WriterPythonExecutionResult>((resolve, reject) => {
        pendingExecutions.set(id, {
            resolve,
            reject,
            onOutput: callbacks.onOutput,
            onStatus: callbacks.onStatus,
        });
        worker.postMessage({ type: "execute", id, code });
    });
}
