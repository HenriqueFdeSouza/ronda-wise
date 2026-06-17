import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CheckCircle2, FileText, History as HistoryIcon, PartyPopper } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { roundService } from "@/services/roundService";
import { hotelService } from "@/services/hotelService";
import type { Round } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";

const search = z.object({ id: z.string() });

export const Route = createFileRoute("/finished")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "RondaCheck — Ronda finalizada" }] }),
  component: Finished,
});

function Finished() {
  const { id } = Route.useSearch();
  const { session } = useApp();
  const [round, setRound] = useState<Round | null>(null);

  useEffect(() => { roundService.get(id).then((r) => setRound(r ?? null)); }, [id]);
  if (!session) return <Navigate to="/" />;
  if (!round) return <div className="p-6"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
  const hotel = hotelService.get(round.hotel_id)!;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="safe-top px-4 pt-8 pb-12 text-center text-white" style={{ background: hotel.primaryColor }}>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/20 backdrop-blur">
          <PartyPopper className="h-10 w-10" />
        </div>
        <h1 className="mt-4 text-2xl font-black">Ronda finalizada!</h1>
        <p className="mt-1 text-sm opacity-90">Ronda Nº {round.number}/{round.year} · {hotel.shortName}</p>
      </header>

      <main className="mx-auto -mt-8 max-w-md space-y-4 px-4">
        <div className="rounded-2xl border bg-card p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Nota final</div>
              <div className="mt-1 text-4xl font-black" style={{ color: hotel.primaryColor }}>{round.score}%</div>
            </div>
            <CheckCircle2 className="h-12 w-12 text-success" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Turno</div><div className="font-semibold">{round.shift}</div></div>
            <div><div className="text-xs text-muted-foreground">Responsável</div><div className="font-semibold">{round.userName}</div></div>
            <div><div className="text-xs text-muted-foreground">Início</div><div className="font-semibold">{new Date(round.startedAt).toLocaleString("pt-BR")}</div></div>
            <div><div className="text-xs text-muted-foreground">Término</div><div className="font-semibold">{round.finishedAt ? new Date(round.finishedAt).toLocaleString("pt-BR") : "-"}</div></div>
          </div>
        </div>

        <Link to="/pdf" search={{ id: round.id }} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-md" style={{ background: hotel.primaryColor }}>
          <FileText className="h-5 w-5" /> Visualizar PDF
        </Link>
        <Link to="/history" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border bg-card font-semibold">
          <HistoryIcon className="h-5 w-5" /> Ver histórico
        </Link>
      </main>

      <BottomNav />
    </div>
  );
}
