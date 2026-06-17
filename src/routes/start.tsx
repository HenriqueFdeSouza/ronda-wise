import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sun, Moon, PlayCircle, Loader2, Calendar, ShieldCheck, ClipboardCheck, Building2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { hotelService } from "@/services/hotelService";
import { roundService } from "@/services/roundService";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Round, Shift } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/start")({
  head: () => ({ meta: [{ title: "RondaCheck — Iniciar ronda" }] }),
  component: Start,
});

function greet(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function Start() {
  const { session } = useApp();
  const navigate = useNavigate();
  const [shift, setShift] = useState<Shift>(() => {
    const h = new Date().getHours();
    return h >= 6 && h < 18 ? "diurno" : "noturno";
  });
  const [existing, setExisting] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!session) return;
    roundService.getInProgress(session.hotel_id, session.user.id).then((r) => {
      setExisting(r ?? null);
      setLoading(false);
    });
  }, [session]);

  if (!session) return <Navigate to="/" />;
  const hotel = hotelService.get(session.hotel_id)!;
  const firstName = session.user.name.split(" ")[0];

  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const begin = async () => {
    setStarting(true);
    try {
      const r = await roundService.start({
        hotel_id: session.hotel_id, user_id: session.user.id,
        userName: session.user.name, shift,
      });
      navigate({ to: "/round", search: { id: r.id } });
    } catch {
      toast.error("Não foi possível iniciar a ronda.");
    } finally { setStarting(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Premium hero */}
      <header
        className="safe-top relative overflow-hidden px-5 pt-6 pb-10 text-white"
        style={{
          background: `linear-gradient(135deg, ${hotel.primaryColor} 0%, ${hotel.primaryColor}e6 55%, #0fb5c4 140%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-white/5 blur-2xl" />

        <div className="mx-auto flex max-w-md items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">RondaCheck</div>
            <h1 className="mt-1 truncate text-2xl font-black tracking-tight">{greet(now)}, {firstName}</h1>
            <p className="mt-1 text-sm text-white/85 capitalize">{dateStr}</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="mx-auto mt-6 flex max-w-md items-center gap-3 rounded-2xl bg-white/12 p-3 backdrop-blur-sm ring-1 ring-white/15">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 text-base font-black">
            {hotel.logoText}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/75">
              <Building2 className="h-3 w-3" /> Hotel atual
            </div>
            <div className="truncate text-sm font-semibold">{hotel.name}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/75">Hora</div>
            <div className="font-mono text-sm font-semibold tabular-nums">{timeStr}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-md space-y-4 px-4">
        {loading ? (
          <div className="h-44 animate-pulse rounded-3xl bg-muted" />
        ) : existing ? (
          <div className="rounded-3xl border bg-card p-5 shadow-card">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-warning-foreground">
              <ClipboardCheck className="h-3 w-3" /> Ronda em andamento
            </div>
            <h2 className="mt-3 text-lg font-bold">Ronda Nº {existing.number}/{existing.year}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Iniciada em {new Date(existing.startedAt).toLocaleString("pt-BR")} — turno {existing.shift}.
            </p>
            <button
              onClick={() => navigate({ to: "/round", search: { id: existing.id } })}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-soft transition active:scale-[0.99]"
            >
              Continuar de onde parei
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight">Nova ronda</h2>
                  <p className="text-xs text-muted-foreground">Confirme o turno antes de iniciar.</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {(["diurno", "noturno"] as const).map((s) => {
                  const Icon = s === "diurno" ? Sun : Moon;
                  const active = shift === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setShift(s)}
                      className={`group relative flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 text-sm font-semibold transition ${
                        active
                          ? "border-primary bg-primary/8 text-primary shadow-soft"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                      {s === "diurno" ? "Diurno" : "Noturno"}
                      <span className="text-[10px] font-normal opacity-70">
                        {s === "diurno" ? "06h — 18h" : "18h — 06h"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={begin} disabled={starting}
                className="group relative mt-5 inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-bold text-white shadow-card transition active:scale-[0.99] disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${hotel.primaryColor}, #0fb5c4)` }}
              >
                {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-6 w-6" />}
                Iniciar Ronda
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Turno
                </div>
                <div className="mt-1 text-sm font-bold capitalize">{shift}</div>
              </div>
              <div className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> Rondante
                </div>
                <div className="mt-1 truncate text-sm font-bold">{firstName}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">
              Suas respostas são salvas automaticamente. Se perder a conexão ou fechar o app, você pode continuar de onde parou.
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
