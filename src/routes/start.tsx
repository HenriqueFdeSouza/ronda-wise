import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sun, Moon, PlayCircle, Loader2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { hotelService } from "@/services/hotelService";
import { roundService } from "@/services/roundService";
import { HotelHeader } from "@/components/HotelHeader";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Round, Shift } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/start")({
  head: () => ({ meta: [{ title: "RondaCheck — Iniciar ronda" }] }),
  component: Start,
});

function Start() {
  const { session } = useApp();
  const navigate = useNavigate();
  const [shift, setShift] = useState<Shift>(() => (new Date().getHours() < 18 && new Date().getHours() >= 6 ? "diurno" : "noturno"));
  const [existing, setExisting] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!session) return;
    roundService.getInProgress(session.hotel_id, session.user.id).then((r) => {
      setExisting(r ?? null);
      setLoading(false);
    });
  }, [session]);

  if (!session) return <Navigate to="/" />;
  const hotel = hotelService.get(session.hotel_id)!;

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
    <div className="min-h-screen bg-background pb-24">
      <HotelHeader hotel={hotel} subtitle={`Rondante: ${session.user.name}`} right={<ThemeToggle />} />

      <main className="mx-auto max-w-md space-y-5 px-4 pt-6">
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        ) : existing ? (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase text-warning">Ronda em andamento</div>
            <h2 className="mt-1 text-lg font-bold">Ronda Nº {existing.number}/{existing.year}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Iniciada em {new Date(existing.startedAt).toLocaleString("pt-BR")} — turno {existing.shift}.
            </p>
            <button
              onClick={() => navigate({ to: "/round", search: { id: existing.id } })}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground"
            >
              Continuar de onde parei
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-lg font-bold">Nova ronda</h2>
              <p className="mt-1 text-sm text-muted-foreground">Confirme o turno antes de iniciar.</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["diurno", "noturno"] as const).map((s) => {
                  const Icon = s === "diurno" ? Sun : Moon;
                  const active = shift === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setShift(s)}
                      className={`flex h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-semibold transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}
                    >
                      <Icon className="h-6 w-6" />
                      {s === "diurno" ? "Diurno" : "Noturno"}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={begin} disabled={starting}
                className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-md transition active:scale-[0.99] disabled:opacity-60"
                style={{ background: hotel.primaryColor }}
              >
                {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-6 w-6" />}
                Iniciar Ronda
              </button>
            </div>

            <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              Suas respostas serão salvas automaticamente. Se perder a conexão ou fechar o app,
              você poderá continuar de onde parou.
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
