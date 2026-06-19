import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { z } from "zod";
import { ArrowLeft, Download, Loader2, AlertTriangle, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { roundService } from "@/services/roundService";
import { pdfService } from "@/services/pdfService";
import { checklistService } from "@/services/checklistService";
import { hotelService } from "@/services/hotelService";
import { photoService } from "@/services/photoService";
import { calculateRoundScore } from "@/services/scoreService";
import type { ChecklistItem, Round, StoredPhoto } from "@/lib/types";
import { toast } from "sonner";

const search = z.object({ id: z.string() });

export const Route = createFileRoute("/pdf")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "RondaCheck — PDF" }] }),
  component: PdfPage,
});

function PdfPage() {
  const { id } = Route.useSearch();
  const { session } = useApp();
  const navigate = useNavigate();
  const [round, setRound] = useState<Round | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [photosByItem, setPhotosByItem] = useState<Record<string, StoredPhoto[]>>({});
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    (async () => {
      const r = await roundService.get(id);
      if (!active) return;

      if (!r) {
        setGenerating(false);
        return;
      }

      setRound(r);

      try {
        const [blob, photos] = await Promise.all([
          pdfService.downloadBlob(r),
          photoService.listForRound(r.id),
        ]);

        if (!active) return;

        const grouped: Record<string, StoredPhoto[]> = {};
        photos.forEach((p) => { (grouped[p.item_id] ||= []).push(p); });
        setPhotosByItem(grouped);

        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      } catch (e) {
        console.error(e);
        toast.error("Falha ao gerar PDF");
      } finally {
        if (active) setGenerating(false);
      }
    })();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [id]);

  if (!session) return <Navigate to="/" />;

  const download = () => {
    if (!url || !round) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `ronda-${round.number}-${round.year}.pdf`;
    a.click();
  };

  const openPdf = () => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const hotel = round ? hotelService.get(round.hotel_id) : null;
  const items = round ? checklistService.forHotel(round.hotel_id) : [];
  const sections = round ? checklistService.sectionsForHotel(round.hotel_id) : [];
  const score = round ? calculateRoundScore(items, round.answers) : 0;

  const conformes = items.filter((item) => round?.answers[item.id]?.conformity === "conforme").length;
  const naoConformes = items.filter((item) => round?.answers[item.id]?.conformity === "nao_conforme").length;
  const naoRealizados = items.filter((item) => round?.answers[item.id]?.conformity === "nao_realizado").length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="safe-top sticky top-0 z-30 flex items-center gap-2 border-b bg-card px-3 py-2">
        <button onClick={() => navigate({ to: "/history" })} className="grid h-11 w-11 place-items-center rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">PDF da ronda</div>
          <div className="truncate text-sm font-bold">{round ? `Nº ${round.number}/${round.year}` : "Carregando…"}</div>
        </div>

        <button onClick={download} disabled={!url}
          className="inline-flex h-11 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          <Download className="h-4 w-4" /> Baixar
        </button>
      </header>

      {generating || !round || !hotel ? (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Gerando relatório…</p>
          </div>
        </div>
      ) : (
        <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-4">
          <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="p-5 text-white" style={{ background: `linear-gradient(135deg, ${hotel.primaryColor}, #12b8b0)` }}>
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl font-black ring-1 ring-white/25">
                  {hotel.shortName?.[0] || "R"}
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.16em] opacity-90">RondaCheck</div>
                  <h1 className="truncate text-xl font-black">{hotel.name}</h1>
                  <p className="text-xs opacity-90">Relatório completo da ronda</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              <Info label="Rondante" value={round.userName} />
              <Info label="Turno" value={round.shift === "diurno" ? "Diurno" : "Noturno"} />
              <Info label="Início" value={formatDate(round.startedAt)} />
              <Info label="Término" value={formatDate(round.finishedAt || round.startedAt)} />
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-4 shadow-sm">
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Resumo executivo</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <div className="text-xs font-black uppercase text-amber-700">Nota final</div>
                <div className="mt-1 text-5xl font-black text-amber-700">{score}%</div>
              </div>
              <div className="grid gap-2">
                <Metric value={items.length} label="Avaliados" />
                <Metric value={conformes} label="Conformes" icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
                <Metric value={naoConformes} label="Não conformes" icon={<XCircle className="h-4 w-4 text-destructive" />} />
                <Metric value={naoRealizados} label="Não realizados" icon={<MinusCircle className="h-4 w-4 text-muted-foreground" />} />
              </div>
            </div>
          </section>

          {sections.map((section) => (
            <section key={section} className="overflow-hidden rounded-3xl border bg-card shadow-sm">
              <div className="px-4 py-3 text-sm font-black uppercase tracking-wide text-white" style={{ background: hotel.primaryColor }}>
                {section}
              </div>

              <div className="divide-y">
                {items.filter((item) => item.section === section).map((item) => (
                  <PreviewItem
                    key={item.id}
                    item={item}
                    round={round}
                    photos={photosByItem[item.id] || []}
                  />
                ))}
              </div>
            </section>
          ))}

          {round.generalObservation && (
            <section className="rounded-3xl border bg-card p-4 shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-muted-foreground">Observações gerais</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{round.generalObservation}</p>
            </section>
          )}

          {round.signatureDataUrl && (
            <section className="rounded-3xl border bg-card p-4 text-center shadow-sm">
              <div className="text-xs font-black uppercase tracking-wide text-muted-foreground">Assinatura do rondante</div>
              <img src={round.signatureDataUrl} alt="Assinatura" className="mx-auto mt-3 h-24 max-w-full object-contain" />
              <div className="mt-2 text-sm font-bold">{round.userName}</div>
            </section>
          )}

          <button
            onClick={openPdf}
            disabled={!url}
            className="w-full rounded-2xl border bg-card px-4 py-3 text-sm font-bold shadow-sm disabled:opacity-50"
          >
            Abrir PDF original em nova aba
          </button>
        </main>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-bold">{value || "—"}</div>
    </div>
  );
}

