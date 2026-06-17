import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, Camera, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { z } from "zod";
import { useApp } from "@/contexts/AppContext";
import { roundService } from "@/services/roundService";
import { checklistService } from "@/services/checklistService";
import { photoService } from "@/services/photoService";
import { hotelService } from "@/services/hotelService";
import type { ChecklistAnswer, ChecklistItem, ConformidadeAnswer, Round, StoredPhoto } from "@/lib/types";
import { toast } from "sonner";

const search = z.object({ id: z.string() });

export const Route = createFileRoute("/round")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "RondaCheck — Checklist" }] }),
  component: RoundPage,
});

type SaveState = "idle" | "saving" | "saved";

function RoundPage() {
  const { id } = Route.useSearch();
  const { session } = useApp();
  const navigate = useNavigate();
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [save, setSave] = useState<SaveState>("idle");
  const [photosByItem, setPhotosByItem] = useState<Record<string, StoredPhoto[]>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    roundService.get(id).then(async (r) => {
      if (!r) { setLoading(false); return; }
      setRound(r);
      const photos = await photoService.listForRound(r.id);
      const grouped: Record<string, StoredPhoto[]> = {};
      photos.forEach((p) => { (grouped[p.item_id] ||= []).push(p); });
      setPhotosByItem(grouped);
      setLoading(false);
    });
  }, [id]);

  if (!session) return <Navigate to="/" />;
  if (loading) return <div className="min-h-screen bg-background p-6"><div className="mx-auto h-40 max-w-md animate-pulse rounded-2xl bg-muted" /></div>;
  if (!round) return <Navigate to="/start" />;
  if (round.status === "finalizado") return <Navigate to="/finished" search={{ id: round.id }} />;

  const hotel = hotelService.get(round.hotel_id)!;
  const items = checklistService.forHotel(round.hotel_id);
  const sections = checklistService.sectionsForHotel(round.hotel_id);
  const isReview = sectionIdx >= sections.length;

  const totalItems = items.length;
  const answeredCount = items.filter((i) => {
    const a = round.answers[i.id];
    if (!a) return false;
    if (i.type === "conformidade") return !!a.conformity;
    if (i.type === "numero") return a.numberValue != null && !Number.isNaN(a.numberValue);
    return !!a.textValue?.trim();
  }).length;
  const progress = Math.round((answeredCount / Math.max(totalItems, 1)) * 100);

  const scheduleSave = (next: Round) => {
    setRound(next);
    setSave("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await roundService.save(next);
      setSave("saved");
      setTimeout(() => setSave("idle"), 1200);
    }, 600);
  };

  const setAnswer = (itemId: string, patch: Partial<ChecklistAnswer>) => {
    const current = round.answers[itemId] || { itemId };
    const next: Round = { ...round, answers: { ...round.answers, [itemId]: { ...current, ...patch, itemId } } };
    scheduleSave(next);
  };

  const onAddPhoto = async (item: ChecklistItem, file: File) => {
    try {
      const photo = await photoService.addFromFile(round.id, item.id, file);
      setPhotosByItem((m) => ({ ...m, [item.id]: [...(m[item.id] || []), photo] }));
      const existingIds = round.answers[item.id]?.photoIds || [];
      setAnswer(item.id, { photoIds: [...existingIds, photo.id] });
      toast.success("Foto adicionada");
    } catch {
      toast.error("Falha ao adicionar foto");
    }
  };

  const removePhoto = async (item: ChecklistItem, photoId: string) => {
    await photoService.remove(photoId);
    setPhotosByItem((m) => ({ ...m, [item.id]: (m[item.id] || []).filter((p) => p.id !== photoId) }));
    const ids = (round.answers[item.id]?.photoIds || []).filter((p) => p !== photoId);
    setAnswer(item.id, { photoIds: ids });
  };

  const goNext = () => {
    if (sectionIdx < sections.length) setSectionIdx(sectionIdx + 1);
    if (sectionIdx + 1 >= sections.length) navigate({ to: "/review", search: { id: round.id } });
    window.scrollTo({ top: 0 });
  };
  const goPrev = () => {
    if (sectionIdx > 0) { setSectionIdx(sectionIdx - 1); window.scrollTo({ top: 0 }); }
  };

  if (isReview) { navigate({ to: "/review", search: { id: round.id } }); return null; }

  const section = sections[sectionIdx];
  const sectionItems = items.filter((i) => i.section === section);

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="safe-top sticky top-0 z-30 border-b bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold uppercase text-muted-foreground">Ronda Nº {round.number}/{round.year} · {hotel.shortName}</div>
              <h1 className="truncate text-base font-bold">{section}</h1>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-bold" style={{ color: hotel.primaryColor }}>{progress}%</div>
              <div className="text-[10px] text-muted-foreground">{answeredCount}/{totalItems}</div>
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full transition-all" style={{ width: `${progress}%`, background: hotel.primaryColor }} />
          </div>
          <div className="mt-1 flex justify-end">
            <SaveIndicator state={save} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {sectionItems.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            answer={round.answers[item.id]}
            photos={photosByItem[item.id] || []}
            onAnswer={(p) => setAnswer(item.id, p)}
            onAddPhoto={(f) => onAddPhoto(item, f)}
            onRemovePhoto={(pid) => removePhoto(item, pid)}
            primary={hotel.primaryColor}
          />
        ))}

        <div className="mt-6 flex gap-3">
          <button
            onClick={goPrev} disabled={sectionIdx === 0}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border bg-card font-semibold disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" /> Voltar
          </button>
          <button
            onClick={goNext}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-base font-semibold text-white shadow-md active:scale-[0.99]"
            style={{ background: hotel.primaryColor }}
          >
            {sectionIdx + 1 >= sections.length ? "Revisar" : "Próxima"} <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-2 flex justify-center gap-1.5">
          {sections.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === sectionIdx ? "w-6" : "w-1.5"}`} style={{ background: i <= sectionIdx ? hotel.primaryColor : "var(--color-muted)" }} />
          ))}
        </div>
      </main>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1 text-[11px] text-success animate-pop"><CheckCircle2 className="h-3 w-3" /> Salvo</span>;
  return <span className="text-[11px] text-transparent">.</span>;
}

function ItemCard({ item, answer, photos, onAnswer, onAddPhoto, onRemovePhoto, primary }: {
  item: ChecklistItem;
  answer?: ChecklistAnswer;
  photos: StoredPhoto[];
  onAnswer: (p: Partial<ChecklistAnswer>) => void;
  onAddPhoto: (f: File) => void;
  onRemovePhoto: (id: string) => void;
  primary: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isNonConform = answer?.conformity === "nao_conforme";

  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-bold leading-snug">{item.label}</h3>

      {item.type === "conformidade" && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <ConfButton active={answer?.conformity === "conforme"} variant="ok" onClick={() => onAnswer({ conformity: "conforme" })} label="Conforme" icon={CheckCircle2} />
          <ConfButton active={answer?.conformity === "nao_conforme"} variant="bad" onClick={() => onAnswer({ conformity: "nao_conforme" })} label="Não Conf." icon={XCircle} />
          <ConfButton active={answer?.conformity === "nao_realizado"} variant="neutral" onClick={() => onAnswer({ conformity: "nao_realizado" })} label="Não Realiz." icon={MinusCircle} />
        </div>
      )}

      {item.type === "numero" && (
        <input
          type="number" inputMode="numeric"
          value={answer?.numberValue ?? ""}
          onChange={(e) => onAnswer({ numberValue: e.target.value === "" ? null : Number(e.target.value) })}
          className="mt-3 h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:border-primary"
          placeholder="Digite o número"
        />
      )}

      {item.type === "texto" && (
        <textarea
          value={answer?.textValue ?? ""}
          onChange={(e) => onAnswer({ textValue: e.target.value })}
          className="mt-3 min-h-[80px] w-full rounded-xl border bg-background p-3 text-base outline-none focus:border-primary"
          placeholder="Digite sua resposta"
        />
      )}

      {item.type === "conformidade" && isNonConform && (
        <div className="mt-3 space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <textarea
            value={answer?.observation ?? ""}
            onChange={(e) => onAnswer({ observation: e.target.value })}
            placeholder="Observação obrigatória sobre a não conformidade"
            className="min-h-[70px] w-full rounded-lg border bg-background p-3 text-sm outline-none focus:border-destructive"
            required
          />

          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddPhoto(f); e.target.value = ""; }}
          />
          <button
            type="button" onClick={() => fileRef.current?.click()}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold"
            style={{ borderColor: primary, color: primary }}
          >
            <Camera className="h-5 w-5" /> Adicionar foto
          </button>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg border">
                  <img src={p.dataUrl} alt="anexo" className="h-full w-full object-cover" />
                  <button
                    onClick={() => onRemovePhoto(p.id)}
                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
                    aria-label="Remover foto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {item.requiresPhotoIfNonConform && photos.length === 0 && (
            <p className="text-xs font-medium text-destructive">⚠ Este item exige ao menos uma foto.</p>
          )}
        </div>
      )}
    </article>
  );
}

function ConfButton({ active, onClick, label, icon: Icon, variant }: {
  active: boolean; onClick: () => void; label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "ok" | "bad" | "neutral";
}) {
  const colors = variant === "ok"
    ? { base: "border-success/40 text-success", active: "bg-success text-white border-success" }
    : variant === "bad"
    ? { base: "border-destructive/40 text-destructive", active: "bg-destructive text-white border-destructive" }
    : { base: "border-muted-foreground/30 text-muted-foreground", active: "bg-muted-foreground text-white border-muted-foreground" };
  return (
    <button
      type="button" onClick={onClick}
      className={`flex h-16 min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-bold transition active:scale-[0.97] ${active ? colors.active : `bg-background ${colors.base}`}`}
    >
      <Icon className={`h-5 w-5 ${active ? "animate-pop" : ""}`} />
      {label}
    </button>
  );
}


