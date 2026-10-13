/**
 * Verification harness for the reasoning display preference.
 *
 * It runs the plugin's real `contribute()` against a stub client and keeps the
 * contributions, so the transformer under test is the one that ships rather
 * than a copy of it. Results land on `window.__results` for a headless browser
 * to read.
 *
 * It also mounts a live ReasoningTrace so the two expansion props can be
 * flipped and the rendered output inspected, which is the only way to check
 * that a change to the setting moves traces already on screen.
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { View } from "react-native";

import contribute from "../index.client";
import { ReasoningTrace } from "../client/components/reasoning-trace";
import { buildThemeTokens } from "../client/components/theme-tokens";
import { embedFonts } from "../client/components/embed-fonts";
import {
  updateEnhancerPreferences,
  type ReasoningDisplayPreference,
} from "../client/preferences";
import type { ReasoningTraceData } from "../shared/contracts";

const DARK = {
  surface0: "#0f0f11",
  surface1: "#17171a",
  surface2: "#1f1f23",
  border: "#2a2a30",
  foreground: "#f2f3f5",
  foregroundMuted: "#a3a6ad",
  accent: "#7aa2f7",
  accentForeground: "#0f0f11",
  statusSuccess: "#4cb782",
  statusWarning: "#d9a53f",
  statusDanger: "#f2555a",
};

const reasoningItem = {
  type: "reasoning",
  text: "first thought\n\nsecond thought",
} as never;

function prefs(reasoningDisplay: ReasoningDisplayPreference) {
  updateEnhancerPreferences({ reasoningDisplay });
}

/**
 * Captures contributions so the real transformer can be called directly. The
 * contribute() function also installs DOM-level chrome (fonts, find bar); those
 * run for real here and are harmless on a blank page.
 */
function captureContributions() {
  const transformers = new Map<string, (input: unknown) => unknown>();
  const renderers = new Map<string, unknown>();
  const fake = {
    addSettingsScreen: () => () => {},
    addTimelineTransformer: (c: { id: string; transform: (i: unknown) => unknown }) => {
      transformers.set(c.id, c.transform);
      return () => {};
    },
    addTimelineRenderer: (c: { kind: string }) => {
      renderers.set(c.kind, c);
      return () => {};
    },
  };
  const cleanup = contribute(fake as never);
  return { transformers, renderers, cleanup };
}

/**
 * The contract for the "host" option: the transformer declines the item, and a
 * declined item is what the host renders itself. Everything else hands back a
 * plugin item.
 */
function runTransformerChecks() {
  const { transformers } = captureContributions();
  const transform = transformers.get("omp-enhanced-reasoning");
  if (!transform) return [{ name: "reasoning transformer registered", pass: false }];

  const checks: { name: string; pass: boolean; detail?: unknown }[] = [];
  for (const [value, expectDeclined] of [
    ["host", true],
    ["stream", false],
    ["expanded", false],
  ] as const) {
    prefs(value);
    const out = transform({ item: reasoningItem, phase: "complete" }) as
      | { items?: { kind: string }[] }
      | undefined;
    const declined = out === undefined;
    const kind = out?.items?.[0]?.kind;
    checks.push({
      name: `reasoningDisplay="${value}" ${expectDeclined ? "declines the item" : "claims the item"}`,
      pass: declined === expectDeclined && (expectDeclined || kind === "omp-reasoning"),
      detail: declined ? "undefined (host renders)" : kind,
    });
  }

  // The renderer must exist regardless of the setting: "host" is handled by the
  // transformer declining, so unregistering the renderer would break the other
  // two options the moment someone flipped back.
  const renderers = captureContributions().renderers;
  checks.push({
    name: "reasoning renderer stays registered at every setting",
    pass: renderers.has("omp-reasoning"),
  });

  return checks;
}

const traceData: ReasoningTraceData = {
  id: "check",
  agentModel: "",
  durationMs: 1200,
  totalTokens: 12,
  status: "completed",
  steps: [
    { id: "s1", number: 1, status: "completed", content: "STEP-ONE-MARKER" },
    { id: "s2", number: 2, status: "completed", content: "STEP-TWO-MARKER" },
  ],
};

/**
 * A trace whose two props can be driven from outside, so the state-adoption
 * rule can be observed rather than assumed.
 *
 * `defaultExpanded` is a mount-time value, so testing it means mounting a fresh
 * trace — the `epoch` counter in the key does that, the way a new reasoning
 * block arrives in the real timeline.
 */
function TraceProbe() {
  const [defaultExpanded, setDefaultExpanded] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [tokens] = useState(() => buildThemeTokens(DARK));

  (window as never as Record<string, unknown>).__setProps = (
    next: { defaultExpanded?: boolean; expandAll?: boolean; remount?: boolean },
  ) => {
    if (next.defaultExpanded !== undefined) setDefaultExpanded(next.defaultExpanded);
    if (next.expandAll !== undefined) setExpandAll(next.expandAll);
    if (next.remount) setEpoch((n) => n + 1);
  };

  return (
    <View>
      <ReasoningTrace
        key={epoch}
        data={traceData}
        tokens={tokens}
        defaultExpanded={defaultExpanded}
        expandAll={expandAll}
      />
    </View>
  );
}

embedFonts();
const mount = document.getElementById("root");
if (mount) {
  createRoot(mount).render(<TraceProbe />);
}
(window as never as Record<string, unknown>).__transformerChecks = runTransformerChecks;
