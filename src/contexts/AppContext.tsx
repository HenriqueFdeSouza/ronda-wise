import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authService, type Session } from "@/services/authService";
import { hotelService } from "@/services/hotelService";
import type { Hotel } from "@/lib/types";

interface AppCtx {
  session: Session | null;
  selectedHotel: Hotel | null;
  setSelectedHotelId: (id: string | null) => void;
  setSession: (s: Session | null) => void;
  logout: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

const HOTEL_KEY = "rondacheck.hotelId";
const THEME_KEY = "rondacheck.theme";

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [selectedHotelId, setSelectedHotelIdState] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setSessionState(authService.getSession());
    const hid = localStorage.getItem(HOTEL_KEY);
    setSelectedHotelIdState(hid);
    const th = (localStorage.getItem(THEME_KEY) as "light" | "dark" | null) || "light";
    setTheme(th);
    if (th === "dark") document.documentElement.classList.add("dark");
  }, []);

  const selectedHotel = selectedHotelId ? hotelService.get(selectedHotelId) ?? null : null;

  const value: AppCtx = {
    session,
    selectedHotel,
    setSelectedHotelId: (id) => {
      if (id) localStorage.setItem(HOTEL_KEY, id);
      else localStorage.removeItem(HOTEL_KEY);
      setSelectedHotelIdState(id);
    },
    setSession: (s) => setSessionState(s),
    logout: () => {
      authService.logout();
      setSessionState(null);
    },
    theme,
    toggleTheme: () => {
      const next = theme === "light" ? "dark" : "light";
      setTheme(next);
      localStorage.setItem(THEME_KEY, next);
      document.documentElement.classList.toggle("dark", next === "dark");
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
