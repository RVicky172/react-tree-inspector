/**
 * @file theme.ts
 * Shared design-system tokens for the React Tree Inspector UI.
 * Palette is Catppuccin Mocha — a low-contrast dark theme optimised for
 * long debugging sessions.
 */

/** Base colour palette */
export const T = {
  // Surfaces
  bg: "#1e1e2e",
  surface: "#181825",
  surfaceVariant: "#313244",
  overlay: "#45475a",
  border: "#313244",

  // Text
  text: "#cdd6f4",
  subtext: "#a6adc8",
  dim: "#6c7086",

  // Interactive states
  hoverBg: "#24273a",
  selectedBg: "#2a2a40",
  selectedBorder: "#7aa2f7",

  // Accent palette
  accent: "#89b4fa", // blue
  green: "#a6e3a1",
  yellow: "#f9e2af",
  red: "#f38ba8",
  mauve: "#cba6f7",
  teal: "#94e2d5",
  orange: "#fab387",
  pink: "#f5c2e7",
  sky: "#89dceb",
} as const;

/** Colour assigned to each ComponentKind in tree/badge rendering. */
import type { ComponentKind } from "../types";

export const KIND_COLOR: Record<ComponentKind, string> = {
  HostComponent: T.accent, // blue   — DOM elements feel structural
  FunctionComponent: T.green, // green  — pure functions
  ClassComponent: T.yellow, // yellow — legacy class-based
  ContextProvider: T.mauve, // mauve  — data providers
  ContextConsumer: T.pink, // pink   — data consumers
  ForwardRef: T.teal, // teal   — ref-forwarding wrappers
  Memo: T.subtext, // muted  — optimisation wrappers
  HOC: T.red, // red    — higher-order wrappers (attention!)
  Fragment: T.dim, // dim    — structural non-element
  Suspense: T.orange, // orange — async boundary
  Unknown: T.dim, // dim    — unclassified
};

/** Short badge label for each ComponentKind. */
export const KIND_BADGE: Record<ComponentKind, string> = {
  HostComponent: "DOM",
  FunctionComponent: "FC",
  ClassComponent: "CC",
  ContextProvider: "CTX.P",
  ContextConsumer: "CTX.C",
  ForwardRef: "FWD",
  Memo: "MEMO",
  HOC: "HOC",
  Fragment: "FRAG",
  Suspense: "SUSP",
  Unknown: "?",
};

/** Monospaced font stack — all fonts widely available in dev environments. */
export const MONO_FONT =
  '"Fira Code", "Cascadia Code", "JetBrains Mono", "SF Mono", ui-monospace, monospace';
