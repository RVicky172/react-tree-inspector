/**
 * @file fiberCrawler.ts
 * Runtime React Fiber tree crawler with fully defensive access patterns.
 *
 * All internal React Fiber property reads are wrapped in try/catch blocks
 * or use optional chaining, ensuring that any breaking change in React's
 * internals degrades gracefully — it will never crash the host application.
 *
 * Supported React versions: 17, 18, 19 (concurrent and legacy roots).
 */

import type {
  ComponentKind,
  ContextDependency,
  DependencyProfile,
  InspectorNode,
  PropEntry,
} from "./types";
import { FIBER_TAG } from "./types";

// ---------------------------------------------------------------------------
// Internal Fiber shape (partial — only properties we deliberately access)
// These are NOT exported; they are an implementation detail of the crawler.
// ---------------------------------------------------------------------------

/** A node in the context dependency linked list on a Fiber. */
interface FiberContextDepNode {
  context?: unknown;
  next?: FiberContextDepNode | null;
}

/** The dependencies object on a Fiber node. */
interface FiberDependencies {
  firstContext?: FiberContextDepNode | null;
}

/**
 * A node in the memoizedState hook linked list.
 * For functional components, each hook appends one node.
 */
interface FiberHookNode {
  memoizedState?: unknown;
  queue?: unknown; // Present on useState / useReducer nodes
  next?: FiberHookNode | null;
}

/**
 * Partial shape of an internal React Fiber node.
 * Only properties we intentionally read are listed here.
 */
interface FiberNode {
  tag: number;
  type: unknown;
  key: string | null;
  memoizedProps: Record<string, unknown> | null;
  memoizedState: FiberHookNode | null;
  child: FiberNode | null;
  sibling: FiberNode | null;
  return: FiberNode | null;
  stateNode: unknown;
  dependencies: FiberDependencies | null;
}

// ---------------------------------------------------------------------------
// Crawl options (internal)
// ---------------------------------------------------------------------------

interface CrawlOptions {
  maxDepth: number;
  exclude?: RegExp;
}

// ---------------------------------------------------------------------------
// DOM → Fiber bridge
// ---------------------------------------------------------------------------

/**
 * Extracts the internal React Fiber node attached to a given DOM element.
 *
 * React stores Fiber references on DOM elements using randomly-suffixed keys:
 *
 *   React 16 / 17:  `__reactInternalInstance$<randomKey>`   → Fiber node
 *   React 18 / 19:  `__reactFiber$<randomKey>`              → Fiber node
 *
 * For the root container element specifically (the element passed to
 * `createRoot()` or `ReactDOM.render()`), React 18+ uses a different key:
 *
 *   `__reactContainer$<randomKey>` → HostRoot Fiber node directly
 *
 * We scan all keys with Object.keys() to handle the random suffix.
 */
function getFiberFromElement(element: Element): FiberNode | null {
  try {
    const node = element as unknown as Record<string, unknown>;
    const keys = Object.keys(node);

    // Primary path: any element inside the React tree
    for (const key of keys) {
      if (
        key.startsWith("__reactFiber$") ||
        key.startsWith("__reactInternalInstance$")
      ) {
        return node[key] as FiberNode;
      }
    }

    // Fallback: the root container element (React 18 createRoot)
    // `__reactContainer$<key>` stores the HostRoot Fiber directly.
    for (const key of keys) {
      if (key.startsWith("__reactContainer$")) {
        return node[key] as FiberNode;
      }
    }

    // Fallback: React 17 legacy root container
    // `_reactRootContainer._internalRoot.current` = HostRoot Fiber
    if ("_reactRootContainer" in node) {
      const legacyRoot = node["_reactRootContainer"] as {
        _internalRoot?: { current?: FiberNode };
      } | null;
      return legacyRoot?._internalRoot?.current ?? null;
    }
  } catch {
    // Silently fail — restricted environments (e.g. cross-origin iframes)
  }
  return null;
}

// ---------------------------------------------------------------------------
// Name resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the most human-readable name from a Fiber's `type` field.
 * `type` can be: a string (HostComponent), a function (FC/CC), or an
 * object (ForwardRef, Memo, lazy, etc.).
 */
