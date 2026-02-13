const LOCAL_API_BASE_URL = "http://localhost:8000";
const PROD_API_BASE_URL = "https://platform.brixel.ai";

export interface SdkError {
  code: string;
  message: string;
  details?: unknown;
}

function isBrowserLocalhost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolveApiBaseUrl(apiBaseUrl?: string): string {
  if (apiBaseUrl) {
    return apiBaseUrl;
  }
  return isBrowserLocalhost() ? LOCAL_API_BASE_URL : PROD_API_BASE_URL;
}

export function debugApiBaseUrl(baseUrl: string): void {
  if (isBrowserLocalhost()) {
    console.debug("[Brixel SDK] Using API URL:", baseUrl);
  }
}

export async function parseJsonOrText(response: Response): Promise<unknown> {
  const responseText = await response.text();
  if (!responseText) {
    return null;
  }
  try {
    return JSON.parse(responseText);
  } catch {
    return { raw: responseText };
  }
}

export function toHttpError(response: Response, payload: any): SdkError {
  return {
    code: payload?.code || `HTTP_${response.status}`,
    message: payload?.message || `Request failed with status ${response.status}`,
    details: payload?.details || payload,
  };
}

export function toNetworkError(error: unknown): SdkError {
  return {
    code: "NETWORK_ERROR",
    message: error instanceof Error ? error.message : "Unknown error occurred",
    details: error,
  };
}
