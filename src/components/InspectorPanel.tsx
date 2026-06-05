/**
 * @file InspectorPanel.tsx
 * Metadata inspector pane — displays the runtime dependency profile
 * (props, context subscriptions, hook count) for a selected InspectorNode.
 *
 * Zero external dependencies — all styling is inline.
 */

import React, { type CSSProperties } from "react";
import type { InspectorNode, PropEntry } from "../types";
import { T, KIND_COLOR, MONO_FONT } from "./theme";

// ---------------------------------------------------------------------------
// Value serialisation
// ---------------------------------------------------------------------------

/**
 * Converts an arbitrary prop value to a short, readable string.
 * Caps recursion and string length to remain performant.
 */
function serializeValue(value: unknown, depth = 0): string {
  if (depth > 2) return "…";
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  if (typeof value === "function") {
    const name = (value as { name?: string }).name;
    return `ƒ ${name || "anonymous"}()`;
  }
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);

  if (typeof value === "string") {
    const s = value.length > 60 ? `${value.slice(0, 60)}…` : value;
    return `"${s}"`;
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : `Array(${value.length})`;
  }

  if (typeof value === "object") {
    try {
      const keys = Object.keys(value as object);
      if (keys.length === 0) return "{}";
      const preview = keys.slice(0, 3).join(", ");
      return `{${preview}${keys.length > 3 ? ", …" : ""}}`;
    } catch {
      return "[Object]";
    }
  }

  return String(value);
}

/** Colour-code a value by its type. */
function valueColor(value: unknown): string {
  if (value === null || value === undefined) return T.dim;
  if (typeof value === "boolean") return T.mauve;
  if (typeof value === "number") return T.orange;
  if (typeof value === "string") return T.green;
  if (typeof value === "function") return T.teal;
  if (Array.isArray(value)) return T.sky;
  return T.subtext;
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title, count }: { title: string; count?: number }) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "5px 12px",
    borderBottom: `1px solid ${T.border}`,
    borderTop: `1px solid ${T.border}`,
    backgroundColor: T.surfaceVariant,
  };

  return (
    <div style={style}>
      <span
        style={{
          fontFamily: MONO_FONT,
          fontSize: "10px",
          fontWeight: 700,
          color: T.subtext,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: "10px",
            color: T.dim,
            backgroundColor: T.overlay,
            borderRadius: "10px",
            padding: "0 7px",
            lineHeight: "1.6",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function PropRow({ entry }: { entry: PropEntry }) {
  const [hovered, setHovered] = React.useState(false);

  const serialized = serializeValue(entry.value);
  const color = valueColor(entry.value);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        padding: "4px 12px",
        borderBottom: `1px solid ${T.border}22`,
        fontFamily: MONO_FONT,
        fontSize: "11px",
        lineHeight: "1.5",
        backgroundColor: hovered ? `${T.hoverBg}80` : "transparent",
        transition: "background-color 0.1s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          color: T.accent,
          flexShrink: 0,
          minWidth: "90px",
          maxWidth: "120px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={entry.key}
      >
        {entry.key}
      </span>
      <span style={{ color: T.dim, flexShrink: 0 }}>:</span>
      <span
        style={{
          color,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={serialized}
      >
        {serialized}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        fontFamily: MONO_FONT,
        fontSize: "11px",
        color: T.dim,
        fontStyle: "italic",
      }}
    >
      {message}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        fontFamily: MONO_FONT,
        fontSize: "11px",
        lineHeight: "1.7",
        padding: "1px 0",
      }}
    >
      <span style={{ color: T.dim }}>{label}: </span>
      <span style={{ color: T.subtext }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InspectorPanel — public component
// ---------------------------------------------------------------------------

export interface InspectorPanelProps {
  /** The currently selected node, or null if nothing is selected yet. */
  node: InspectorNode | null;
}

export function InspectorPanel({ node }: InspectorPanelProps) {
  // ── Empty state ───────────────────────────────────────────────────────────
  if (!node) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: T.dim,
          fontFamily: MONO_FONT,
          fontSize: "12px",
          textAlign: "center",
          padding: "32px 24px",
          gap: "10px",
          backgroundColor: T.bg,
          boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: "28px" }}>🔍</span>
        <span>
          Select a component in the tree to inspect its runtime dependency
          profile.
        </span>
      </div>
    );
  }

  const { dependencyProfile: dp } = node;
  const kindColor = KIND_COLOR[node.kind];
  const displayName =
    node.kind === "HostComponent" ? `<${node.name}>` : node.name;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: T.bg,
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* ── Component Header ── */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: T.surface,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: "15px",
            fontWeight: 700,
            color: kindColor,
            marginBottom: "6px",
          }}
        >
          {displayName}
        </div>
        <span
          style={{
            display: "inline-block",
            fontFamily: MONO_FONT,
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "2px 10px",
            borderRadius: "12px",
            backgroundColor: `${kindColor}18`,
            color: kindColor,
            border: `1px solid ${kindColor}38`,
          }}
        >
          {node.kind}
        </span>
      </div>

      {/* ── Props ── */}
      <div style={{ flexShrink: 0 }}>
        <SectionHeader title="Props" count={dp.props.length} />
        {dp.props.length === 0 ? (
          <EmptyState message="No props" />
        ) : (
          dp.props.map((entry) => <PropRow key={entry.key} entry={entry} />)
        )}
      </div>

      {/* ── Context Subscriptions ── */}
      <div style={{ flexShrink: 0 }}>
        <SectionHeader
          title="Context Subscriptions"
          count={dp.contextDependencies.length}
        />
        {dp.contextDependencies.length === 0 ? (
          <EmptyState message="No context subscriptions detected" />
        ) : (
          dp.contextDependencies.map((dep, i) => (
            <div
              key={i}
              style={{
                padding: "5px 12px",
                fontFamily: MONO_FONT,
                fontSize: "11px",
                color: T.mauve,
                borderBottom: `1px solid ${T.border}22`,
                lineHeight: "1.5",
              }}
            >
              {dep.displayName}
            </div>
          ))
        )}
      </div>

      {/* ── Hooks ── */}
      <div style={{ flexShrink: 0 }}>
        <SectionHeader title="Hooks" count={dp.hookCount} />
        <div
          style={{
            padding: "8px 12px",
            fontFamily: MONO_FONT,
            fontSize: "11px",
            color: dp.hookCount > 0 ? T.teal : T.dim,
            lineHeight: "1.5",
          }}
        >
          {dp.hookCount === 0
            ? "No hooks detected (class component, host element, or no active hooks)"
            : `${dp.hookCount} active hook${dp.hookCount !== 1 ? "s" : ""} in memoizedState chain`}
        </div>
      </div>

      {/* ── Fiber Metadata ── */}
      <div style={{ flexShrink: 0 }}>
        <SectionHeader title="Fiber Metadata" />
        <div style={{ padding: "8px 12px" }}>
          <MetaRow label="depth" value={node.depth} />
          <MetaRow label="children" value={node.children.length} />
          <MetaRow label="id" value={node.id} />
        </div>
      </div>
    </div>
  );
}
