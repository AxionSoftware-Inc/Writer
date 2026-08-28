const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/";
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;
const PLOT_RESULT_PREFIX = "__WRITER_PLOT__:";

let pyodidePromise = null;
let pyodideReady = false;
let executionQueue = Promise.resolve();

function post(id, payload) {
    self.postMessage({ id, ...payload });
}

function getPyodide() {
    if (!pyodidePromise) {
        importScripts(PYODIDE_SCRIPT_URL);
        if (typeof self.loadPyodide !== "function") {
            throw new Error("Pyodide loader topilmadi.");
        }
        pyodidePromise = self.loadPyodide({ indexURL: PYODIDE_INDEX_URL }).then((runtime) => {
            pyodideReady = true;
            return runtime;
        });
    }
    return pyodidePromise;
}

function destroyProxy(value) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return;
    if (typeof value.destroy === "function") {
        try {
            value.destroy();
        } catch {
            // Already-converted or already-disposed values need no cleanup.
        }
    }
}

async function execute(message) {
    const id = message.id;
    const code = typeof message.code === "string" ? message.code : "";
    if (!id) return;

    let result;
    try {
        if (!pyodideReady) post(id, { type: "status", status: "loading" });
        const pyodide = await getPyodide();
        post(id, { type: "status", status: "ready" });

        pyodide.setStdout({
            batched(value) {
                post(id, { type: "output", stream: "stdout", value: `${value}\n` });
            },
        });
        pyodide.setStderr({
            batched(value) {
                post(id, { type: "output", stream: "stderr", value: `${value}\n` });
            },
        });

        if (typeof pyodide.loadPackagesFromImports === "function") {
            await pyodide.loadPackagesFromImports(code);
        }

        const needsMatplotlib = /\bmatplotlib\b|\bplt\./.test(code);
        if (needsMatplotlib) await pyodide.loadPackage("matplotlib");

        const wrappedCode = needsMatplotlib
            ? `
import io
import base64
${code}

try:
    import matplotlib.pyplot as plt
    if plt.get_fignums():
        _writer_buf = io.BytesIO()
        plt.savefig(_writer_buf, format='png', bbox_inches='tight')
        _writer_buf.seek(0)
        _writer_result = base64.b64encode(_writer_buf.read()).decode('utf-8')
        plt.close('all')
        '${PLOT_RESULT_PREFIX}' + _writer_result
    else:
        None
except Exception:
    None
`
            : code;

        result = await pyodide.runPythonAsync(wrappedCode);

        if (typeof result === "string" && result.startsWith(PLOT_RESULT_PREFIX)) {
            post(id, { type: "result", resultKind: "plot", value: result.slice(PLOT_RESULT_PREFIX.length) });
            return;
        }

        if (result === undefined || result === null) {
            post(id, { type: "result", resultKind: "none" });
            return;
        }

        post(id, { type: "result", resultKind: "text", value: String(result) });
    } catch (error) {
        post(id, {
            type: "error",
            message: error instanceof Error ? error.message : String(error),
        });
    } finally {
        destroyProxy(result);
    }
}

self.onmessage = (event) => {
    const message = event.data;
    if (!message || message.type !== "execute" || typeof message.id !== "string") return;

    executionQueue = executionQueue.then(
        () => execute(message),
        () => execute(message),
    );
};
