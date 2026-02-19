/**
 * Brixel UI Task Protocol Types
 *
 * This file defines the postMessage protocol between the Brixel host (chat)
 * and the UI Task iframe.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Render mode determines if the UI Task requires user interaction
 * - "display": Just shows content, no output expected
 * - "interaction": Requires user action, workflow waits for completion
 */
export type RenderMode = "display" | "interaction";

/**
 * Context provided by Brixel host to the UI Task
 */
export interface BrixelContext {
  /** Unique run identifier for this execution */
  runId: string;
  /** Step ID within the workflow (if part of a workflow) */
  stepId?: string;
  /** User identifier */
  userId?: string;
  /** Organization identifier */
  organizationId?: string;
  /** UI preferences */
  theme: "light" | "dark" | "system";
  locale: string;
  /** Conversation ID for API calls (optional) */
  conversationId?: string;
  /** API token passed by parent for authenticated requests (recommended over cookies) */
  apiToken?: string;
  /** Optional custom API base URL (for development/testing) */
  apiBaseUrl?: string;
}

/**
 * Artifact manifest schema
 */
export interface ArtifactManifest {
  id: string;
  version: string;
  type: "ui_component";
  name: string;
  description?: string;
  renderMode: RenderMode;
  entry: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  ui?: {
    height?: "auto" | number;
    minHeight?: number;
    maxHeight?: number;
    preferredWidth?: "message" | "full" | number;
  };
  permissions?: {
    network?: string[];
    files?: boolean;
    clipboard?: boolean;
  };
}

// ============================================================================
// PostMessage Protocol - Host to Iframe
// ============================================================================

/**
 * INIT: Sent by host when iframe is ready to receive data
 */
export interface InitMessage<TInputs = unknown> {
  type: "BRIXEL_INIT";
  payload: {
    runId: string;
    inputs: TInputs;
    context: BrixelContext;
    renderMode: RenderMode;
  };
}

/**
 * UPDATE_INPUTS: Sent when inputs change during execution
 */
export interface UpdateInputsMessage<TInputs = unknown> {
  type: "BRIXEL_UPDATE_INPUTS";
  payload: {
    runId: string;
    inputs: Partial<TInputs>;
  };
}

/**
 * DESTROY: Sent when the UI Task should clean up
 */
export interface DestroyMessage {
  type: "BRIXEL_DESTROY";
  payload: {
    runId: string;
  };
}

/**
 * UPDATE_THEME: Sent when the host theme changes
 */
export interface UpdateThemeMessage {
  type: "BRIXEL_UPDATE_THEME";
  payload: {
    runId: string;
    theme: BrixelContext["theme"];
  };
}

/**
 * UPDATE_LOCALE: Sent when the host locale changes
 */
export interface UpdateLocaleMessage {
  type: "BRIXEL_UPDATE_LOCALE";
  payload: {
    runId: string;
    locale: string;
  };
}

export type HostToIframeMessage<TInputs = unknown> =
  | InitMessage<TInputs>
  | UpdateInputsMessage<TInputs>
  | DestroyMessage
  | UpdateThemeMessage
  | UpdateLocaleMessage;

// ============================================================================
// PostMessage Protocol - Iframe to Host
// ============================================================================

/**
 * READY: Iframe signals it's ready to receive INIT
 */
export interface ReadyMessage {
  type: "BRIXEL_READY";
  payload: {
    version: string;
  };
}

/**
 * RESIZE: Request height change
 */
export interface ResizeMessage {
  type: "BRIXEL_RESIZE";
  payload: {
    runId: string;
    height: number | "auto";
  };
}

/**
 * COMPLETE: Task finished with output (for interaction mode)
 */
export interface CompleteMessage<TOutput = unknown> {
  type: "BRIXEL_COMPLETE";
  payload: {
    runId: string;
    output: TOutput;
  };
}

/**
 * CANCEL: User cancelled the task
 */
export interface CancelMessage {
  type: "BRIXEL_CANCEL";
  payload: {
    runId: string;
    reason?: string;
  };
}

/**
 * ERROR: An error occurred in the UI Task
 */
