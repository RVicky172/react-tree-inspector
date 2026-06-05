/**
 * @file withTreeInspector.tsx
 *
 * Exports two complementary ways to add the inspector to your app:
 *
 *   1. `withTreeInspector(Component, config)` — Higher-Order Component.
 *      Wraps an existing component and injects the floating button + overlay.
 *
 *   2. `<TreeInspector {...config} />` — Standalone drop-in component.
 *      Mount it anywhere in the tree; it crawls from the React root by default.
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  type CSSProperties,
  type ComponentType,
} from "react";
import { createPortal } from "react-dom";
import { crawlFiberTree } from "../fiberCrawler";
import { TreeViewer } from "../components/TreeViewer";
import { InspectorPanel } from "../components/InspectorPanel";
import type { InspectorNode, TreeInspectorConfig } from "../types";
import { T, MONO_FONT } from "../components/theme";

// ---------------------------------------------------------------------------
// Floating trigger button
// ---------------------------------------------------------------------------

const BUTTON_POSITION_STYLES: Record<
  NonNullable<TreeInspectorConfig["buttonPosition"]>,
  CSSProperties
> = {
  "bottom-right": { bottom: "20px", right: "20px" },
  "bottom-left": { bottom: "20px", left: "20px" },
  "top-right": { top: "20px", right: "20px" },
  "top-left": { top: "20px", left: "20px" },
};

interface FloatingButtonProps {
  position: NonNullable<TreeInspectorConfig["buttonPosition"]>;
  onClick: () => void;
}

function FloatingButton({ position, onClick }: FloatingButtonProps) {
  const [hovered, setHovered] = useState(false);

  const style: CSSProperties = {
    position: "fixed",
    ...BUTTON_POSITION_STYLES[position],
    zIndex: 999999,
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    backgroundColor: hovered ? "#7aa2f7" : T.accent,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 18px rgba(0,0,0,0.45)",
    transition: "background-color 0.15s, transform 0.15s, box-shadow 0.15s",
    transform: hovered ? "scale(1.12)" : "scale(1)",
    color: T.bg,
    fontSize: "20px",
    lineHeight: 1,
    fontFamily: MONO_FONT,
    fontWeight: 700,
  };

  return (
    <button
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Open React Tree Inspector (react-tree-inspector)"
      aria-label="Open React Tree Inspector"
    >
      ⬡
    </button>
  );
}

// ---------------------------------------------------------------------------
// InspectorOverlay — the full portal panel
// ---------------------------------------------------------------------------

interface InspectorOverlayProps {
  onClose: () => void;
  onRefresh: () => void;
  tree: InspectorNode | null;
  crawlError: string | null;
}

function InspectorOverlay({
  onClose,
  onRefresh,
  tree,
  crawlError,
}: InspectorOverlayProps) {
  const [selectedNode, setSelectedNode] = useState<InspectorNode | null>(null);

  // Reset selection whenever the tree is refreshed
  useEffect(() => {
    setSelectedNode(null);
  }, [tree]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const iconBtn: CSSProperties = {
    background: "transparent",
    border: `1px solid ${T.border}`,
    borderRadius: "6px",
    color: T.subtext,
    cursor: "pointer",
    padding: "4px 12px",
    fontSize: "11px",
    fontFamily: MONO_FONT,
    transition: "border-color 0.15s, color 0.15s",
    lineHeight: "1.6",
  };

  const colHeaderStyle: CSSProperties = {
    padding: "5px 12px",
    backgroundColor: T.surfaceVariant,
    borderBottom: `1px solid ${T.border}`,
    fontFamily: MONO_FONT,
    fontSize: "10px",
    fontWeight: 700,
    color: T.subtext,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    flexShrink: 0,
  };

  const nodeCount = tree ? countNodes(tree) : 0;

  return (
    // Backdrop — clicking outside closes the panel
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(3px)",
        zIndex: 999998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        fontFamily: MONO_FONT,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="React Tree Inspector"
    >
      {/* Panel — stop click propagation so it doesn't close when clicking inside */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "1140px",
          height: "100%",
          maxHeight: "88vh",
          backgroundColor: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: "10px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 30px 70px rgba(0,0,0,0.75)",
          zIndex: 999999,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Panel Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            backgroundColor: T.surface,
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px" }}>⬡</span>
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: "12px",
                fontWeight: 700,
                color: T.accent,
                letterSpacing: "0.06em",
              }}
            >
              REACT TREE INSPECTOR
            </span>
            {tree && (
              <span
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: "10px",
                  color: T.dim,
                  backgroundColor: T.overlay,
                  borderRadius: "10px",
                  padding: "1px 8px",
                }}
              >
                {nodeCount} nodes
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              style={iconBtn}
              onClick={onRefresh}
              title="Re-crawl the live Fiber tree"
            >
              ↺ Refresh
            </button>
            <button
              style={iconBtn}
              onClick={onClose}
              title="Close inspector (Esc)"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {crawlError && (
          <div
            style={{
              padding: "10px 16px",
              backgroundColor: "#2d1a1e",
              color: T.red,
              fontSize: "11px",
              fontFamily: MONO_FONT,
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
            }}
          >
            ⚠ {crawlError}
          </div>
        )}

        {/* ── Split body ── */}
        <div
          style={{
            display: "flex",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* Left — tree pane */}
          <div
            style={{
              width: "42%",
              minWidth: "220px",
              borderRight: `1px solid ${T.border}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={colHeaderStyle}>Component Tree</div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              {tree ? (
                <TreeViewer
                  root={tree}
                  selectedId={selectedNode?.id ?? null}
                  onSelect={setSelectedNode}
                />
              ) : (
                <div
                  style={{
                    padding: "20px 16px",
                    fontFamily: MONO_FONT,
                    fontSize: "11px",
                    color: T.dim,
                    lineHeight: "1.6",
                  }}
                >
                  {crawlError
                    ? "Crawl failed — see error above."
                    : "Click ↺ Refresh to crawl the live Fiber tree."}
                </div>
              )}
            </div>
          </div>

          {/* Right — inspector pane */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={colHeaderStyle}>Inspector</div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <InspectorPanel node={selectedNode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Recursively count total nodes in an InspectorNode tree. */
function countNodes(node: InspectorNode): number {
  return 1 + node.children.reduce((acc, c) => acc + countNodes(c), 0);
}

// ---------------------------------------------------------------------------
// Shared state hook (used by both the HOC and the standalone component)
// ---------------------------------------------------------------------------

interface InspectorState {
  isOpen: boolean;
  tree: InspectorNode | null;
  crawlError: string | null;
  handleOpen: () => void;
  handleClose: () => void;
  handleRefresh: () => void;
}

function useInspectorState(
  getRoot: () => Element | null,
  config: TreeInspectorConfig,
): InspectorState {
  const { maxDepth = 50, exclude, defaultOpen = false } = config;

  const [isOpen, setIsOpen] = useState(false);
  const [tree, setTree] = useState<InspectorNode | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  // Keep a stable ref to the latest getRoot/options so effects don't stale-close
  const crawlRef = useRef<() => void>(() => undefined);

  const crawl = useCallback(() => {
    const el = getRoot();
    if (!el) {
      setCrawlError(
        "Root element is not mounted. The inspector must be rendered inside a mounted React tree.",
      );
      setTree(null);
      return;
    }

    // Guard against server-side rendering
    if (typeof document === "undefined") return;

    const result = crawlFiberTree(el, { maxDepth, exclude });
    setTree(result.tree);
    setCrawlError(result.error);
  }, [getRoot, maxDepth, exclude]);

  // Keep crawlRef always pointing to the latest crawl function
  crawlRef.current = crawl;

  const handleOpen = useCallback(() => {
    crawlRef.current();
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Auto-open on mount when defaultOpen is true
  useEffect(() => {
    if (defaultOpen) {
      crawlRef.current();
      setIsOpen(true);
    }
    // Intentionally runs once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isOpen,
    tree,
    crawlError,
    handleOpen,
    handleClose,
    handleRefresh: crawl,
  };
}

// ---------------------------------------------------------------------------
// withTreeInspector — Higher-Order Component
// ---------------------------------------------------------------------------

/**
 * Wraps `WrappedComponent` with a floating React Tree Inspector overlay.
 *
 * The overlay crawls the Fiber tree starting from the wrapper div that
 * surrounds `WrappedComponent`, giving you a scoped subtree view.
 *
 * @example
 * ```tsx
 * export default withTreeInspector(App, {
 *   buttonPosition: 'bottom-right',
 *   maxDepth: 40,
 * });
 * ```
 *
 * @param WrappedComponent - Any React component.
 * @param config           - Optional inspector configuration.
 */
export function withTreeInspector<P extends object>(
  WrappedComponent: ComponentType<P>,
  config: TreeInspectorConfig = {},
) {
  const { buttonPosition = "bottom-right" } = config;

  const wrappedDisplayName =
    (WrappedComponent as { displayName?: string }).displayName ||
    (WrappedComponent as { name?: string }).name ||
    "Component";

  function InspectorWrapper(props: P) {
    const wrapperRef = useRef<HTMLDivElement>(null);

    const getRoot = useCallback((): Element | null => wrapperRef.current, []);

    const { isOpen, tree, crawlError, handleOpen, handleClose, handleRefresh } =
      useInspectorState(getRoot, config);

    return (
      <>
        {/*
          Thin wrapper div provides a stable DOM anchor for Fiber crawling.
          It does NOT affect layout (display: contents would be ideal but
          has known issues with refs in some React versions).
        */}
        <div ref={wrapperRef} style={{ display: "contents" }}>
          <WrappedComponent {...props} />
        </div>

        <FloatingButton position={buttonPosition} onClick={handleOpen} />

        {isOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <InspectorOverlay
              onClose={handleClose}
              onRefresh={handleRefresh}
              tree={tree}
              crawlError={crawlError}
            />,
            document.body,
          )}
      </>
    );
  }

  InspectorWrapper.displayName = `withTreeInspector(${wrappedDisplayName})`;
  return InspectorWrapper;
}

// ---------------------------------------------------------------------------
// TreeInspector — standalone drop-in component
// ---------------------------------------------------------------------------

/** Props for the standalone `<TreeInspector>` component. */
export interface TreeInspectorProps extends TreeInspectorConfig {
  /**
   * Optional ref pointing to a specific DOM element to use as the crawl root.
   * When omitted the inspector crawls from `#root` or `document.body`,
   * capturing the full application tree.
   */
  targetRef?: React.RefObject<Element | null>;
}

/**
 * Drop-in React component. Place it once, anywhere in the tree.
 * It mounts a floating button and, when clicked, opens the inspector overlay
 * via a React Portal attached to `document.body`.
 *
 * @example
 * ```tsx
 * // In index.tsx or App.tsx:
 * <TreeInspector buttonPosition="bottom-right" maxDepth={30} />
 * ```
 */
export function TreeInspector({
  targetRef,
  buttonPosition = "bottom-right",
  ...restConfig
}: TreeInspectorProps) {
  const getRoot = useCallback((): Element | null => {
    if (typeof document === "undefined") return null;
    if (targetRef?.current) return targetRef.current;
    // Default: crawl from the application root container for a full-app tree
    return (
      document.getElementById("root") ??
      document.getElementById("app") ??
      document.body
    );
  }, [targetRef]);

  const { isOpen, tree, crawlError, handleOpen, handleClose, handleRefresh } =
    useInspectorState(getRoot, { buttonPosition, ...restConfig });

  return (
    <>
      <FloatingButton position={buttonPosition} onClick={handleOpen} />
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <InspectorOverlay
            onClose={handleClose}
            onRefresh={handleRefresh}
            tree={tree}
            crawlError={crawlError}
          />,
          document.body,
        )}
    </>
  );
}
