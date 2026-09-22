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
        // Dynamic 2-tier surfaces (Light & Dark)
        "surface": "var(--color-surface, #ffffff)",
        "surface-card": "var(--color-surface-card, #ffffff)",
        "surface-secondary": "var(--color-surface-secondary, #f1f5f9)",
        "surface-elevated": "var(--color-surface-elevated, #ffffff)",
        "surface-container": "var(--color-surface-container, #ffffff)",
        "surface-container-high": "var(--color-surface-container-high, #f8fafc)",
        "surface-container-highest": "var(--color-surface-container-highest, #f1f5f9)",
        "surface-container-low": "var(--color-surface-container-low, #f8fafc)",
        "surface-container-lowest": "var(--color-surface-container-lowest, #ffffff)",
        "surface-variant": "var(--color-surface-secondary, #f1f5f9)",
        "surface-bright": "var(--color-surface-elevated, #ffffff)",
        "surface-dim": "var(--color-bg-page, #f8fafc)",

        // Typography contrast tokens
        "on-surface": "var(--color-text-primary, #0f172a)",
        "on-surface-variant": "var(--color-text-muted, #64748b)",
        "on-surface-secondary": "var(--color-text-secondary, #475569)",
        "on-background": "var(--color-text-primary, #0f172a)",
        "background": "var(--color-bg-page, #f8fafc)",

        // Accents
        "primary": "var(--color-primary, #e06a26)",
        "primary-container": "var(--color-primary-container, #ffede5)",
        "primary-fixed": "#ffdad3",
        "primary-fixed-dim": "#f27a38",
        "on-primary": "var(--color-on-primary, #ffffff)",
        "on-primary-container": "var(--color-on-primary-container, #9a3412)",

        // Secondary / Trust / Success
        "secondary": "var(--color-secondary, #10b981)",
        "secondary-container": "var(--color-secondary-container, #dcfce7)",
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#10b981",
        "on-secondary": "var(--color-on-secondary, #ffffff)",
        "on-secondary-container": "var(--color-on-secondary-container, #065f46)",

        // Borders & inputs
        "outline": "var(--color-border-subtle, rgba(15, 23, 42, 0.08))",
        "outline-variant": "var(--color-border-strong, rgba(15, 23, 42, 0.15))",
        "input-bg": "var(--color-input-bg, #ffffff)",
        "input-border": "var(--color-input-border, rgba(15, 23, 42, 0.12))",
        "input-text": "var(--color-input-text, #0f172a)",
        "input-placeholder": "var(--color-input-placeholder, #94a3b8)",

        // Error & Feedback
        "error": "#ef4444",
        "error-container": "#fef2f2",
        "on-error": "#ffffff",
        "on-error-container": "#991b1b",
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
        "card": "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        "dropdown": "var(--shadow-dropdown)",
        "elevated": "var(--shadow-elevated)",
      },
    },
  },
  plugins: [],
}
