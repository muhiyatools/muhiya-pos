import { type CSSProperties } from 'react'

/**
 * Extended CSS properties type that includes CSS custom properties (variables)
 * This solves the TypeScript error when using var() in inline styles
 */
export interface ExtendedCSSProperties extends CSSProperties {
  [key: `--${string}`]: string | number
}

/**
 * Utility to create style objects with CSS variables
 * Use this instead of `as any` for inline styles with CSS variables
 */
export function createStyles(styles: ExtendedCSSProperties): React.CSSProperties {
  return styles as React.CSSProperties
}

/**
 * Utility for ring color styles specifically
 */
export function ringColorStyle(color: string): React.CSSProperties {
  return {
    '--tw-ring-color': color,
  } as React.CSSProperties
}