function Metric({ value, label, icon }: { value: number; label: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border bg-background px-3 py-2">
      <div>
        <div className="text-lg font-black leading-none">{value}</div>
        <div className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      </div>
      {icon}
    </div>
  );
}

function PreviewItem({ item, round, photos }: { item: ChecklistItem; round: Round; photos: StoredPhoto[] }) {
  const answer = round.answers[item.id];
  const isBad = answer?.conformity === "nao_conforme";

  return (
    <div className={isBad ? "bg-destructive/5 p-4" : "p-4"}>
      <div className="flex items-start gap-2">
        <StatusIcon item={item} round={round} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black leading-snug">{item.label}</div>
          <div className="mt-1 text-sm">
            <span className="text-muted-foreground">Resposta: </span>
            <span className="font-semibold">{answerText(item, round)}</span>
          </div>

          {answer?.observation && (
            <div className="mt-2 rounded-2xl border border-destructive/25 bg-white p-3 text-sm">
              <div className="mb-1 flex items-center gap-1 text-xs font-black uppercase text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Observação
              </div>
              {answer.observation}
            </div>
          )}

          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {photos.map((photo, index) => (
                <figure key={photo.id} className="overflow-hidden rounded-2xl border bg-background">
                  <img src={photo.dataUrl} alt={`Foto ${index + 1}`} className="h-32 w-full object-cover" />
                  <figcaption className="px-2 py-1 text-center text-[10px] text-muted-foreground">Foto {index + 1}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ item, round }: { item: ChecklistItem; round: Round }) {
  const answer = round.answers[item.id];

  if (item.type !== "conformidade") return <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-muted" />;

  if (answer?.conformity === "conforme") return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />;
  if (answer?.conformity === "nao_conforme") return <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />;
  if (answer?.conformity === "nao_realizado") return <MinusCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />;

  return <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-muted" />;
}

function answerText(item: ChecklistItem, round: Round) {
  const answer = round.answers[item.id];

  if (!answer) return "Sem resposta";

  if (item.type === "conformidade") {
    if (answer.conformity === "conforme") return "Conforme";
    if (answer.conformity === "nao_conforme") return "Não conforme";
    if (answer.conformity === "nao_realizado") return "Não realizado";
    return "Sem resposta";
  }

  if (item.type === "numero") return answer.numberValue != null ? String(answer.numberValue) : "Sem resposta";
  return answer.textValue || "Sem resposta";
}

function formatDate(value?: string | number | Date) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
