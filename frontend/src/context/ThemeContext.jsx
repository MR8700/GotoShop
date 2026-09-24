import React, { createContext, useContext, useState, useEffect } from "react";
import safeStorage from "../utils/safeStorage";

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = safeStorage.getItem("gotoshop_theme");
      if (saved === "dark" || saved === "light") {
        return saved;
      }
    } catch (e) {}
    return "light"; // Default theme is Light Mode
  });

  const applyTheme = (newTheme) => {
    if (typeof document === "undefined") return;
    const isDark = newTheme === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
    const meta = document.getElementById("theme-color-meta");
    if (meta) {
      meta.setAttribute("content", isDark ? "#09090b" : "#f8fafc");
    }
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    try {
      safeStorage.setItem("gotoshop_theme", newTheme);
    } catch (e) {}
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        isDark: theme === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
