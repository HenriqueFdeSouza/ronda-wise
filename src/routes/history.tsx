import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { roundService } from "@/services/roundService";
import { hotelService } from "@/services/hotelService";
import { HotelHeader } from "@/components/HotelHeader";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Round } from "@/lib/types";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "RondaCheck — Histórico" }] }),
  component: History,
});

function History() {
  const { session } = useApp();
  const [rounds, setRounds] = useState<Round[] | null>(null);

  useEffect(() => {
    if (!session) return;
    roundService.listForUser(session.hotel_id, session.user.id).then(setRounds);
  }, [session]);

  if (!session) return <Navigate to="/" />;
  const hotel = hotelService.get(session.hotel_id)!;

  return (
    <div className="min-h-screen bg-background pb-24">
      <HotelHeader hotel={hotel} subtitle="Minhas rondas" right={<ThemeToggle />} />

      <main className="mx-auto max-w-md space-y-3 px-4 pt-5">
        {rounds === null ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : rounds.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Você ainda não tem rondas registradas.</p>
            <Link to="/start" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground">Iniciar primeira ronda</Link>
          </div>
        ) : rounds.map((r) => {
          const finalizada = r.status === "finalizado";
          return (
            <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {finalizada ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-warning" />}
                    <span className="text-sm font-bold">Ronda Nº {r.number}/{r.year}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(r.startedAt).toLocaleString("pt-BR")} · {r.shift}
                  </div>
                </div>
                {finalizada && <div className="shrink-0 text-right text-lg font-black" style={{ color: hotel.primaryColor }}>{r.score}%</div>}
              </div>

              <div className="mt-3 flex gap-2">
                {finalizada ? (
                  <Link to="/pdf" search={{ id: r.id }} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border bg-background text-sm font-semibold">
                    <FileText className="h-4 w-4" /> Ver PDF
                  </Link>
                ) : (
                  <Link to="/round" search={{ id: r.id }} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white" style={{ background: hotel.primaryColor }}>
                    Continuar ronda <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <BottomNav />
    </div>
  );
}