function resolveTypeName(type: unknown): string | null {
  if (type === null || type === undefined) return null;

  if (typeof type === "string") return type; // <div>, <span>, etc.

  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || null;
  }

  if (typeof type === "object") {
    const obj = type as Record<string, unknown>;

    if (typeof obj.displayName === "string" && obj.displayName) {
      return obj.displayName;
    }
    // ForwardRef / Memo wrap the real component in `render` or `type`
    if (typeof obj.render === "function") {
      const render = obj.render as { displayName?: string; name?: string };
      return render.displayName || render.name || null;
    }
    if (typeof obj.type !== "undefined") {
      return resolveTypeName(obj.type);
    }
  }

  return null;
}

/** Maps a raw Fiber `tag` + `type` to a human-readable display label. */
function getNodeLabel(tag: number, type: unknown): string {
  switch (tag) {
    case FIBER_TAG.HostRoot:
      return "#root";
    case FIBER_TAG.HostText:
      return "#text";
    case FIBER_TAG.Fragment:
      return "Fragment";
    case FIBER_TAG.SuspenseComponent:
      return "Suspense";
    case FIBER_TAG.Mode:
      return "StrictMode";
    case FIBER_TAG.Profiler:
      return "Profiler";
    case FIBER_TAG.HostPortal:
      return "Portal";
    default:
      return resolveTypeName(type) ?? "Anonymous";
  }
}

// ---------------------------------------------------------------------------
// Component kind classification
// ---------------------------------------------------------------------------

/**
 * HOC detection patterns applied to a component's resolved name.
 * Matches common conventions:
 *   - withRouter, withTheme, withStore, etc.   (React HOC convention)
 *   - Connect(MyComp), inject(MyComp)          (Redux Connect, MobX inject)
 *   - _class2, _class3                         (Babel-compiled class HOCs)
 *   - observer(MyComp)                         (MobX observer)
 */
