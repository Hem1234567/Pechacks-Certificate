import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { CSSProperties } from "react";

interface ThemeToggleProps {
  /** visual variant — "icon" shows only the icon, "pill" shows icon+label */
  variant?: "icon" | "pill";
  className?: string;
  style?: CSSProperties;
}

export function ThemeToggle({ variant = "icon", className = "", style }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      id="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={style}
      className={`
        inline-flex items-center gap-2 rounded-xl border
        px-2.5 py-2 text-sm font-medium
        transition-all duration-200
        border-border bg-card text-foreground
        hover:bg-accent hover:border-ring
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${className}
      `}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-yellow-400 transition-transform duration-300" />
      ) : (
        <Moon className="h-4 w-4 text-slate-600 transition-transform duration-300" />
      )}
      {variant === "pill" && (
        <span className="text-foreground">{isDark ? "Light" : "Dark"}</span>
      )}
    </button>
  );
}
