import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { z } from "zod";
import { CheckCircle2, RotateCcw, Loader2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { roundService } from "@/services/roundService";
import { checklistService } from "@/services/checklistService";
import { hotelService } from "@/services/hotelService";
import { calculateRoundScore } from "@/services/scoreService";
import type { Round } from "@/lib/types";
import { toast } from "sonner";

const search = z.object({ id: z.string() });

export const Route = createFileRoute("/review")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "RondaCheck — Revisão" }] }),
  component: Review,
});

function Review() {
  const { id } = Route.useSearch();
  const { session } = useApp();
  const navigate = useNavigate();
  const [round, setRound] = useState<Round | null>(null);
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [hasSig, setHasSig] = useState(false);

  useEffect(() => {
    roundService.get(id).then((r) => {
      if (r) { setRound(r); setObs(r.generalObservation || ""); }
    });
  }, [id]);

  if (!session) return <Navigate to="/" />;
  if (!round) return <div className="min-h-screen p-6"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
  if (round.status === "finalizado") return <Navigate to="/finished" search={{ id: round.id }} />;

  const hotel = hotelService.get(round.hotel_id)!;
  const items = checklistService.forHotel(round.hotel_id);
  const sections = checklistService.sectionsForHotel(round.hotel_id);

  // realtime score (recomputed on each render — items/answers are not huge)
  const score = useMemo(() => calculateRoundScore(items, round.answers), [items, round.answers]);

  const finish = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Assine antes de finalizar."); return;
    }
    const sig = sigRef.current.getCanvas().toDataURL("image/png");
    setSubmitting(true);
    try {
      const final = await roundService.finish(round, { generalObservation: obs, signatureDataUrl: sig, score });
      toast.success("Ronda finalizada!");
      navigate({ to: "/finished", search: { id: final.id } });
    } catch {
      toast.error("Erro ao finalizar a ronda.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="safe-top px-4 pt-5 pb-4 text-white" style={{ background: hotel.primaryColor }}>
        <div className="mx-auto max-w-md">
          <div className="text-xs uppercase tracking-wider opacity-90">Revisão final</div>
          <h1 className="text-xl font-bold">Ronda Nº {round.number}/{round.year}</h1>
          <p className="text-sm opacity-90">{hotel.name}</p>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-md space-y-4 px-4">
        <div className="rounded-2xl border bg-card p-5 shadow-md">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Nota final</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-black" style={{ color: hotel.primaryColor }}>{score}%</span>
            <span className="text-sm text-muted-foreground">de conformidade</span>
          </div>
        </div>

        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Resumo das respostas</summary>
          <div className="mt-3 space-y-3">
            {sections.map((s) => (
              <div key={s}>
                <div className="text-xs font-bold uppercase text-muted-foreground">{s}</div>
                <ul className="mt-1 space-y-1 text-sm">
                  {items.filter((i) => i.section === s).map((i) => {
                    const a = round.answers[i.id];
                    let r = "—";
                    if (a) {
                      if (i.type === "conformidade") r = a.conformity === "conforme" ? "✅ Conforme" : a.conformity === "nao_conforme" ? "❌ Não conforme" : a.conformity === "nao_realizado" ? "➖ Não realizado" : "—";
                      else if (i.type === "numero") r = a.numberValue != null ? String(a.numberValue) : "—";
                      else r = a.textValue || "—";
                    }
                    return <li key={i.id} className="flex justify-between gap-3"><span className="min-w-0 flex-1 truncate">{i.label}</span><span className="shrink-0 font-medium">{r}</span></li>;
                  })}
                </ul>
              </div>
            ))}
          </div>
        </details>

        <div className="rounded-2xl border bg-card p-4">
          <label className="text-sm font-semibold">Observações gerais do plantão</label>
          <textarea
            value={obs} onChange={(e) => setObs(e.target.value)}
            className="mt-2 min-h-[90px] w-full rounded-xl border bg-background p-3 text-base outline-none focus:border-primary"
            placeholder="Anote eventuais ocorrências relevantes do plantão"
          />
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Assinatura</div>
              <div className="text-xs text-muted-foreground">Rondante: {round.userName}</div>
            </div>
            <button
              onClick={() => { sigRef.current?.clear(); setHasSig(false); }}
              className="inline-flex h-10 items-center gap-1 rounded-lg border px-3 text-xs font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Limpar
            </button>
          </div>
          <div className="mt-2 overflow-hidden rounded-xl border bg-white">
            <SignatureCanvas
              ref={sigRef}
              penColor="#111"
              onEnd={() => setHasSig(true)}
              canvasProps={{ className: "w-full h-44 touch-none" }}
            />
          </div>
          {!hasSig && <p className="mt-1 text-xs text-muted-foreground">Assine com o dedo na área acima.</p>}
        </div>

        <button
          onClick={finish} disabled={submitting}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60"
          style={{ background: hotel.primaryColor }}
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
          Finalizar Ronda
        </button>
      </main>
    </div>
  );
}
