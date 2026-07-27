import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("pec-theme") as Theme | null;
  // Only respect stored preference — default to light if nothing stored
  if (stored === "dark") return "dark";
  return "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("pec-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }

  function setTheme(t: Theme) {
    setThemeState(t);
  }

  return { theme, toggleTheme, setTheme, isDark: theme === "dark" };
}
