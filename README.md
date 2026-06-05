# react-tree-inspector

A production-ready Higher-Order Component (HOC) and standalone React component that injects a **floating, interactive development overlay** powered by the React Fiber internals. Open the overlay to see a real-time, collapsible tree of your entire component architecture — with props, context subscriptions, and hook counts displayed per selected node.

> **Development-only** — This package accesses React Fiber internals (`__reactFiber$` / `__reactInternalInstance$`). It is intended exclusively for development and debugging environments.

---

## Features

| Feature                              | Detail                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fiber-powered tree crawl**         | Accesses the live Fiber tree — captures functional components, class components, context wrappers, HOC wrappers, and `React.memo` nodes that `React.Children` misses entirely |
| **Component kind classification**    | `HostComponent`, `FunctionComponent`, `ClassComponent`, `ContextProvider/Consumer`, `ForwardRef`, `Memo`, `HOC`, `Suspense` — each colour-coded in the tree                   |
| **HOC detection**                    | Detects higher-order wrappers via `displayName` patterns: `with*`, `Connect(…)`, `inject(…)`, `observer(…)`, `_class*`                                                        |
| **Per-component dependency profile** | Props (key/value), context subscriptions (via `dependencies.firstContext`), and active hook count (via `memoizedState` linked-list)                                           |
| **Portal-based overlay**             | Rendered via `createPortal` directly on `document.body`, bypassing any parent `overflow: hidden` clipping                                                                     |
| **Keyboard navigation**              | Arrow keys to expand/collapse, Enter/Space to select, Escape to close                                                                                                         |
| **Zero runtime deps**                | Only `react` and `react-dom` as peer dependencies                                                                                                                             |
| **Dual ESM + CJS output**            | Ships `dist/index.esm.js`, `dist/index.cjs.js`, and `dist/index.d.ts`                                                                                                         |
| **React 17 / 18 / 19**               | Handles both legacy `ReactDOM.render` roots and `createRoot` concurrent roots                                                                                                 |

---

## Installation

```bash
npm install react-tree-inspector
# peer deps (if not already installed)
npm install react react-dom
```

---

## Usage

### Option A — Higher-Order Component (recommended for app-level inspection)

Wrap your root component once. The HOC adds a floating `⬡` button and crawls the tree starting from its own mount point.

```tsx
// src/App.tsx or src/main.tsx
import { withTreeInspector } from "react-tree-inspector";

function App() {
  return <YourApplication />;
}

export default withTreeInspector(App, {
  buttonPosition: "bottom-right", // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  maxDepth: 40, // cap Fiber recursion depth
  defaultOpen: false, // auto-open on mount
  exclude: /^Suspense|^Router/, // filter out noisy wrappers
});
```

Gate it with an env check so it never ships in production:

```tsx
const ExportedApp =
  process.env.NODE_ENV === "development"
    ? withTreeInspector(App, { buttonPosition: "bottom-right" })
    : App;

export default ExportedApp;
```

---

### Option B — Standalone `<TreeInspector>` component

Drop it once, anywhere in the tree. By default it crawls from `#root` / `#app` for a full-app view.

```tsx
import { TreeInspector } from "react-tree-inspector";

function App() {
  return (
    <>
      <YourApplication />
      {process.env.NODE_ENV === "development" && (
        <TreeInspector buttonPosition="bottom-right" maxDepth={30} />
      )}
    </>
  );
}
```

Scope it to a specific subtree via `targetRef`:

```tsx
import { useRef } from "react";
import { TreeInspector } from "react-tree-inspector";

function Dashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={dashboardRef}>
      <ComplexDashboard />
      <TreeInspector targetRef={dashboardRef} buttonPosition="bottom-left" />
    </div>
  );
}
```

---

### Option C — Headless Fiber crawl

Use the raw crawler for custom integrations (e.g. automated structural tests, snapshot diffing).

```ts
import { crawlFiberTree } from "react-tree-inspector";
import type { InspectorNode } from "react-tree-inspector";

const container = document.getElementById("root")!;
const { tree, error } = crawlFiberTree(container, { maxDepth: 20 });

if (error) {
  console.error("Crawl failed:", error);
} else if (tree) {
  console.log(JSON.stringify(tree, null, 2));
}
```

---

## API Reference

### `withTreeInspector(WrappedComponent, config?)`

