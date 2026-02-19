import type {
  ExecuteTaskError,
  ExecuteTaskFailureResponse,
  ExecuteTaskParams,
  ExecuteTaskResponse,
} from "./types";
import {
  debugApiBaseUrl,
  parseJsonOrText,
  resolveApiBaseUrl,
  toHttpError,
  toNetworkError,
} from "./http";

export async function executeTask<TOutput = unknown>(
  params: ExecuteTaskParams
): Promise<ExecuteTaskResponse<TOutput>> {
  const { organizationId, taskId, inputs, conversationId, apiToken, apiBaseUrl } = params;
  const baseUrl = resolveApiBaseUrl(apiBaseUrl);
  debugApiBaseUrl(baseUrl);

  try {
    if (!organizationId) {
      return toExecuteTaskFailure({
        code: "MISSING_ORGANIZATION_ID",
        message: "organizationId is required to execute a task",
      });
    }

    if (!taskId) {
      return toExecuteTaskFailure({
        code: "MISSING_TASK_ID",
        message: "taskId is required to execute a task",
      });
    }

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add Bearer token if provided (RECOMMENDED)
    if (apiToken) {
      headers["Authorization"] = `Bearer ${apiToken}`;
    }

    // Add conversation ID header if provided
    if (conversationId) {
      headers["x-conversation-id"] = conversationId;
    }

    const orgIdEncoded = encodeURIComponent(organizationId);
    const taskIdEncoded = encodeURIComponent(taskId);
    const response = await fetch(
      `${baseUrl}/v1/organizations/${orgIdEncoded}/tasks/${taskIdEncoded}/execute`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ inputs }),
      }
    );
    const rawData = await parseJsonOrText(response);
    const data = decodeBase64BytesPayloads(rawData);

    if (!response.ok) {
      return toExecuteTaskFailure(toHttpError(response, data));
    }

    if (isActionExecutePayload<TOutput>(data)) {
      if (data.success === false) {
        return toExecuteTaskFailure(toActionExecutionError(data));
      }

      if ("result" in data) {
        return toExecuteTaskSuccess(data.result as TOutput);
      }
    }

    return toExecuteTaskSuccess((data ?? undefined) as TOutput);
  } catch (error) {
    return toExecuteTaskFailure(toNetworkError(error));
  }
}

export function createExecuteTask(contextAuth?: {
  organizationId?: string;
  apiToken?: string;
  conversationId?: string;
  apiBaseUrl?: string;
}) {
  return <TOutput = unknown>(
    params: Omit<ExecuteTaskParams, "conversationId" | "apiToken" | "apiBaseUrl"> & {
      organizationId?: string;
    }
  ): Promise<ExecuteTaskResponse<TOutput>> => {
    const { organizationId, ...restParams } = params;

    return executeTask<TOutput>({
      ...restParams,
      organizationId: organizationId ?? contextAuth?.organizationId ?? "",
      apiToken: contextAuth?.apiToken,
      conversationId: contextAuth?.conversationId,
      apiBaseUrl: contextAuth?.apiBaseUrl,
    });
  };
}

interface ActionExecutePayload<TOutput = unknown> {
  success?: boolean;
  error?: unknown;
  result?: TOutput;
}

interface Base64BytesPayload {
  type: "bytes";
  encoding: "base64";
  mime_type?: string;
  name?: string;
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBase64BytesPayload(value: unknown): value is Base64BytesPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === "bytes" &&
    value.encoding === "base64" &&
    typeof value.content === "string"
  );
}

function decodeBase64BytesPayloads(value: unknown): unknown {
  if (isBase64BytesPayload(value)) {
    try {
      return decodeBase64ToUint8Array(value.content);
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => decodeBase64BytesPayloads(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const transformed: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    transformed[key] = decodeBase64BytesPayloads(nestedValue);
  }

  return transformed;
}

function decodeBase64ToUint8Array(base64Value: string): Uint8Array {
  const normalizedBase64 = base64Value.replace(/\s+/g, "");

  if (typeof globalThis.atob === "function") {
    const decoded = globalThis.atob(normalizedBase64);
    const bytes = new Uint8Array(decoded.length);

    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }

    return bytes;
  }

  const globalWithOptionalBuffer = globalThis as {
    Buffer?: { from(input: string, encoding: string): Uint8Array };
  };
  if (globalWithOptionalBuffer.Buffer) {
    return Uint8Array.from(globalWithOptionalBuffer.Buffer.from(normalizedBase64, "base64"));
  }

  throw new Error("No base64 decoder available in this environment");
}

function isActionExecutePayload<TOutput = unknown>(
  value: unknown
): value is ActionExecutePayload<TOutput> {
  return isRecord(value) && ("result" in value || "success" in value || "error" in value);
}

function toActionExecutionError(payload: ActionExecutePayload<unknown>): ExecuteTaskError {
  const message =
    typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : "Task execution failed";

  return {
    code: "TASK_EXECUTION_FAILED",
    message,
    details: payload,
  };
}

function toExecuteTaskSuccess<TOutput>(data: TOutput): ExecuteTaskResponse<TOutput> {
  return {
    success: true,
    data,
  };
}

function toExecuteTaskFailure(error: ExecuteTaskError): ExecuteTaskFailureResponse {
  return {
    success: false,
    data: error,
  };
}

export function isExecuteTaskError(
  value: unknown
): value is ExecuteTaskError | ExecuteTaskFailureResponse {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.code === "string" && typeof value.message === "string") {
    return true;
  }

  if (value.success !== false || !("data" in value) || !isRecord(value.data)) {
    return false;
  }

  return typeof value.data.code === "string" && typeof value.data.message === "string";
}
