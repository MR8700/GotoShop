import Icon from "./Icon";
import React from "react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ variant = "icon", className = "" }) {
  const { theme, toggleTheme, isDark } = useTheme();

  if (variant === "pill") {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
        title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-subtle bg-surface-secondary hover:bg-surface-container-highest text-on-surface transition-all active:scale-95 text-xs font-medium ${className}`}
      >
        <Icon name={isDark ? "light_mode" : "dark_mode"} className="text-[16px] text-primary" />
        <span className="font-medium text-[11px]">
          {isDark ? "Mode Clair" : "Mode Sombre"}
        </span>
      </button>
    );
  }

  if (variant === "segmented") {
    return (
      <div
        className={`inline-flex items-center p-0.5 rounded-xl border border-subtle bg-surface-secondary ${className}`}
        role="group"
        aria-label="Sélection du thème"
      >
        <button
          type="button"
          onClick={() => isDark && toggleTheme()}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            !isDark
              ? "bg-surface text-on-surface shadow-sm border border-subtle"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
          aria-pressed={!isDark}
        >
          <Icon name="light_mode" className="text-[15px] text-amber-500" />
          <span>Clair</span>
        </button>
        <button
          type="button"
          onClick={() => !isDark && toggleTheme()}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            isDark
              ? "bg-surface-elevated text-on-surface shadow-sm border border-subtle"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
          aria-pressed={isDark}
        >
          <Icon name="dark_mode" className="text-[15px] text-primary" />
          <span>Sombre</span>
        </button>
      </div>
    );
  }

  // Default: Compact Icon Button for Header
  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      className={`w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-xl border border-subtle bg-surface-secondary hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-all active:scale-95 ${className}`}
    >
      <Icon name={isDark ? "light_mode" : "dark_mode"} className="text-[20px] sm:text-[22px] text-on-surface transition-transform duration-200" />
    </button>
  );
}