const HOC_NAME_PATTERN =
  /^(with[A-Z][a-zA-Z]*|Connect\(|inject\(|observer\(|_class\d)/;
/** Parenthesis inside the name indicates a wrapping pattern like `Connect(Foo)`. */
const HOC_WRAPPER_PATTERN = /\(.*\)$/;

function classifyFiber(
  tag: number,
  type: unknown,
  name: string,
): ComponentKind {
  switch (tag) {
    case FIBER_TAG.HostComponent:
      return "HostComponent";
    case FIBER_TAG.Fragment:
      return "Fragment";
    case FIBER_TAG.SuspenseComponent:
      return "Suspense";
    case FIBER_TAG.ContextProvider:
      return "ContextProvider";
    case FIBER_TAG.ContextConsumer:
      return "ContextConsumer";
    case FIBER_TAG.ForwardRef:
      return "ForwardRef";
    case FIBER_TAG.MemoComponent:
    case FIBER_TAG.SimpleMemoComponent:
      return "Memo";
    case FIBER_TAG.ClassComponent:
      return "ClassComponent";
    case FIBER_TAG.FunctionComponent: {
      if (HOC_NAME_PATTERN.test(name)) return "HOC";
      // Also inspect the inner type for wrapping like "Connect(MyComponent)"
      const innerName = resolveTypeName(type) ?? "";
      if (HOC_WRAPPER_PATTERN.test(innerName)) return "HOC";
      return "FunctionComponent";
    }
    default:
      return "Unknown";
  }
}

// ---------------------------------------------------------------------------
// Dependency profile extraction
// ---------------------------------------------------------------------------

function extractProps(
  memoizedProps: Record<string, unknown> | null,
): PropEntry[] {
  if (!memoizedProps) return [];
  try {
    return Object.keys(memoizedProps)
      .filter((k) => k !== "children") // Omit children to avoid visual noise
      .map((key) => ({ key, value: memoizedProps[key] }));
  } catch {
    return [];
  }
}

function extractContextDeps(
  deps: FiberNode["dependencies"],
): ContextDependency[] {
  const result: ContextDependency[] = [];
  if (!deps) return result;

  try {
    let dep = deps.firstContext;
    while (dep != null) {
      const ctx = dep.context;
      let displayName = "Context";

      if (ctx != null && typeof ctx === "object") {
        const ctxObj = ctx as Record<string, unknown>;
        if (typeof ctxObj.displayName === "string" && ctxObj.displayName) {
          displayName = ctxObj.displayName;
        } else if (typeof ctxObj._currentRenderer === "string") {
          displayName = ctxObj._currentRenderer;
        }
      }

      result.push({ displayName, context: ctx });
      dep = dep.next ?? null;
    }
  } catch {
    // Silently degrade — context linked-list shape may shift between versions
  }

  return result;
}

/**
 * Counts active hooks by walking the memoizedState linked list.
 *
 * For functional components, each hook (useState, useEffect, useRef, etc.)
 * contributes exactly one node to the memoizedState linked list. A node is
 * identified as a hook by the presence of a `next` property or a `queue`
 * property. Class component state objects do NOT have this shape.
 */
function countHooks(memoizedState: FiberHookNode | null): number {
  let count = 0;
  try {
    let node: FiberHookNode | null | undefined = memoizedState;
    while (node != null) {
      // Hook linked-list nodes always carry `next` (even if null at end)
      // and typically carry `queue`. A plain class state object won't.
      if (!("next" in node) && !("queue" in node)) break;
      count++;
      node = node.next;
    }
  } catch {
    // Silently degrade
  }
  return count;
}

function buildDependencyProfile(
  fiber: FiberNode,
  displayName: string,
): DependencyProfile {
  return {
    displayName,
    props: extractProps(fiber.memoizedProps),
    contextDependencies: extractContextDeps(fiber.dependencies),
    hookCount: countHooks(fiber.memoizedState),
  };
}

// ---------------------------------------------------------------------------
// Recursive Fiber tree crawl
// ---------------------------------------------------------------------------

function crawlFiber(
  fiber: FiberNode,
  depth: number,
  opts: CrawlOptions,
  idPath: string,
): InspectorNode | null {
  if (depth > opts.maxDepth) return null;

  const { tag, type } = fiber;

  // HostRoot is an internal React container — skip it and descend directly
  // into the first real component to avoid a confusing "#root" at the top.
  if (tag === FIBER_TAG.HostRoot) {
    return fiber.child ? crawlFiber(fiber.child, depth, opts, idPath) : null;
  }

  // Raw text nodes carry no useful component metadata; they add visual noise.
  if (tag === FIBER_TAG.HostText) return null;

  const name = getNodeLabel(tag, type);

  // Apply caller-supplied exclusion filter
  if (opts.exclude?.test(name)) return null;

  const kind = classifyFiber(tag, type, name);
  const dependencyProfile = buildDependencyProfile(fiber, name);

  // Collect child nodes by walking the sibling chain
  const children: InspectorNode[] = [];
  let childFiber = fiber.child;
  let childIndex = 0;

  while (childFiber != null) {
    const childId = `${idPath}-${childIndex}`;
    try {
      const childNode = crawlFiber(childFiber, depth + 1, opts, childId);
      if (childNode) children.push(childNode);
    } catch {
      // Isolate failures per branch — one broken subtree must not abort the rest
    }
    childFiber = childFiber.sibling;
    childIndex++;
  }

  return { id: idPath, name, kind, depth, children, dependencyProfile };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Result returned by {@link crawlFiberTree}. */
export interface CrawlResult {
  /** The root of the extracted inspector tree, or null on failure. */
  tree: InspectorNode | null;
  /** Human-readable error message if crawl failed, otherwise null. */
  error: string | null;
}

/**
 * Resolves the React Fiber attached to `rootElement` and recursively builds
 * a complete {@link InspectorNode} tree representing the live component
 * architecture beneath that element.
 *
 * This function never throws — all errors are surfaced via `CrawlResult.error`.
 *
 * @param rootElement - The DOM element to start the crawl from. Can be the
 *   React root container (`document.getElementById('root')`) for a full-app
 *   tree, or any internal element for a partial subtree.
 * @param options     - Optional crawl configuration.
 */
export function crawlFiberTree(
  rootElement: Element,
  options: { maxDepth?: number; exclude?: RegExp } = {},
): CrawlResult {
  const opts: CrawlOptions = {
    maxDepth: options.maxDepth ?? 50,
    exclude: options.exclude,
  };

  const fiber = getFiberFromElement(rootElement);

  if (!fiber) {
    return {
      tree: null,
      error:
        "No React Fiber found on this element. " +
        "Ensure the target element is mounted by React and that you are " +
        "running a development build (production builds strip Fiber references).",
    };
  }

  try {
    const tree = crawlFiber(fiber, 0, opts, "root");
    return { tree, error: null };
  } catch (err) {
    return {
      tree: null,
      error: err instanceof Error ? err.message : "Unknown crawl error",
    };
  }
}
