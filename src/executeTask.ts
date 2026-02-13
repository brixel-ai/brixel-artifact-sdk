import type { ExecuteTaskParams, ExecuteTaskResponse } from "./types";
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
        success: false,
        error: {
          code: "MISSING_ORGANIZATION_ID",
          message: "organizationId is required to execute a task",
        },
      };
    }

    if (!taskId) {
      return {
        success: false,
        error: {
          code: "MISSING_TASK_ID",
          message: "taskId is required to execute a task",
        },
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
      return {
        success: false,
        error: toHttpError(response, data),
      };
    }

    return {
      success: true,
      data: (data ?? undefined) as TOutput,
    };
  } catch (error) {
    return {
      success: false,
      error: toNetworkError(error),
    };
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
