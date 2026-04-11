import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "surface-dim": "#131313",
        "surface-container-lowest": "#0E0E0E",
        "surface-container-low": "#1C1B1B",
        "surface-container": "#201F1F",
        "surface-container-high": "#2A2A2A",
        "surface-container-highest": "#353534",
        surface: "#131313",
        "surface-bright": "#3A3939",
        primary: "#4EDEA3",
        "primary-container": "#10B981",
        "on-primary": "#003824",
        secondary: "#9ED2B5",
        "secondary-container": "#21523C",
        "on-secondary-container": "#91C4A8",
        tertiary: "#FFB3AF",
        "tertiary-container": "#FC7C78",
        "on-tertiary-container": "#711419",
        "on-surface": "#E5E2E1",
        "on-surface-variant": "#BBCABF",
        "on-background": "#E5E2E1",
        outline: "#86948A",
        "outline-variant": "#3C4A42",
        error: "#FFB4AB",
        "error-container": "#93000A",
        "inverse-surface": "#E5E2E1",
        "inverse-on-surface": "#313030",
        "inverse-primary": "#006C49",
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Space Grotesk", "monospace"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
