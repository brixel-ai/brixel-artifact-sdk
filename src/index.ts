/**
 * @brixel/artifact-sdk
 *
 * SDK for building Brixel Artifacts - interactive React components
 * that integrate seamlessly with Brixel workflows.
 *
 * @example
 * ```tsx
 * import { useBrixelArtifact } from "@brixel/artifact-sdk";
 *
 * function MyUITask() {
 *   const { inputs, complete, context } = useBrixelArtifact<MyInputs, MyOutput>();
 *
 *   if (!inputs) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h1>{inputs.title}</h1>
 *       <button onClick={() => complete({ result: "done" })}>
 *         Submit
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

// Main hook
export { useBrixelArtifact } from "./useBrixelArtifact";

// Execute Task API
export { executeTask, createExecuteTask } from "./executeTask";

// Types
export type {
  // Core types
  RenderMode,
  BrixelContext,
  ArtifactManifest,
  TaskStatus,
  // Hook types
  UseBrixelTaskResult,
  UseBrixelTaskOptions,
  // Protocol messages - Host to Iframe
  HostToIframeMessage,
  InitMessage,
  UpdateInputsMessage,
  DestroyMessage,
  UpdateThemeMessage,
  UpdateLocaleMessage,
  // Protocol messages - Iframe to Host
  IframeToHostMessage,
  ReadyMessage,
  ResizeMessage,
  CompleteMessage,
  CancelMessage,
  ErrorMessage,
  LogMessage,
  // Execute Task API types
  ExecuteTaskParams,
  ExecuteTaskResponse,
} from "./types";

// Development tools
export {
  simulateBrixelInit,
  listenToUITaskMessages,
  createMockBrixelHost,
  mockContext,
} from "./devTools";
