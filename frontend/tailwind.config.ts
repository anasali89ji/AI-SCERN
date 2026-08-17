import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        aiscern: {
          bg: {
            primary: "#05070A",
            secondary: "#0A0F14",
            surface: "#0D1219",
            elevated: "#111827",
          },
          accent: {
            cyan: "#00D4FF",
            "cyan-dim": "rgba(0, 212, 255, 0.15)",
            blue: "#3B82F6",
            "blue-dim": "rgba(59, 130, 246, 0.15)",
          },
          text: {
            primary: "#F0F4F8",
            secondary: "#94A3B8",
            muted: "#64748B",
            inverse: "#05070A",
          },
          border: {
            subtle: "rgba(255, 255, 255, 0.06)",
            DEFAULT: "rgba(255, 255, 255, 0.08)",
            strong: "rgba(255, 255, 255, 0.12)",
          },
          status: {
            authentic: "#10B981",
            "authentic-dim": "rgba(16, 185, 129, 0.15)",
            human: "#34D399",
            uncertain: "#F59E0B",
            "uncertain-dim": "rgba(245, 158, 11, 0.15)",
            suspicious: "#F97316",
            "suspicious-dim": "rgba(249, 115, 22, 0.15)",
            risk: "#EF4444",
            "risk-dim": "rgba(239, 68, 68, 0.15)",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 8vw, 6rem)", { lineHeight: "1.0", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2.5rem, 5vw, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(1.5rem, 3vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        label: ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.08em" }],
        "metric-lg": ["clamp(2rem, 4vw, 3.5rem)", { lineHeight: "1", letterSpacing: "-0.02em" }],
      },
      spacing: { "18": "4.5rem", "22": "5.5rem" },
      borderRadius: { "4xl": "2rem" },
      animation: {
        "scan-line": "scanLine 3s linear infinite",
        "pulse-slow": "pulseSlow 4s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
        "progress-fill": "progressFill 2s ease-out forwards",
        "signal-ping": "signalPing 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
      keyframes: {
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 212, 255, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 212, 255, 0.4)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        progressFill: {
          "0%": { width: "0%" },
          "100%": { width: "var(--progress-width, 100%)" },
        },
        signalPing: {
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern": "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
    },
  },
  plugins: [],
};

export default config;
