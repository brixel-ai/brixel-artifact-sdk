import type {
  ExecuteTaskError,
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
      return {
        code: "MISSING_ORGANIZATION_ID",
        message: "organizationId is required to execute a task",
      };
    }

    if (!taskId) {
      return {
        code: "MISSING_TASK_ID",
        message: "taskId is required to execute a task",
      };
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
    const data = await parseJsonOrText(response);

    if (!response.ok) {
      return toHttpError(response, data);
    }

    if (isActionExecutePayload<TOutput>(data)) {
      if (data.success === false) {
        return toActionExecutionError(data);
      }

      if ("result" in data) {
        return data.result as TOutput;
      }
    }

    return (data ?? undefined) as TOutput;
  } catch (error) {
    return toNetworkError(error);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export function isExecuteTaskError(value: unknown): value is ExecuteTaskError {
  return isRecord(value) && typeof value.code === "string" && typeof value.message === "string";
}
