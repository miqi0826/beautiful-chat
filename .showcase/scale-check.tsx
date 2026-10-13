/**
 * Verification harness for the type-size preference.
 *
 * It mounts the real components at a chosen scale and exposes the resulting
 * computed sizes to a headless browser, so a scale claim is checked against
 * what the browser actually laid out rather than against the source.
 *
 * `?scale=compact|default|large|larger` picks the step; a single panel is
 * mounted per load because the preference is global state and two panels on one
 * page would fight over it.
 */
import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { View } from "react-native";

import { embedFonts } from "../client/components/embed-fonts";
import { buildThemeTokens } from "../client/components/theme-tokens";
import { ToolCallout } from "../client/components/tool-callouts";
import { UserMessage } from "../client/components/user-message";
import { MarkdownView } from "../client/components/markdown/markdown-view";
import { BeautifulChatSettingsPage } from "../client/settings-page";
import {
  updateEnhancerPreferences,
  useEnhancerPreferences,
  type FontScalePreference,
} from "../client/preferences";
import type { ToolCalloutData } from "../shared/contracts";

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

/** A bash call, because its prompt glyph is drawn rather than set as text. */
const bash = {
  id: "bash",
  tool: "bash",
  title: "npm run typecheck",
  status: "completed",
  durationMs: 2400,
  command: "npm run typecheck",
  output: "> tsc --noEmit\n\nno errors",
} as unknown as ToolCalloutData;

const markdown = `## Heading two

A paragraph with \`inline code\` and a [link](https://example.com).

- first item
- second item with more text to force wrapping behaviour

| Column A | Column B |
| --- | --- |
| alpha | beta |
| gamma | delta |
`;

/**
 * One panel, every component wired the way production wires it: a renderer
 * subscribes to the preferences, rebuilds tokens in a memo, and hands them
 * down. Clicking a control in the settings screen therefore rescales the
 * stream beside it, and that live path is the thing worth measuring — a
 * component handed fixed tokens would prove nothing.
 */
function Panel({ scale }: { scale: FontScalePreference }) {
  const preferences = useEnhancerPreferences();
  const tokens = useMemo(() => buildThemeTokens(DARK, preferences), [preferences]);
  return (
    <div id="panel" data-scale={scale} style={{ width: 720, padding: 16, background: DARK.surface0 }}>
      <View style={{ gap: 12 }}>
        <ToolCallout data={bash} tokens={tokens} />
        <MarkdownView text={markdown} tokens={tokens} variant="document" />
        <UserMessage
          text="A user prompt that should scale with the setting."
          timestamp={new Date()}
          tokens={tokens}
        />
        <BeautifulChatSettingsPage theme={{ colors: DARK } as never} />
      </View>
    </div>
  );
}

function main() {
  const requested = new URLSearchParams(location.search).get("scale");
  const scale: FontScalePreference =
    requested === "compact" || requested === "large" || requested === "larger"
      ? requested
      : "default";
  // Before the first render, so nothing ever lays out at a stale scale.
  updateEnhancerPreferences({ fontScale: scale });
  embedFonts();
  const mount = document.getElementById("root");
  if (mount) createRoot(mount).render(<Panel scale={scale} />);
}

main();
