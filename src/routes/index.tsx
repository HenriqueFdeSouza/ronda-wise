import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock, MapPin, ChevronRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { hotelService } from "@/services/hotelService";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RondaCheck — Selecione o hotel" },
      { name: "description", content: "Selecione o hotel para iniciar a ronda de segurança." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { setSelectedHotelId } = useApp();
  const hotels = hotelService.list();

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top mx-auto flex max-w-md items-center justify-between px-4 pt-6 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">RondaCheck</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Selecione o hotel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Escolha em qual propriedade deseja entrar.</p>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-md space-y-3 px-4 pb-12">
        {hotels.map((h) => {
          const disabled = h.status === "coming_soon";
          return (
            <button
              key={h.id}
              disabled={disabled}
              onClick={() => {
                setSelectedHotelId(h.id);
                navigate({ to: "/login" });
              }}
              className={`group flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.99] ${disabled ? "opacity-60" : "hover:border-primary/40"}`}
            >
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-black text-white"
                style={{ background: h.primaryColor }}
              >
                {h.logoText}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-bold">{h.name}</h2>
                  {disabled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      <Lock className="h-3 w-3" /> Em breve
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Beach Park · Aquiraz, CE
                </p>
              </div>
              {!disabled && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />}
            </button>
          );
        })}
      </main>
    </div>
  );
}
