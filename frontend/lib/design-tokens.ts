export const tokens = {
  space: {
    0: "0px", 1: "4px", 2: "8px", 3: "12px", 4: "16px",
    5: "20px", 6: "24px", 8: "32px", 10: "40px", 12: "48px",
    16: "64px", 20: "80px", 24: "96px",
  },
  shadow: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    glow: "0 0 20px rgba(37, 99, 235, 0.3)",
    "glow-lg": "0 0 40px rgba(37, 99, 235, 0.4)",
  },
  transition: {
    fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    DEFAULT: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "400ms cubic-bezier(0.16, 1, 0.3, 1)",
  },
} as const

export const detectionColors = {
  ai: { DEFAULT: "hsl(0 84% 50%)", bg: "hsl(0 84% 97%)" },
  human: { DEFAULT: "hsl(142 76% 36%)", bg: "hsl(142 76% 97%)" },
  uncertain: { DEFAULT: "hsl(38 92% 50%)", bg: "hsl(38 92% 97%)" },
} as const
