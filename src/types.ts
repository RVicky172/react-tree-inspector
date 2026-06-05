/**
 * @file types.ts
 * All core TypeScript interfaces and constants for react-tree-inspector.
 * These are the types exported as the public API surface.
 */

// ---------------------------------------------------------------------------
// Component Kind Classification
// ---------------------------------------------------------------------------

/**
 * The classified kind of a React Fiber node.
 * Drives colour-coding and labelling in the tree UI.
 */
export type ComponentKind =
  | "HostComponent" // Native DOM element: div, span, button, etc.
  | "FunctionComponent" // Standard functional React component
  | "ClassComponent" // Class-based React component (legacy or current)
  | "ContextProvider" // React.createContext().Provider
  | "ContextConsumer" // React.createContext().Consumer
  | "ForwardRef" // React.forwardRef() wrapper
  | "Memo" // React.memo() wrapper
  | "HOC" // Inferred Higher-Order Component via displayName pattern
  | "Fragment" // React.Fragment
  | "Suspense" // React.Suspense
  | "Unknown"; // Unrecognised or internal Fiber tag

// ---------------------------------------------------------------------------
// Dependency Profile
// ---------------------------------------------------------------------------

/** A single serialised prop entry for display in the inspector. */
export interface PropEntry {
  /** The prop key name */
  key: string;
  /** The raw prop value — may not be JSON-serialisable (functions, symbols, etc.) */
  value: unknown;
}

/** A single React Context that a component is currently subscribed to. */
export interface ContextDependency {
  /**
   * Best-effort human-readable name.
   * Resolved from `context.displayName` → `context._currentRenderer` → `'Context'`.
   */
  displayName: string;
  /** The raw Context object reference (useful for identity checks). */
  context: unknown;
}

/** Full runtime dependency profile for a single Fiber node. */
export interface DependencyProfile {
  /** Serialised incoming props (the `children` key is omitted to reduce noise). */
  props: PropEntry[];
  /** React Contexts this component is currently subscribed to. */
  contextDependencies: ContextDependency[];
  /**
   * Count of active hooks in the memoizedState linked-list.
   * Only meaningful for FunctionComponent fibers.
   */
  hookCount: number;
  /** The resolved display name used when building this profile. */
  displayName: string;
}

// ---------------------------------------------------------------------------
// Inspector Tree Node
// ---------------------------------------------------------------------------

/** A single node in the extracted Fiber Inspector tree. */
export interface InspectorNode {
  /** Stable path-based ID (e.g. "root-0-1-2"). Guaranteed unique within a crawl. */
  id: string;
  /** Human-readable display label (component name or HTML tag). */
  name: string;
  /** Classified component kind — drives colour-coding in the tree UI. */
  kind: ComponentKind;
  /** Nesting depth from the crawl root (0-indexed). */
  depth: number;
  /** Ordered child nodes in document order. */
  children: InspectorNode[];
  /** Runtime dependency metadata populated for every node during the crawl. */
  dependencyProfile: DependencyProfile;
}

// ---------------------------------------------------------------------------
// Consumer-facing Configuration
// ---------------------------------------------------------------------------

/** Configuration object accepted by `withTreeInspector` and `<TreeInspector>`. */
export interface TreeInspectorConfig {
  /**
   * Maximum Fiber nesting depth to crawl.
   * Increasing this may surface deeper HOC chains at the cost of crawl time.
   * @default 50
   */
  maxDepth?: number;

  /**
   * Exclude components whose resolved name matches this regex.
   * Useful for filtering out noisy infrastructure wrappers.
   * @example /^Suspense|^Router|^Provider/
   */
  exclude?: RegExp;

  /**
   * Corner anchor for the floating trigger button.
   * @default 'bottom-right'
   */
  buttonPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";

  /**
   * Automatically open the inspector panel on mount.
   * @default false
   */
  defaultOpen?: boolean;
}

// ---------------------------------------------------------------------------
// Internal Fiber Tag Constants
// Mirrors React's WorkTag enum in:
//   react/packages/react-reconciler/src/ReactWorkTags.js
//
// These numeric values have been stable across React 17, 18, and 19 for the
// subset we consume. They are intentionally NOT exported as part of the
// public API — they are an implementation detail.
// ---------------------------------------------------------------------------

/** @internal */
export const FIBER_TAG = {
  FunctionComponent: 0,
  ClassComponent: 1,
  HostRoot: 3,
  HostPortal: 4,
  HostComponent: 5,
  HostText: 6,
  Fragment: 7,
  Mode: 8, // StrictMode, ConcurrentMode
  ContextConsumer: 9,
  ContextProvider: 10,
  ForwardRef: 11,
  Profiler: 12,
  SuspenseComponent: 13,
  MemoComponent: 14,
  SimpleMemoComponent: 15,
  LazyComponent: 16,
} as const;
