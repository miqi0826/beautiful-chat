import { useSyncExternalStore } from "react";

export const ACCENT_PRESETS = {
  host: undefined,
  jade: "#10b981",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
} as const;

export type AccentPreset = keyof typeof ACCENT_PRESETS;
export type UiFontPreference = "inter" | "system";
export type CodeFontPreference = "code" | "plain";
export type MarkdownVariantPreference = "document" | "compact" | "terminal";

/**
 * Type scale multipliers.
 *
 * The plugin's stylesheets are authored at 1, and the daemon cannot know how
 * far a reader sits from the screen, so the reader picks. The steps are wide
 * enough to be worth choosing and the top one is deliberately generous: this is
 * the only way to make the stream readable on a large display, and a control
 * that stops short of that has not solved the problem it exists for.
 */
export const FONT_SCALES = {
  compact: 0.9,
  default: 1,
  large: 1.2,
  larger: 1.45,
} as const;

export type FontScalePreference = keyof typeof FONT_SCALES;

/**
 * How the model's reasoning is drawn.
 *
 * The plugin intercepts reasoning the same way it intercepts tool calls, which
 * means the host's own setting for it stops applying: the trace is the plugin's
 * component, and nothing tells the plugin what the reader chose in Paseo. The
 * third option is the way out — leaving reasoning to the host hands the row
 * back, and the reader's Paseo setting governs it again.
 */
export type ReasoningDisplayPreference = "stream" | "expanded" | "host";

export interface EnhancerPreferences {
  accent: AccentPreset;
  uiFont: UiFontPreference;
  codeFont: CodeFontPreference;
  /** Multiplier applied to every type size and to the spacing that carries it. */
  fontScale: FontScalePreference;
  frostedGlass: boolean;
  /**
   * A light that follows the pointer across a card. Web and desktop only:
   * touch platforms have no hover, so the attribute is inert there.
   */
  pointerGlow: boolean;
  /**
   * Paseo maps a stream item to the plugin timeline item before any transformer
   * runs, and that mapping carries only the text. Pasted images therefore never
   * reach plugin code, so the enhanced bubble cannot draw them. Turning this off
   * hands prompts back to the host, whose own bubble still shows them.
   */
  enhancedUserBubble: boolean;
  /**
   * The Copy / Add to chat bar that follows a highlight. Web and desktop only:
   * iOS and Android route selection through the platform's own menu, which the
   * plugin cannot extend, so the toggle has no effect there.
   */
  selectionActions: boolean;
  /**
   * The plugin's own markdown rendering for assistant replies. Off hands the
   * turn back to Paseo's renderer, which is the safety valve: the plugin
   * cannot import the host markdown pipeline, so its version is a reasonable
   * subset rather than a superset.
   */
  assistantMarkdown: boolean;
  /** Which look the markdown renderer uses. */
  markdownVariant: MarkdownVariantPreference;
  /** Whether the plugin draws the model's reasoning, and how. */
  reasoningDisplay: ReasoningDisplayPreference;
}

const STORAGE_KEY = "paseo/beautiful-chat/preferences/v1";

export const DEFAULT_PREFERENCES: Readonly<EnhancerPreferences> = {
  accent: "host",
  uiFont: "inter",
  codeFont: "code",
  fontScale: "default",
  frostedGlass: true,
  pointerGlow: true,
  enhancedUserBubble: true,
  selectionActions: true,
  assistantMarkdown: true,
  markdownVariant: "document",
  reasoningDisplay: "stream",
};

const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  const candidate = globalThis as typeof globalThis & { localStorage?: Storage };
  return candidate.localStorage;
}

function isAccentPreset(value: unknown): value is AccentPreset {
  return typeof value === "string" && value in ACCENT_PRESETS;
}

function isFontScale(value: unknown): value is FontScalePreference {
  return typeof value === "string" && value in FONT_SCALES;
}

function isReasoningDisplay(value: unknown): value is ReasoningDisplayPreference {
  return value === "stream" || value === "expanded" || value === "host";
}

function loadPreferences(): EnhancerPreferences {
  try {
    const stored = storage()?.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PREFERENCES };
    const candidate = JSON.parse(stored) as Partial<EnhancerPreferences>;
    return {
      accent: isAccentPreset(candidate.accent) ? candidate.accent : DEFAULT_PREFERENCES.accent,
      uiFont: candidate.uiFont === "system" ? "system" : DEFAULT_PREFERENCES.uiFont,
      codeFont: candidate.codeFont === "plain" ? "plain" : DEFAULT_PREFERENCES.codeFont,
      fontScale: isFontScale(candidate.fontScale)
        ? candidate.fontScale
        : DEFAULT_PREFERENCES.fontScale,
      frostedGlass:
        typeof candidate.frostedGlass === "boolean"
          ? candidate.frostedGlass
          : DEFAULT_PREFERENCES.frostedGlass,
      pointerGlow:
        typeof candidate.pointerGlow === "boolean"
          ? candidate.pointerGlow
          : DEFAULT_PREFERENCES.pointerGlow,
      enhancedUserBubble:
        typeof candidate.enhancedUserBubble === "boolean"
          ? candidate.enhancedUserBubble
          : DEFAULT_PREFERENCES.enhancedUserBubble,
      selectionActions:
        typeof candidate.selectionActions === "boolean"
          ? candidate.selectionActions
          : DEFAULT_PREFERENCES.selectionActions,
      assistantMarkdown:
        typeof candidate.assistantMarkdown === "boolean"
          ? candidate.assistantMarkdown
          : DEFAULT_PREFERENCES.assistantMarkdown,
      markdownVariant:
        candidate.markdownVariant === "compact" || candidate.markdownVariant === "terminal"
          ? candidate.markdownVariant
          : DEFAULT_PREFERENCES.markdownVariant,
      reasoningDisplay: isReasoningDisplay(candidate.reasoningDisplay)
        ? candidate.reasoningDisplay
        : DEFAULT_PREFERENCES.reasoningDisplay,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

let preferences = loadPreferences();

function publish(): void {
  for (const listener of listeners) listener();
}

export function getEnhancerPreferences(): EnhancerPreferences {
  return preferences;
}

export function updateEnhancerPreferences(update: Partial<EnhancerPreferences>): void {
  preferences = { ...preferences, ...update };
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Browser storage can be disabled. Keep the change alive for this session.
  }
  publish();
}

export function resetEnhancerPreferences(): void {
  preferences = { ...DEFAULT_PREFERENCES };
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Keep the default session value if storage is unavailable.
  }
  publish();
}

export function useEnhancerPreferences(): EnhancerPreferences {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getEnhancerPreferences,
    getEnhancerPreferences,
  );
}
