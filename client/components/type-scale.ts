import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

import { FONT_SCALES, useEnhancerPreferences, type FontScalePreference } from "../preferences";

type AnyStyle = ViewStyle | TextStyle | ImageStyle;
type StyleRecord = Record<string, AnyStyle>;

/**
 * Type, and the space that carries it, scale together so a card keeps its
 * proportions at every step.
 *
 * `fontSize`, `lineHeight` and the gaps and padding around them are what make
 * text readable; scaling one without the others either crowds the glyphs or
 * leaves them swimming in a box built for the old size. Boxes that hold type —
 * an icon bubble, a code gutter, the inset that lines a rail up with the text
 * beside it — ride along so they stay centred on what they annotate.
 *
 * Borders stay put: a hairline is a hairline at any type size, and a fractional
 * border renders as a blur where the platform cannot draw half a pixel. Radii
 * do scale, because a pill is a radius half its height — pinned, it would
 * square off as the box grew.
 */
const TYPE_AND_SPACE = new Set([
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "borderRadius",
  "gap",
  "rowGap",
  "columnGap",
  "padding",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingHorizontal",
  "paddingVertical",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "top",
  "left",
  "right",
  "bottom",
]);

/**
 * Past this a dimension is a layout bound rather than a size derived from type:
 * an image's maximum height, a find bar's fixed input. Bounds stay put so a
 * larger type scale cannot make a screenshot take over the thread.
 */
const BOX_LIMIT = 64;

const BOUNDED = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "top",
  "left",
  "right",
  "bottom",
]);

/** Two decimals is finer than any renderer resolves, and keeps the arithmetic tidy. */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function scaleNumber(property: string, value: number, scale: number): number {
  if (!TYPE_AND_SPACE.has(property)) return value;
  if (property === "borderRadius") {
    // A pill is half its height; pinning the radius squares the box off as it
    // grows. A chip stays a chip.
    return value >= 999 ? value : round(value * scale);
  }
  if (BOUNDED.has(property)) {
    // A hairline is structural at every type size.
    if (Math.abs(value) <= 1) return value;
    // Past the limit the value bounds the layout rather than following the type.
    if (Math.abs(value) > BOX_LIMIT) return value;
  }
  return round(value * scale);
}

/** One flat style object. Nested objects and arrays (`transform`, `fontVariant`) are walked. */
export function scaleStyle<T extends AnyStyle>(style: T, scale: number): T {
  const next: Record<string, unknown> = {};
  for (const [property, raw] of Object.entries(style)) {
    if (typeof raw === "number") {
      next[property] = scaleNumber(property, raw, scale);
    } else if (Array.isArray(raw)) {
      next[property] = raw.map((entry) =>
        entry && typeof entry === "object" ? scaleStyle(entry as AnyStyle, scale) : entry,
      );
    } else if (raw && typeof raw === "object") {
      next[property] = scaleStyle(raw as AnyStyle, scale);
    } else {
      next[property] = raw;
    }
  }
  return next as T;
}

/**
 * A stylesheet at the reader's scale. At the default step this returns its input
 * untouched, so the authored numbers stay the single source of truth and the
 * default rendering is exactly what it was before a scale existed.
 */
export function scaleStyles<T extends StyleRecord>(styles: T, scale: number): T {
  if (scale === 1) return styles;
  const next: StyleRecord = {};
  for (const [name, style] of Object.entries(styles)) {
    next[name] = scaleStyle(style, scale);
  }
  return next as T;
}

/**
 * `StyleSheet.create` at a scale, in the shape every call site already has.
 *
 * The scale arrives as the first argument so a site changes one word rather
 * than its indentation, and the authored numbers below stay where they were.
 * Scaling happens before `create` because a platform may hand back a registry
 * id rather than the object, and an id cannot be walked.
 */
export function createStyles<T extends StyleRecord>(scale: number, styles: T): T {
  return StyleSheet.create(scaleStyles(styles, scale)) as T;
}

/** The multiplier a preference names. */
export function scaleFor(preference: FontScalePreference | undefined): number {
  return FONT_SCALES[preference ?? "default"] ?? 1;
}

/**
 * The live scale, for the code that builds styles outside the React tree: the
 * selection bar lives in shadow DOM and the find bar in injected CSS, so neither
 * can reach the tokens.
 */
export function useTypeScale(): number {
  return scaleFor(useEnhancerPreferences().fontScale);
}

/**
 * Stylesheets built at module scope cannot read the live preference. The set of
 * steps is closed and tiny, so one build per step is kept and reused.
 */
export function createScaleCache<T extends StyleRecord>(build: () => T): (scale: number) => T {
  const cache = new Map<number, T>();
  return (scale: number) => {
    const hit = cache.get(scale);
    if (hit) return hit;
    const built = scaleStyles(build(), scale);
    cache.set(scale, built);
    return built;
  };
}

/** A bare number that follows the type scale, such as a glyph size. */
export function scaleSize(value: number, scale: number): number {
  return round(value * scale);
}