Returns a new component with the inspector overlay injected.

| Config field     | Type                                                           | Default          | Description                            |
| ---------------- | -------------------------------------------------------------- | ---------------- | -------------------------------------- |
| `maxDepth`       | `number`                                                       | `50`             | Maximum Fiber recursion depth          |
| `exclude`        | `RegExp`                                                       | `undefined`      | Skip nodes whose resolved name matches |
| `buttonPosition` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Corner for the floating button         |
| `defaultOpen`    | `boolean`                                                      | `false`          | Auto-open the panel on mount           |

---

### `<TreeInspector {...config} targetRef? />`

Accepts all `TreeInspectorConfig` fields plus:

| Prop        | Type                               | Default     | Description                                                                      |
| ----------- | ---------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `targetRef` | `React.RefObject<Element \| null>` | `undefined` | Specific element to crawl from. Falls back to `#root` → `#app` → `document.body` |

---

### `crawlFiberTree(element, options?)`

```ts
function crawlFiberTree(
  rootElement: Element,
  options?: { maxDepth?: number; exclude?: RegExp },
): CrawlResult;

interface CrawlResult {
  tree: InspectorNode | null;
  error: string | null;
}
```

---

### `InspectorNode`

```ts
interface InspectorNode {
  id: string; // Stable path-based ID ("root-0-1-2")
  name: string; // Component name or HTML tag
  kind: ComponentKind; // Classification (see below)
  depth: number; // Nesting depth from root
  children: InspectorNode[]; // Ordered child nodes
  dependencyProfile: DependencyProfile;
}

interface DependencyProfile {
  props: PropEntry[]; // { key, value } pairs (children omitted)
  contextDependencies: ContextDependency[]; // Active context subscriptions
  hookCount: number; // Count of hooks in memoizedState chain
  displayName: string; // Resolved display name
}

type ComponentKind =
  | "HostComponent" // DOM element
  | "FunctionComponent" // FC
  | "ClassComponent" // CC
  | "ContextProvider" // Context.Provider
  | "ContextConsumer" // Context.Consumer
  | "ForwardRef" // React.forwardRef
  | "Memo" // React.memo
  | "HOC" // Higher-Order Component (inferred by name)
  | "Fragment" // React.Fragment
  | "Suspense" // React.Suspense
  | "Unknown";
```

---

## Building Locally

```bash
cd react-tree-inspector
npm install
npm run build       # Compile to dist/
npm run dev         # Watch mode
npm run typecheck   # Validate TypeScript without emitting
```

### Link to a consumer project

```bash
# Inside react-tree-inspector/
npm link

# Inside your consumer app/
npm link react-tree-inspector
```

When linked, import normally:

```ts
import { withTreeInspector } from "react-tree-inspector";
```

---

## How it works

```
DOM element
    │  Object.keys() scan for __reactFiber$<key>
    │                        or __reactContainer$<key>
    ▼
FiberNode (HostRoot)
    │  Skip HostRoot, walk .child / .sibling chain
    ▼
Component FiberNodes
    │  Per node:
    │    tag  → ComponentKind
    │    type → display name
    │    memoizedProps  → PropEntry[]
    │    dependencies.firstContext → ContextDependency[]
    │    memoizedState (linked list) → hookCount
    ▼
InspectorNode tree  →  TreeViewer + InspectorPanel rendered via createPortal
```

### Fiber property keys

| React version | Internal element key             | Root container key                          |
| ------------- | -------------------------------- | ------------------------------------------- |
| React 16/17   | `__reactInternalInstance$<rand>` | `_reactRootContainer._internalRoot.current` |
| React 18/19   | `__reactFiber$<rand>`            | `__reactContainer$<rand>`                   |

The crawler scans `Object.keys()` for all of these, making it resilient to the random suffix.

---

## Caveats

- **React internals are not a public API.** The `__reactFiber$` property and Fiber node shape may change in future React versions. All reads are guarded with `try/catch` and optional chaining — if React changes something, the affected field returns a safe empty value rather than crashing your app.
- **Production builds strip Fiber references.** React's production bundle removes the `__reactFiber$` attachment. Always gate this package behind `process.env.NODE_ENV === 'development'`.
- **Concurrent mode:** Context and hook metadata is read from the _committed_ Fiber state (`memoizedState` / `dependencies`), which reflects the last rendered output.

---

## License

MIT
