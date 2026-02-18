import type { BrixelContext, RenderMode } from "./types";

/**
 * Development tools for testing UI Tasks outside of Brixel
 *
 * These utilities help simulate the Brixel host environment during development
 */

/**
 * Simulate the Brixel host sending an INIT message
 *
 * @example
 * ```tsx
 * // In your main.tsx or App.tsx for development
 * if (import.meta.env.DEV) {
 *   simulateBrixelInit({
 *     title: "Test Survey",
 *     questions: [
 *       { id: "q1", text: "How are you?", options: ["Good", "Bad"] }
 *     ]
 *   });
 * }
 * ```
 */
export function simulateBrixelInit<TInputs = unknown>(
  inputs: TInputs,
  options: {
    runId?: string;
    renderMode?: RenderMode;
    context?: Partial<BrixelContext>;
    delay?: number;
  } = {}
): void {
  const { runId = "dev-run-001", renderMode = "interaction", context = {}, delay = 100 } = options;

  const message = {
    type: "BRIXEL_INIT",
    payload: {
      runId,
      inputs,
      context: { ...context, runId },
      renderMode,
    },
  };

  // Delay to ensure the component has mounted and listeners are ready
  setTimeout(() => {
    window.postMessage(message, "*");
    console.debug("[BrixelDevTools] Simulated INIT message sent:", message);
  }, delay);
}

/**
 * Listen for messages from the UI Task (useful for debugging)
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const cleanup = listenToUITaskMessages((message) => {
 *     console.debug("Artifact sent:", message);
 *   });
 *   return cleanup;
 * }, []);
 * ```
 */
export function listenToUITaskMessages(
  callback: (message: unknown) => void
): () => void {
  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    if (message && typeof message === "object" && message.type?.startsWith("BRIXEL_")) {
      callback(message);
    }
  };

  window.addEventListener("message", handleMessage);

  return () => {
    window.removeEventListener("message", handleMessage);
  };
}
