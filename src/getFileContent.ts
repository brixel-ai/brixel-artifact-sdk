import type {
  FileContentData,
  GetFileContentParams,
  GetFileContentResponse,
} from "./types";
import {
  debugApiBaseUrl,
  parseJsonOrText,
  resolveApiBaseUrl,
  toHttpError,
  toNetworkError,
} from "./http";

export async function getFileContent<TOutput = FileContentData>(
  params: GetFileContentParams
): Promise<GetFileContentResponse<TOutput>> {
  const {
    brixelFileId,
    organizationId,
    conversationId,
    apiToken,
    apiBaseUrl,
    ifNoneMatch,
    ifModifiedSince,
  } = params;
  const baseUrl = resolveApiBaseUrl(apiBaseUrl);
  debugApiBaseUrl(baseUrl);

  try {
    if (!brixelFileId) {
      return {
        success: false,
        error: {
          code: "MISSING_FILE_ID",
          message: "brixelFileId is required",
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
    if (conversationId) {
      headers["X-Conversation-Id"] = conversationId;
    }
    if (ifNoneMatch) {
      headers["If-None-Match"] = ifNoneMatch;
    }
    if (ifModifiedSince) {
      headers["If-Modified-Since"] = ifModifiedSince;
    }

    const fileIdEncoded = encodeURIComponent(brixelFileId);
    const response = await fetch(`${baseUrl}/v1/files/${fileIdEncoded}/content`, {
      method: "GET",
      headers,
    });

    if (response.status === 304) {
      return {
        success: true,
        notModified: true,
      };
    }

    if (!response.ok) {
      const data = await parseJsonOrText(response);

      return {
        success: false,
        error: toHttpError(response, data),
      };
    }

    const blob = await response.blob();
    const contentType = response.headers.get("Content-Type");
    const contentLengthRaw = response.headers.get("Content-Length");
    const contentLength = contentLengthRaw ? Number(contentLengthRaw) : undefined;

    const fileData: FileContentData = {
      blob,
      contentType,
      contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
      etag: response.headers.get("ETag"),
      lastModified: response.headers.get("Last-Modified"),
    };

    return {
      success: true,
      data: fileData as TOutput,
    };
  } catch (error) {
    return {
      success: false,
      error: toNetworkError(error),
    };
  }
}

export function createGetFileContent(contextAuth?: {
  organizationId?: string;
  conversationId?: string;
  apiToken?: string;
  apiBaseUrl?: string;
}) {
  return <TOutput = FileContentData>(
    params: Omit<
      GetFileContentParams,
      "organizationId" | "conversationId" | "apiToken" | "apiBaseUrl"
    > & {
      organizationId?: string;
      conversationId?: string;
    }
  ): Promise<GetFileContentResponse<TOutput>> => {
    const { organizationId, conversationId, ...restParams } = params;

    return getFileContent<TOutput>({
      ...restParams,
      organizationId: organizationId ?? contextAuth?.organizationId,
      conversationId: conversationId ?? contextAuth?.conversationId,
      apiToken: contextAuth?.apiToken,
      apiBaseUrl: contextAuth?.apiBaseUrl,
    });
  };
}
