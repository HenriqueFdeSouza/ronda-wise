import { Moon, Sun } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useApp();
  return (
    <button
      onClick={toggleTheme}
      aria-label="Alternar tema"
      className={`grid h-11 w-11 place-items-center rounded-full border bg-card text-foreground shadow-sm ${className}`}
    >
      {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
}
