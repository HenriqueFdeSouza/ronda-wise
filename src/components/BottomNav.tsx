import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, History, LogOut } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "@tanstack/react-router";

export function BottomNav() {
  const { session, logout } = useApp();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!session) return null;

  const items = [
    { to: "/start", label: "Ronda", icon: ClipboardList },
    { to: "/history", label: "Histórico", icon: History },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur safe-bottom">
      <ul className="mx-auto flex max-w-md items-stretch">
        {items.map((it) => {
          const Icon = it.icon;
          const active = path.startsWith(it.to);
          return (
            <li key={it.to} className="flex-1">
              <Link
                to={it.to}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="h-6 w-6" />
                {it.label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            onClick={() => { logout(); navigate({ to: "/" }); }}
            className="flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
          >
            <LogOut className="h-6 w-6" />
            Sair
          </button>
        </li>
      </ul>
    </nav>
  );
}
