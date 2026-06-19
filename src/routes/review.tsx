import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, RotateCcw, Loader2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { roundService } from "@/services/roundService";
import { checklistService } from "@/services/checklistService";
import { hotelService } from "@/services/hotelService";
import { calculateRoundScore } from "@/services/scoreService";
import type { ChecklistItem, Round } from "@/lib/types";
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

  const score = calculateRoundScore(items, round.answers);

  const getItemError = (item: ChecklistItem) => {
    const answer = round.answers[item.id];

    if (!answer) return `Preencha o item: ${item.label}`;

    if (item.type === "conformidade") {
      if (!answer.conformity) return `Marque uma opção em: ${item.label}`;

      if (answer.conformity === "nao_conforme") {
        if (item.auditKind) {
          const irregularities = answer.irregularities || [];
          if (irregularities.length === 0) return `Adicione ao menos uma irregularidade em: ${item.label}`;

          for (const irregularity of irregularities) {
            if (!irregularity.floor) return `Informe o andar em: ${item.label}`;
            if (item.auditKind === "elevadores" && !irregularity.elevator) return `Informe qual elevador está com problema em: ${item.label}`;
            if (!irregularity.description?.trim()) return `Descreva a irregularidade em: ${item.label}`;
          }
          return null;
        }

        if (!answer.observation?.trim()) {
          return `Informe a observação da não conformidade: ${item.label}`;
        }
      }
    }

    if (item.type === "numero" && (answer.numberValue == null || Number.isNaN(answer.numberValue))) {
      return `Informe o número em: ${item.label}`;
    }

    if (item.type === "texto" && !answer.textValue?.trim()) {
      return `Preencha o texto em: ${item.label}`;
    }

    return null;
  };

  const firstInvalid = () => {
    for (const item of items) {
      const error = getItemError(item);
      if (error) return { item, error };
    }
    return null;
  };

  const goBackToChecklist = () => {
    const lastSection = Math.max(sections.length - 1, 0);
    navigate({ to: "/round", search: { id: round.id, section: lastSection } });
  };

  const finish = async () => {
    const invalid = firstInvalid();

    if (invalid) {
      const sectionIndex = Math.max(sections.indexOf(invalid.item.section), 0);
      toast.error(invalid.error);
      navigate({ to: "/round", search: { id: round.id, section: sectionIndex } });
      return;
    }

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
      <header className="safe-top px-4 pb-5 pt-4 text-white" style={{ background: hotel.primaryColor }}>
        <div className="mx-auto max-w-md">
          <button
            onClick={goBackToChecklist}
            className="mb-3 inline-flex h-10 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-bold backdrop-blur active:scale-[0.99]"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para corrigir
          </button>

          <div className="text-xs uppercase tracking-wider opacity-90">Revisão final</div>
          <h1 className="text-xl font-bold">Ronda Nº {round.number}/{round.year}</h1>
          <p className="text-sm opacity-90">{hotel.name}</p>
        </div>
      </header>

      <main className="mx-auto -mt-5 max-w-md space-y-4 px-4">
        <div className="rounded-3xl border bg-card p-5 shadow-md">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Nota final</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-black" style={{ color: hotel.primaryColor }}>{score}%</span>
            <span className="text-sm text-muted-foreground">de conformidade</span>
          </div>
        </div>

        <details className="rounded-3xl border bg-card p-4">
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

        <div className="rounded-3xl border bg-card p-4">
          <label className="text-sm font-semibold">Observações gerais do plantão</label>
          <textarea
            value={obs} onChange={(e) => setObs(e.target.value)}
            className="mt-2 min-h-[100px] w-full rounded-2xl border bg-background p-3 text-base outline-none focus:border-primary"
            placeholder="Anote eventuais ocorrências relevantes do plantão"
          />
        </div>

        <div className="rounded-3xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Assinatura</div>
              <div className="text-xs text-muted-foreground">Rondante: {round.userName}</div>
            </div>
            <button
              onClick={() => { sigRef.current?.clear(); setHasSig(false); }}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border px-3 text-xs font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Limpar
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border bg-white">
            <SignatureCanvas
              ref={sigRef}
              penColor="#111"
              onEnd={() => setHasSig(true)}
              canvasProps={{ className: "w-full h-48 touch-none" }}
            />
          </div>
          {!hasSig && <p className="mt-2 text-xs text-muted-foreground">Assine com o dedo na área acima.</p>}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={goBackToChecklist}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border bg-card text-base font-bold shadow-sm active:scale-[0.99]"
          >
            <ArrowLeft className="h-5 w-5" /> Voltar e corrigir respostas
          </button>

          <button
            onClick={finish} disabled={submitting}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: hotel.primaryColor }}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
            Finalizar Ronda
          </button>
        </div>
      </main>
    </div>
  );
}
