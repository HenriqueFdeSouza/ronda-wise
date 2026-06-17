import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { roundService } from "@/services/roundService";
import { pdfService } from "@/services/pdfService";
import type { Round } from "@/lib/types";
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
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    (async () => {
      const r = await roundService.get(id);
      if (!active) return;
      if (!r) { setGenerating(false); return; }
      setRound(r);
      try {
        const blob = await pdfService.downloadBlob(r);
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      } catch (e) {
        console.error(e);
        toast.error("Falha ao gerar PDF");
      } finally {
        if (active) setGenerating(false);
      }
    })();
    return () => { active = false; if (createdUrl) URL.revokeObjectURL(createdUrl); };
  }, [id]);

  if (!session) return <Navigate to="/" />;

  const download = () => {
    if (!url || !round) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `ronda-${round.number}-${round.year}.pdf`;
    a.click();
  };

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

      <div className="flex-1">
        {generating || !url ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Gerando PDF…</p>
            </div>
          </div>
        ) : (
          <iframe src={url} className="h-[calc(100vh-64px)] w-full" title="PDF" />
        )}
      </div>
    </div>
  );
}
