import type { InternalFilePublicOut, UploadFileParams, UploadFileResponse } from "./types";
import {
  debugApiBaseUrl,
  parseJsonOrText,
  resolveApiBaseUrl,
  toHttpError,
  toNetworkError,
} from "./http";

export async function uploadFile<TOutput = InternalFilePublicOut>(
  params: UploadFileParams
): Promise<UploadFileResponse<TOutput>> {
  const { file, organizationId, apiToken, apiBaseUrl } = params;
  const baseUrl = resolveApiBaseUrl(apiBaseUrl);
  debugApiBaseUrl(baseUrl);

  try {
    if (!file) {
      return {
        success: false,
        error: {
          code: "MISSING_FILE",
          message: "file is required for upload",
        },
      };
    }

    const headers: Record<string, string> = {};
    if (apiToken) {
      headers["Authorization"] = `Bearer ${apiToken}`;
    }
    if (organizationId) {
      headers["X-Organization-Id"] = organizationId;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("visibility", "user");

    const response = await fetch(`${baseUrl}/v1/files/`, {
      method: "POST",
      headers,
      body: formData,
    });

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

export function createUploadFile(contextAuth?: {
  organizationId?: string;
  apiToken?: string;
  apiBaseUrl?: string;
}) {
  return <TOutput = InternalFilePublicOut>(
    params: Omit<UploadFileParams, "organizationId" | "apiToken" | "apiBaseUrl"> & {
      organizationId?: string;
    }
  ): Promise<UploadFileResponse<TOutput>> => {
    const { organizationId, ...restParams } = params;

    return uploadFile<TOutput>({
      ...restParams,
      organizationId: organizationId ?? contextAuth?.organizationId,
      apiToken: contextAuth?.apiToken,
      apiBaseUrl: contextAuth?.apiBaseUrl,
    });
  };
}