export interface ErrorMessage {
  type: "BRIXEL_ERROR";
  payload: {
    runId: string;
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
}

/**
 * LOG: Debug log from iframe (captured by host in dev mode)
 */
export interface LogMessage {
  type: "BRIXEL_LOG";
  payload: {
    runId: string;
    level: "debug" | "info" | "warn" | "error";
    message: string;
    data?: unknown;
  };
}

export type IframeToHostMessage<TOutput = unknown> =
  | ReadyMessage
  | ResizeMessage
  | CompleteMessage<TOutput>
  | CancelMessage
  | ErrorMessage
  | LogMessage;

// ============================================================================
// Hook Types
// ============================================================================

export type TaskStatus = "initializing" | "ready" | "completed" | "cancelled" | "error";

export interface UseBrixelTaskResult<TInputs, TOutput> {
  /** Current inputs from the host */
  inputs: TInputs | null;
  /** Brixel context (user, theme, locale, etc.) */
  context: BrixelContext | null;
  /** Current task status */
  status: TaskStatus;
  /** Render mode of this task */
  renderMode: RenderMode | null;
  /** Run ID for this execution */
  runId: string | null;
  /** Complete the task with output (required for interaction mode) */
  complete: (output: TOutput) => void;
  /** Cancel the task */
  cancel: (reason?: string) => void;
  /** Request height resize */
  setHeight: (height: number | "auto") => void;
  /** Send a log message to the host */
  log: (level: "debug" | "info" | "warn" | "error", message: string, data?: unknown) => void;
  /** Whether running inside Brixel iframe */
  isEmbedded: boolean;
  /** Execute another UI Task (bound to current context) */
  executeTask: <TTaskOutput = unknown>(
    params: Omit<ExecuteTaskParams, "conversationId" | "apiToken" | "apiBaseUrl"> & {
      organizationId?: string;
    }
  ) => Promise<ExecuteTaskResponse<TTaskOutput>>;
  /** Upload a file to Brixel (visibility is always forced to "user") */
  uploadFile: <TFileOutput = InternalFilePublicOut>(
    params: Omit<UploadFileParams, "organizationId" | "apiToken" | "apiBaseUrl"> & {
      organizationId?: string;
    }
  ) => Promise<UploadFileResponse<TFileOutput>>;
  /** Get inline content of a Brixel file by id */
  getFileContent: <TContentOutput = FileContentData>(
    params: Omit<
      GetFileContentParams,
      "organizationId" | "conversationId" | "apiToken" | "apiBaseUrl"
    > & {
      organizationId?: string;
      conversationId?: string;
    }
  ) => Promise<GetFileContentResponse<TContentOutput>>;
}

export interface UseBrixelTaskOptions {
  /** Target origin for postMessage (default: "*", should be restricted in production) */
  targetOrigin?: string;
  /** Callback when inputs are updated */
  onInputsUpdate?: (inputs: unknown) => void;
  /** Callback before destroy */
  onDestroy?: () => void;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-send BRIXEL_RESIZE based on document.body size changes */
  autoResize?: boolean;
}

// ============================================================================
// Execute Task API Types
// ============================================================================

/**
 * Parameters for executing a UI Task via the API
 */
export interface ExecuteTaskParams {
  /** ID of the organization owning the task */
  organizationId: string;
  /** ID of the task to execute */
  taskId: string;
  /** Input values for the task */
  inputs: Record<string, unknown>;
  /** Optional conversation ID for x-conversation-id header */
  conversationId?: string;
  /** API token used as Bearer token for API requests */
  apiToken?: string;
  /** Optional custom API base URL (auto-detects dev/prod if not provided) */
  apiBaseUrl?: string;
}

/**
 * Error returned by executeTask when execution fails.
 */
export interface ExecuteTaskError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Successful executeTask response.
 */
export interface ExecuteTaskSuccessResponse<TOutput = unknown> {
  success: true;
  data: TOutput;
}

/**
 * Failed executeTask response.
 */
export interface ExecuteTaskFailureResponse {
  success: false;
  data: ExecuteTaskError;
}

/**
 * Return value from executeTask.
 */
export type ExecuteTaskResponse<TOutput = unknown> =
  | ExecuteTaskSuccessResponse<TOutput>
  | ExecuteTaskFailureResponse;

/**
 * Parameters for uploading a file to Brixel
 */
export interface UploadFileParams {
  /** File to upload */
  file: File;
  /** Optional organization ID sent as X-Organization-Id header */
  organizationId?: string;
  /** API token used as Bearer token for API requests */
  apiToken?: string;
  /** Optional custom API base URL (auto-detects dev/prod if not provided) */
  apiBaseUrl?: string;
}

/**
 * Mime type returned by Brixel for internal files.
 * Kept as `string` because backend enum values may evolve.
 */
export type InternalFileMimeType = string;

/**
 * Public schema for internal file output.
 * Mirrors backend `InternalFilePublicOut`.
 */
export interface InternalFilePublicOut {
  brixel_file_id: string;
  name: string;
  mime_type: InternalFileMimeType;
  size: number;
  expires_at: string | null;
}

/**
 * Response from the upload file API
 */
export interface UploadFileResponse<TOutput = InternalFilePublicOut> {
  success: boolean;
  data?: TOutput;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Returned file content payload
 */
export interface FileContentData {
  blob: Blob;
  contentType: string | null;
  contentLength?: number;
  etag?: string | null;
  lastModified?: string | null;
}

/**
 * Parameters for getting file content from Brixel
 */
export interface GetFileContentParams {
  /** Brixel file id */
  brixelFileId: string;
  /** Optional organization ID sent as X-Organization-Id header */
  organizationId?: string;
  /** Optional conversation ID sent as X-Conversation-Id header */
  conversationId?: string;
  /** API token used as Bearer token for API requests */
  apiToken?: string;
  /** Optional custom API base URL (auto-detects dev/prod if not provided) */
  apiBaseUrl?: string;
  /** Optional conditional request header */
  ifNoneMatch?: string;
  /** Optional conditional request header */
  ifModifiedSince?: string;
}

/**
 * Response from the get file content API
 */
export interface GetFileContentResponse<TOutput = FileContentData> {
  success: boolean;
  notModified?: boolean;
  data?: TOutput;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
