# @brixel_ai/artifact-sdk

SDK for building Brixel Artifacts - interactive React components that integrate with Brixel workflows.

## Installation

```bash
npm install @brixel_ai/artifact-sdk
# or
yarn add @brixel_ai/artifact-sdk
# or
pnpm add @brixel_ai/artifact-sdk
```

## Quick Start

```tsx
import { useBrixelArtifact } from "@brixel_ai/artifact-sdk";

// Define your input/output types
interface Inputs {
  title: string;
  options: string[];
}

interface Output {
  selectedOption: string;
}

function MyUITask() {
  const { inputs, complete, cancel, context, status } = useBrixelArtifact<Inputs, Output>();

  // Loading state while waiting for INIT from host
  if (!inputs) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{inputs.title}</h1>
      {inputs.options.map((option) => (
        <button key={option} onClick={() => complete({ selectedOption: option })}>
          {option}
        </button>
      ))}
      <button onClick={() => cancel("User cancelled")}>Cancel</button>
    </div>
  );
}
```

## API Reference

### `useBrixelArtifact<TInputs, TOutput>(options?)`

Main hook for building UI Tasks.

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `inputs` | `TInputs \| null` | Input data from the host |
| `context` | `BrixelContext \| null` | Execution context (run, theme, locale, etc.) |
| `status` | `TaskStatus` | Current status: `"initializing"`, `"ready"`, `"completed"`, `"cancelled"`, `"error"` |
| `renderMode` | `RenderMode \| null` | `"display"` or `"interaction"` |
| `runId` | `string \| null` | Unique run identifier |
| `complete` | `(output: TOutput) => void` | Complete the task with output |
| `cancel` | `(reason?: string) => void` | Cancel the task |
| `setHeight` | `(height: number \| "auto") => void` | Request iframe resize |
| `log` | `(level, message, data?) => void` | Send log to host |
| `isEmbedded` | `boolean` | Whether running inside Brixel iframe |

#### Options

```ts
interface UseBrixelTaskOptions {
  targetOrigin?: string;      // PostMessage target origin (default: "*")
  onInputsUpdate?: (inputs) => void;  // Callback when inputs change
  onDestroy?: () => void;     // Callback before cleanup
  debug?: boolean;            // Enable debug logging
  autoResize?: boolean;       // Auto-send BRIXEL_RESIZE based on content height (default: false)
}
```

### Full Parent Space vs `setHeight`

If your SDK components must always fill the space allocated by the parent, keep `autoResize` disabled (default) and use CSS layout like `height: 100%` in your component root.

Use `setHeight` (or `autoResize: true`) only when the iframe height must be content-driven.

## Development Mode

Test your UI Task locally without Brixel:

```tsx
import { simulateBrixelInit } from "@brixel_ai/artifact-sdk";

// In your main.tsx or App.tsx
if (import.meta.env.DEV) {
  simulateBrixelInit({
    title: "Test Survey",
    options: ["Option A", "Option B", "Option C"],
  });
}
```

## Render Modes

### Display Mode

For UI Tasks that only show information without requiring user interaction:

```tsx
function DisplayTask() {
  const { inputs, context } = useBrixelArtifact<{ message: string }, void>();

  if (!inputs) return null;

  return <div className="notification">{inputs.message}</div>;
}
```

### Interaction Mode

For UI Tasks that require user input and block the workflow:

```tsx
function InteractionTask() {
  const { inputs, complete, cancel } = useBrixelArtifact<FormInputs, FormOutput>();

  const handleSubmit = (data: FormOutput) => {
    complete(data); // This unblocks the workflow
  };

  // ...
}
```

## Context Object

The `context` object provides information about the execution environment:

```ts
interface BrixelContext {
  runId: string;
  stepId?: string;
  userId?: string;
  organizationId?: string;
  theme: "light" | "dark" | "system";
  locale: string;
  conversationId?: string;
  apiToken?: string;
  apiBaseUrl?: string;
}
```

## Executing Other UI Tasks

The SDK allows UI Tasks to execute other UI Tasks programmatically using the `executeTask` function.

### Basic Usage

```tsx
import { useBrixelArtifact } from "@brixel_ai/artifact-sdk";

function MyUITask() {
  const { executeTask } = useBrixelArtifact();

  const handleExecuteTask = async () => {
    const result = await executeTask({
      taskId: "78c2482f-b47d-461c-9fd0-509476687be9",
      inputs: { name: "value" },
    });

    if (result.success) {
      console.debug("Task executed:", result.data);
    } else {
      console.error("Error:", result.error);
    }
  };

  return <button onClick={handleExecuteTask}>Execute Task</button>;
}
```

