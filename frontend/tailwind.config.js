/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Obsidian & Slate 2-tier surfaces
        "surface": "var(--color-surface, #0b0f17)",
        "surface-container": "var(--color-surface-container, #121824)",
        "surface-container-high": "var(--color-surface-container-high, #182030)",
        "surface-container-highest": "var(--color-surface-container-highest, #20293d)",
        "surface-container-low": "var(--color-surface-container-low, #0e131d)",
        "surface-container-lowest": "var(--color-surface-container-lowest, #07090e)",
        "surface-variant": "#1a2233",
        "surface-bright": "#222c42",
        "surface-dim": "#0b0f17",

        // Typography contrast
        "on-surface": "#f8fafc",
        "on-surface-variant": "#94a3b8",
        "on-background": "#f8fafc",
        "background": "#0b0f17",

        // Accents
        "primary": "var(--color-primary, #e06a26)",
        "primary-container": "var(--color-primary-container, #2a160c)",
        "primary-fixed": "#ffdad3",
        "primary-fixed-dim": "#f27a38",
        "on-primary": "#ffffff",
        "on-primary-container": "#ffdad3",

        // Secondary / Trust / Success
        "secondary": "var(--color-secondary, #10b981)",
        "secondary-container": "var(--color-secondary-container, #063725)",
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#10b981",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#a7f3d0",

        // Borders & dividers
        "outline": "rgba(255, 255, 255, 0.08)",
        "outline-variant": "rgba(255, 255, 255, 0.05)",

        // Error & Feedback
        "error": "#f87171",
        "error-container": "#450a0a",
        "on-error": "#ffffff",
        "on-error-container": "#fecaca",
      },
      borderRadius: {
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        full: "9999px",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        "headline-xl": ["Plus Jakarta Sans", "sans-serif"],
        "headline-lg": ["Plus Jakarta Sans", "sans-serif"],
        "headline-md": ["Plus Jakarta Sans", "sans-serif"],
        "headline-sm": ["Plus Jakarta Sans", "sans-serif"],
        "headline-xl-mobile": ["Plus Jakarta Sans", "sans-serif"],
        "headline-lg-mobile": ["Plus Jakarta Sans", "sans-serif"],
        "body-lg": ["Plus Jakarta Sans", "sans-serif"],
        "body-md": ["Plus Jakarta Sans", "sans-serif"],
        "body-sm": ["Plus Jakarta Sans", "sans-serif"],
        "label-lg": ["Plus Jakarta Sans", "sans-serif"],
        "label-md": ["Plus Jakarta Sans", "sans-serif"],
        "label-sm": ["Plus Jakarta Sans", "sans-serif"],
        "currency-display": ["Plus Jakarta Sans", "sans-serif"],
      },
      fontSize: {
        "headline-xl": ["44px", { lineHeight: "52px", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "700" }],
        "headline-md": ["22px", { lineHeight: "28px", fontWeight: "600" }],
        "headline-sm": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "headline-xl-mobile": ["32px", { lineHeight: "38px", fontWeight: "700" }],
        "headline-lg-mobile": ["24px", { lineHeight: "30px", fontWeight: "700" }],
        "body-lg": ["16px", { lineHeight: "26px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "22px", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "18px", fontWeight: "400" }],
        "label-lg": ["14px", { lineHeight: "20px", fontWeight: "600" }],
        "label-md": ["12px", { lineHeight: "16px", fontWeight: "600" }],
        "label-sm": ["11px", { lineHeight: "14px", fontWeight: "500" }],
        "currency-display": ["26px", { lineHeight: "32px", fontWeight: "700" }],
      },
      boxShadow: {
        "card": "0 4px 20px -2px rgba(0, 0, 0, 0.25)",
        "card-hover": "0 12px 32px -4px rgba(0, 0, 0, 0.35)",
        "dropdown": "0 10px 30px -4px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  plugins: [],
}
