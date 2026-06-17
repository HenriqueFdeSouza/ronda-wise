import { USERS } from "@/data/seed";
import type { UserProfile } from "@/lib/types";

const SESSION_KEY = "rondacheck.session";

export interface Session {
  user: UserProfile;
  hotel_id: string;
}

export const authService = {
  async login(email: string, password: string, hotelId: string): Promise<Session> {
    const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) throw new Error("E-mail ou senha inválidos.");
    if (user.hotel_id !== hotelId) throw new Error("Este usuário não possui acesso a este hotel.");
    const session: Session = { user, hotel_id: hotelId };
    if (typeof window !== "undefined") {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return session;
  },

  getSession(): Session | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as Session; } catch { return null; }
  },

  logout() {
    if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
  },
};