### Authentication

The SDK uses Bearer token authentication. The parent interface should pass `apiToken` via the INIT message context.

#### Passing Token from Parent

```typescript
// In parent application (console.brixel.ai)
const authToken = getCookieValue('token');

iframe.contentWindow.postMessage({
  type: 'BRIXEL_INIT',
  payload: {
    runId: 'run-123',
    inputs: { /* ... */ },
    context: {
      organizationId: 'org-123',
      apiToken: authToken,
      // ... other context fields
    }
  }
});
```

The UI Task automatically receives this token and uses it for `executeTask` calls:

```tsx
const { executeTask, context } = useBrixelArtifact();

// Token from context is automatically used
await executeTask({
  taskId: "task-uuid",
  inputs: {}
});

```

### API URL Auto-Detection

The SDK automatically detects your environment and uses the appropriate API:

- **Development** (localhost): `http://localhost:8000`
- **Production**: `https://platform.brixel.ai`

When running on localhost, you'll see:
```
[Brixel SDK] Using API URL: http://localhost:8000
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for details on local development setup.

## Uploading Files

The SDK provides an `uploadFile` function to upload files to Brixel using:

- Endpoint: `POST /v1/files/`
- Form fields:
  - `file`
  - `visibility` (always forced to `"user"` by the SDK)
- Header (optional): `X-Organization-Id`

```tsx
import { useBrixelArtifact } from "@brixel_ai/artifact-sdk";

function MyUITask() {
  const { uploadFile } = useBrixelArtifact();

  const handleUpload = async (file: File) => {
    const result = await uploadFile({
      file,
    });

    if (!result.success) {
      console.error("Upload error:", result.error);
      return;
    }

    console.debug("Uploaded file:", result.data);
  };

  return <input type="file" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />;
}
```

## Getting File Content

The SDK provides `getFileContent` to retrieve inline file content:

- Endpoint: `GET /v1/files/{brixel_file_id}/content`
- Headers (optional):
  - `X-Organization-Id`
  - `X-Conversation-Id`
  - `If-None-Match`
  - `If-Modified-Since`

```tsx
import { useBrixelArtifact } from "@brixel_ai/artifact-sdk";

function MyUITask() {
  const { getFileContent } = useBrixelArtifact();

  const handlePreview = async (brixelFileId: string) => {
    const result = await getFileContent({
      brixelFileId,
    });

    if (!result.success) {
      console.error("Get content error:", result.error);
      return;
    }

    if (result.notModified) {
      console.debug("File not modified");
      return;
    }

    if (!result.data) return;
    const url = URL.createObjectURL(result.data.blob);
    console.debug("Preview URL:", url, "content-type:", result.data.contentType);
  };

  return <button onClick={() => handlePreview("your-brixel-file-id")}>Preview</button>;
}
```

## PostMessage Protocol

The SDK handles the following message types automatically:

### Host → Iframe

- `BRIXEL_INIT`: Initialize with inputs and context
- `BRIXEL_UPDATE_INPUTS`: Update inputs during execution
- `BRIXEL_UPDATE_THEME`: Update theme (`"light" | "dark" | "system"`)
- `BRIXEL_UPDATE_LOCALE`: Update locale (e.g. `"fr-FR"`)
- `BRIXEL_DESTROY`: Cleanup signal

### Iframe → Host

- `BRIXEL_READY`: Iframe is ready to receive INIT
- `BRIXEL_COMPLETE`: Task completed with output
- `BRIXEL_CANCEL`: Task cancelled
- `BRIXEL_RESIZE`: Request height change
- `BRIXEL_ERROR`: Error occurred
- `BRIXEL_LOG`: Debug log message

## Building for Production

```bash
npm run build
```

This produces:
- `dist/index.js` - CommonJS build
- `dist/index.mjs` - ES Module build
- `dist/index.d.ts` - TypeScript declarations

### Packaging locally without `npm link`

To avoid duplicating React in consuming apps, test the SDK as an npm tarball (same shape as a publish):

```bash
# in the SDK repo
npm run pack:local

# in a consumer app (adjust version if needed)
npm install ../brixel-artifact-sdk/dist-tarballs/brixel-artifact-sdk-1.0.0.tgz
```

This keeps `node_modules` out of the package and prevents hook errors caused by multiple React copies. Prefer this over `npm link`.

## License

MIT
