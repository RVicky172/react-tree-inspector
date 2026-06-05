/**
 * react-tree-inspector — public API entry point.
 *
 * @packageDocumentation
 */

// HOC and standalone component
export { withTreeInspector, TreeInspector } from "./hoc/withTreeInspector";
export type { TreeInspectorProps } from "./hoc/withTreeInspector";

// Headless fiber crawler (for custom integrations)
export { crawlFiberTree } from "./fiberCrawler";
export type { CrawlResult } from "./fiberCrawler";

// All public TypeScript interfaces
export type {
  ComponentKind,
  PropEntry,
  ContextDependency,
  DependencyProfile,
  InspectorNode,
  TreeInspectorConfig,
} from "./types";
