import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BrixelContext,
  HostToIframeMessage,
  RenderMode,
  TaskStatus,
  UseBrixelTaskOptions,
  UseBrixelTaskResult,
} from "./types";
import { createExecuteTask } from "./executeTask";
import { createUploadFile } from "./uploadFile";
import { createGetFileContent } from "./getFileContent";

const SDK_VERSION = "1.0.0";

/**
 * Check if running inside an iframe
 */
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function useBrixelArtifact<TInputs = unknown, TOutput = unknown>(
  options: UseBrixelTaskOptions = {}
): UseBrixelTaskResult<TInputs, TOutput> {
  const {
    targetOrigin = "*",
    onInputsUpdate,
    onDestroy,
    debug = false,
    autoResize = false,
  } = options;

  const [inputs, setInputs] = useState<TInputs | null>(null);
  const [context, setContext] = useState<BrixelContext | null>(null);
  const [status, setStatus] = useState<TaskStatus>("initializing");
  const [renderMode, setRenderMode] = useState<RenderMode | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const isEmbedded = useRef(isInIframe());
  const parentWindow = useRef<Window | null>(null);
  const hasCompleted = useRef(false);

  const debugLog = useCallback(
    (message: string, data?: unknown) => {
      if (debug) {
        console.debug(`[BrixelSDK] ${message}`, data ?? "");
      }
    },
    [debug]
  );

  const postToParent = useCallback(
    (message: unknown) => {
      if (parentWindow.current) {
        debugLog("Sending message to parent:", message);
        parentWindow.current.postMessage(message, targetOrigin);
      } else {
        debugLog("Cannot send message - no parent window");
      }
    },
    [targetOrigin, debugLog]
  );

  const completeTask = useCallback(
    (type: "BRIXEL_COMPLETE" | "BRIXEL_CANCEL", payload: Record<string, unknown>) => {
      if (hasCompleted.current) {
        debugLog(`Already completed, ignoring ${type} call`);
        return;
      }

      if (!runId) {
        console.error(`[BrixelSDK] Cannot send ${type} - no runId`);
        return;
      }

      hasCompleted.current = true;
      setStatus(type === "BRIXEL_COMPLETE" ? "completed" : "cancelled");
      postToParent({ type, payload: { runId, ...payload } });
    },
    [runId, postToParent, debugLog]
  );

  const complete = useCallback(
    (output: TOutput) => {
      completeTask("BRIXEL_COMPLETE", { output });
      debugLog("Task completed with output:", output);
    },
    [completeTask, debugLog]
  );

  const cancel = useCallback(
    (reason?: string) => {
      completeTask("BRIXEL_CANCEL", { reason });
      debugLog("Task cancelled:", reason);
    },
    [completeTask, debugLog]
  );

  const setHeight = useCallback(
    (height: number | "auto") => {
      if (!runId) return;

      postToParent({
        type: "BRIXEL_RESIZE",
        payload: { runId, height },
      });

      debugLog("Resize requested:", height);
    },
    [runId, postToParent, debugLog]
  );

  const log = useCallback(
    (level: "debug" | "info" | "warn" | "error", message: string, data?: unknown) => {
      if (!runId) return;

      postToParent({
        type: "BRIXEL_LOG",
        payload: { runId, level, message, data },
      });
    },
    [runId, postToParent]
  );

  useEffect(() => {
    parentWindow.current = isEmbedded.current ? window.parent : window;

    if (!isEmbedded.current) {
      debugLog("Not in iframe, SDK will work in standalone mode (dev tools compatible)");
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data as HostToIframeMessage<TInputs>;

      if (!message || typeof message !== "object" || !message.type) {
        return;
      }

      if (!message.type.startsWith("BRIXEL_")) {
        return;
      }

      debugLog("Received message:", message);

      switch (message.type) {
        case "BRIXEL_INIT": {
          const { runId: newRunId, inputs: newInputs, context: newContext, renderMode: mode } =
            message.payload;

          setRunId(newRunId);
          setInputs(newInputs);
          setContext(newContext);
          setRenderMode(mode);
          setStatus("ready");
          hasCompleted.current = false;

          debugLog("Initialized with:", { runId: newRunId, inputs: newInputs, context: newContext });
          break;
        }

        case "BRIXEL_UPDATE_INPUTS": {
          const { inputs: updatedInputs } = message.payload;
          setInputs((prev) => (prev ? { ...prev, ...updatedInputs } : (updatedInputs as TInputs)));
          onInputsUpdate?.(updatedInputs);
          debugLog("Inputs updated:", updatedInputs);
          break;
        }

        case "BRIXEL_DESTROY": {
          onDestroy?.();
          debugLog("Destroy received");
          break;
        }

        case "BRIXEL_UPDATE_THEME": {
          const { theme } = message.payload;
          setContext((prev) => (prev ? { ...prev, theme } : prev));
          debugLog("Theme updated:", theme);
          break;
        }

        case "BRIXEL_UPDATE_LOCALE": {
          const { locale } = message.payload;
          setContext((prev) => (prev ? { ...prev, locale } : prev));
          debugLog("Locale updated:", locale);
          break;
        }
      }
    };

    window.addEventListener("message", handleMessage);

    postToParent({
      type: "BRIXEL_READY",
      payload: { version: SDK_VERSION },
    });

    debugLog("SDK initialized, READY sent");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [debugLog, postToParent, onInputsUpdate, onDestroy]);

  useEffect(() => {
    if (!runId || !isEmbedded.current || !autoResize) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        setHeight(height);
      }
    });

    resizeObserver.observe(document.body);

    return () => {
      resizeObserver.disconnect();
    };
  }, [runId, autoResize, setHeight]);

  const executeTask = useMemo(
    () =>
      createExecuteTask({
        organizationId: context?.organizationId,
        apiToken: context?.apiToken,
        conversationId: context?.conversationId,
        apiBaseUrl: context?.apiBaseUrl,
      }),
    [context?.organizationId, context?.apiToken, context?.conversationId, context?.apiBaseUrl]
  );

  const uploadFile = useMemo(
    () =>
      createUploadFile({
        organizationId: context?.organizationId,
        apiToken: context?.apiToken,
        apiBaseUrl: context?.apiBaseUrl,
      }),
    [context?.organizationId, context?.apiToken, context?.apiBaseUrl]
  );

  const getFileContent = useMemo(
    () =>
      createGetFileContent({
        organizationId: context?.organizationId,
        conversationId: context?.conversationId,
        apiToken: context?.apiToken,
        apiBaseUrl: context?.apiBaseUrl,
      }),
    [context?.organizationId, context?.conversationId, context?.apiToken, context?.apiBaseUrl]
  );

  return {
    inputs,
    context,
    status,
    renderMode,
    runId,
    complete,
    cancel,
    setHeight,
    log,
    isEmbedded: isEmbedded.current,
    executeTask,
    uploadFile,
    getFileContent,
  };
}
