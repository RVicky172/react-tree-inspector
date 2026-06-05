/**
 * @file TreeViewer.tsx
 * Recursive, keyboard-navigable, collapsible Fiber tree rendering component.
 *
 * Zero external dependencies — all styling is inline to avoid any CSS
 * conflicts with the host application.
 */

import React, { useState, useCallback, type CSSProperties } from "react";
import type { InspectorNode } from "../types";
import { T, KIND_COLOR, KIND_BADGE, MONO_FONT } from "./theme";

// ---------------------------------------------------------------------------
// TreeNode — individual row in the tree
// ---------------------------------------------------------------------------

const INDENT_PX = 16;

interface TreeNodeProps {
  node: InspectorNode;
  selectedId: string | null;
  onSelect: (node: InspectorNode) => void;
  /** Auto-expand the first 3 levels on initial render */
  autoExpand?: boolean;
}

function TreeNode({
  node,
  selectedId,
  onSelect,
  autoExpand = true,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(autoExpand && node.depth < 3);
  const [hovered, setHovered] = useState(false);

  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;
  const kindColor = KIND_COLOR[node.kind];

  const handleRowClick = useCallback(() => {
    onSelect(node);
  }, [node, onSelect]);

  const handleToggle = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (hasChildren) setExpanded((v) => !v);
    },
    [hasChildren],
  );

  // ── Row styles ──────────────────────────────────────────────────────────

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    paddingLeft: `${node.depth * INDENT_PX + 6}px`,
    paddingRight: "10px",
    paddingTop: "3px",
    paddingBottom: "3px",
    cursor: "pointer",
    borderRadius: "4px",
    backgroundColor: isSelected
      ? T.selectedBg
      : hovered
        ? T.hoverBg
        : "transparent",
    borderLeft: isSelected
      ? `2px solid ${T.selectedBorder}`
      : "2px solid transparent",
    userSelect: "none",
    transition: "background-color 0.1s, border-color 0.1s",
    outline: "none",
  };

  const toggleStyle: CSSProperties = {
    width: "12px",
    height: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: T.dim,
    fontSize: "9px",
    flexShrink: 0,
    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
    transition: "transform 0.12s ease",
    opacity: hasChildren ? 1 : 0,
    pointerEvents: hasChildren ? "auto" : "none",
  };

  const badgeStyle: CSSProperties = {
    fontFamily: MONO_FONT,
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "1px 5px",
    borderRadius: "3px",
    backgroundColor: `${kindColor}18`,
    color: kindColor,
    border: `1px solid ${kindColor}38`,
    flexShrink: 0,
    lineHeight: "1.5",
  };

  const nameStyle: CSSProperties = {
    fontFamily: MONO_FONT,
    fontSize: "12px",
    color: kindColor,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    lineHeight: "1.5",
  };

  const countStyle: CSSProperties = {
    fontFamily: MONO_FONT,
    fontSize: "10px",
    color: T.dim,
    flexShrink: 0,
    marginLeft: "2px",
  };

  const displayName =
    node.kind === "HostComponent" ? `<${node.name}>` : node.name;

  return (
    <div>
      {/* ── Row ── */}
      <div
        style={rowStyle}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleRowClick();
          if (e.key === "ArrowRight" && hasChildren && !expanded)
            setExpanded(true);
          if (e.key === "ArrowLeft" && expanded) setExpanded(false);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand / collapse toggle */}
        <span
          style={toggleStyle}
          role="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={handleToggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleToggle(e);
          }}
          tabIndex={-1}
        >
          ▶
        </span>

        {/* Kind badge */}
        <span style={badgeStyle}>{KIND_BADGE[node.kind]}</span>

        {/* Component name */}
        <span style={nameStyle} title={displayName}>
          {displayName}
        </span>

        {/* Child count hint */}
        {hasChildren && (
          <span
            style={countStyle}
            aria-label={`${node.children.length} children`}
          >
            {node.children.length}
          </span>
        )}
      </div>

      {/* ── Children ── */}
      {expanded && hasChildren && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              autoExpand={autoExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TreeViewer — public component
// ---------------------------------------------------------------------------

export interface TreeViewerProps {
  /** Root node of the crawled InspectorNode tree. */
  root: InspectorNode;
  /** The currently selected node's id, or null if nothing is selected. */
  selectedId: string | null;
  /** Called when the user clicks or keyboard-activates a node. */
  onSelect: (node: InspectorNode) => void;
}

export function TreeViewer({ root, selectedId, onSelect }: TreeViewerProps) {
  const containerStyle: CSSProperties = {
    height: "100%",
    overflowY: "auto",
    padding: "8px 4px",
    boxSizing: "border-box",
    backgroundColor: T.bg,
  };

  return (
    <div style={containerStyle} role="tree" aria-label="Component tree">
      <TreeNode
        node={root}
        selectedId={selectedId}
        onSelect={onSelect}
        autoExpand
      />
    </div>
  );
}
