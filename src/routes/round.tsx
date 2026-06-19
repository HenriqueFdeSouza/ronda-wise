import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { CheckCircle2, XCircle, MinusCircle, Camera, ChevronLeft, ChevronRight, Loader2, Trash2, Plus, X } from "lucide-react";
import { z } from "zod";
import { useApp } from "@/contexts/AppContext";
import { roundService } from "@/services/roundService";
import { checklistService } from "@/services/checklistService";
import { photoService } from "@/services/photoService";
import { hotelService } from "@/services/hotelService";
import type { ChecklistAnswer, ChecklistItem, ChecklistIrregularity, Round, StoredPhoto } from "@/lib/types";
import { toast } from "sonner";

const search = z.object({
  id: z.string(),
  section: z.coerce.number().optional(),
});

export const Route = createFileRoute("/round")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "RondaCheck — Checklist" }] }),
  component: RoundPage,
});

type SaveState = "idle" | "saving" | "saved";

const FLOORS = ["1º andar", "2º andar", "3º andar", "4º andar", "5º andar"];
const ELEVATORS = [
  { value: "esquerdo", label: "Esquerdo" },
  { value: "direito", label: "Direito" },
  { value: "ambos", label: "Ambos" },
] as const;

function newIrregularity(): ChecklistIrregularity {
  return {
    id: `irr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    floor: "",
    description: "",
  };
}

function irregularitiesToObservation(item: ChecklistItem, irregularities: ChecklistIrregularity[]) {
  return irregularities
    .map((irr, index) => {
      const parts = [`${index + 1}.`];
      if (irr.floor) parts.push(irr.floor);
      if (item.auditKind === "elevadores" && irr.elevator) parts.push(`Elevador ${irr.elevator}`);
      if (irr.description?.trim()) parts.push(`— ${irr.description.trim()}`);
      return parts.join(" ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

function isBlockSection(section: string) {
  return /^Bloco\s\d{2}$/.test(section);
}

function RoundPage() {
  const { id, section: initialSection = 0 } = Route.useSearch();
  const { session } = useApp();
  const navigate = useNavigate();
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectionIdx, setSectionIdx] = useState(initialSection);
  const [selectedBlockSection, setSelectedBlockSection] = useState<string | null>(null);
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
  const blockSections = sections.filter(isBlockSection);
  const firstBlockIndex = sections.findIndex(isBlockSection);
  const lastBlockIndex = firstBlockIndex >= 0 ? firstBlockIndex + blockSections.length - 1 : -1;
  const currentSectionIdx = Math.min(Math.max(sectionIdx, 0), sections.length - 1);
  const section = sections[currentSectionIdx];
  const isCurrentBlock = isBlockSection(section);
  const isBlockMenu = isCurrentBlock && selectedBlockSection === null;
  const sectionTitle = isBlockMenu ? "Blocos do Hotel" : section;
  const sectionItems = isBlockMenu ? [] : items.filter((i) => i.section === section);

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

  const setConformity = (item: ChecklistItem, conformity: ChecklistAnswer["conformity"]) => {
    if (conformity === "nao_conforme" && item.auditKind) {
      const current = round.answers[item.id];
      const irregularities = current?.irregularities?.length ? current.irregularities : [newIrregularity()];
      setAnswer(item.id, {
        conformity,
        irregularities,
        observation: irregularitiesToObservation(item, irregularities),
      });
      return;
    }

    if (conformity !== "nao_conforme") {
      setAnswer(item.id, { conformity, observation: "", irregularities: [] });
      return;
    }

    setAnswer(item.id, { conformity });
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

  const getSectionItems = (sectionName: string) => items.filter((item) => item.section === sectionName);

  const isSectionComplete = (sectionName: string) => {
    const sectionChecklist = getSectionItems(sectionName);
    return sectionChecklist.length > 0 && sectionChecklist.every((item) => !getItemError(item));
  };

  const getSectionStatus = (sectionName: string) => {
    const sectionChecklist = getSectionItems(sectionName);
    if (sectionChecklist.some((item) => getItemError(item))) return "pendente" as const;
    if (sectionChecklist.some((item) => round.answers[item.id]?.conformity === "nao_conforme")) return "irregularidade" as const;
    if (sectionChecklist.every((item) => round.answers[item.id]?.conformity === "nao_realizado")) return "nao_realizado" as const;
    return "concluido" as const;
  };

  const validateCurrentSection = () => {
    const invalid = sectionItems.find((item) => getItemError(item));
    if (!invalid) return true;

    const message = getItemError(invalid) || "Preencha todos os itens da seção antes de continuar.";
    toast.error(message);
    return false;
  };

  const goNext = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (isBlockMenu) {
      const incomplete = blockSections.find((block) => !isSectionComplete(block));
      if (incomplete) {
        toast.error(`Conclua o ${incomplete} antes de continuar.`);
        return;
      }

      if (lastBlockIndex + 1 >= sections.length) {
        navigate({ to: "/review", search: { id: round.id } });
        return;
      }

      setSelectedBlockSection(null);
      setSectionIdx(lastBlockIndex + 1);
      return;
    }

    if (!validateCurrentSection()) return;

    if (isCurrentBlock && selectedBlockSection) {
      toast.success(`${section} salvo.`);
      setSelectedBlockSection(null);
      setSectionIdx(firstBlockIndex);
      return;
    }

    if (currentSectionIdx + 1 >= sections.length) {
      navigate({ to: "/review", search: { id: round.id } });
      return;
    }

    const nextIdx = currentSectionIdx + 1;
    if (isBlockSection(sections[nextIdx])) {
      setSelectedBlockSection(null);
      setSectionIdx(firstBlockIndex);
      return;
    }

    setSelectedBlockSection(null);
    setSectionIdx(nextIdx);
  };

  const goPrev = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (isCurrentBlock && selectedBlockSection) {
      setSelectedBlockSection(null);
      setSectionIdx(firstBlockIndex);
      return;
    }

    if (isBlockMenu) {
      if (firstBlockIndex > 0) {
        setSectionIdx(firstBlockIndex - 1);
        return;
      }

      navigate({ to: "/start" });
      return;
    }

    if (currentSectionIdx > 0) {
      const prevIdx = currentSectionIdx - 1;
      if (isBlockSection(sections[prevIdx])) {
        setSelectedBlockSection(null);
        setSectionIdx(firstBlockIndex);
        return;
      }

      setSelectedBlockSection(null);
      setSectionIdx(prevIdx);
      return;
    }

    navigate({ to: "/start" });
  };

  const openBlock = (blockSection: string) => {
    const idx = sections.indexOf(blockSection);
    if (idx < 0) return;
    setSelectedBlockSection(blockSection);
    setSectionIdx(idx);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="safe-top sticky top-0 z-30 border-b bg-card/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ronda Nº {round.number}/{round.year} · {hotel.shortName}
              </div>
              <h1 className="mt-1 text-[17px] font-extrabold leading-tight">{sectionTitle}</h1>
            </div>

            <div className="shrink-0 rounded-xl bg-muted px-3 py-2 text-right">
              <div className="text-sm font-black leading-none" style={{ color: hotel.primaryColor }}>{progress}%</div>
              <div className="mt-1 text-[10px] font-semibold text-muted-foreground">{answeredCount}/{totalItems}</div>
            </div>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: hotel.primaryColor }} />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              {isBlockMenu ? "Escolha um bloco para verificar" : `Seção ${currentSectionIdx + 1} de ${sections.length}`}
            </span>
            <SaveIndicator state={save} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 pt-5">
        {isBlockMenu ? (
          <BlockMenu
            blockSections={blockSections}
            items={items}
            round={round}
            getSectionStatus={getSectionStatus}
            onOpen={openBlock}
            primary={hotel.primaryColor}
          />
        ) : (
          sectionItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              answer={round.answers[item.id]}
              photos={photosByItem[item.id] || []}
              onAnswer={(p) => setAnswer(item.id, p)}
              onConformity={(c) => setConformity(item, c)}
              onAddPhoto={(f) => onAddPhoto(item, f)}
              onRemovePhoto={(pid) => removePhoto(item, pid)}
              primary={hotel.primaryColor}
            />
          ))
        )}

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            onClick={goPrev}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border bg-card text-base font-bold shadow-sm active:scale-[0.99]"
          >
            <ChevronLeft className="h-5 w-5" /> Voltar
          </button>

          <button
            onClick={goNext}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-md active:scale-[0.99]"
            style={{ background: hotel.primaryColor }}
          >
            {isBlockMenu
              ? "Continuar ronda"
              : isCurrentBlock && selectedBlockSection
                ? "Salvar bloco"
                : currentSectionIdx + 1 >= sections.length
                  ? "Revisar"
                  : "Próxima"} <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex justify-center gap-1.5">
          {sections.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === currentSectionIdx ? "w-6" : "w-1.5"}`} style={{ background: i <= currentSectionIdx ? hotel.primaryColor : "var(--color-muted)" }} />
          ))}
        </div>
      </main>
    </div>
  );
}

function BlockMenu({ blockSections, items, round, getSectionStatus, onOpen, primary }: {
  blockSections: string[];
  items: ChecklistItem[];
  round: Round;
  getSectionStatus: (sectionName: string) => "pendente" | "irregularidade" | "nao_realizado" | "concluido";
  onOpen: (sectionName: string) => void;
  primary: string;
}) {
  const statusConfig = {
    pendente: { label: "Pendente", icon: MinusCircle, className: "bg-muted text-muted-foreground" },
    irregularidade: { label: "Com irregularidade", icon: XCircle, className: "bg-destructive/10 text-destructive" },
    nao_realizado: { label: "Não verificado", icon: MinusCircle, className: "bg-muted text-muted-foreground" },
    concluido: { label: "Concluído", icon: CheckCircle2, className: "bg-success/10 text-success" },
  };

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border bg-card p-4 shadow-sm">
        <div className="text-sm font-black">Verificação dos blocos</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Toque em um bloco para verificar extintores, hidrantes, elevadores e escadas.
          Depois salve o bloco e escolha o próximo.
        </p>
      </div>

      {blockSections.map((block) => {
        const status = getSectionStatus(block);
        const config = statusConfig[status];
        const Icon = config.icon;
        const blockItems = items.filter((item) => item.section === block);
        const answered = blockItems.filter((item) => !!round.answers[item.id]?.conformity).length;

        return (
          <button
            key={block}
            type="button"
            onClick={() => onOpen(block)}
            className="flex w-full items-center gap-3 rounded-3xl border bg-card p-4 text-left shadow-sm transition active:scale-[0.99]"
          >
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-black text-white"
              style={{ background: primary }}
            >
              {block.replace("Bloco ", "")}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-base font-black">{block}</div>
              <div className="mt-1 text-xs text-muted-foreground">{answered}/{blockItems.length} itens preenchidos</div>
              <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${config.className}`}>
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </div>
            </div>

            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1 text-[11px] text-success animate-pop"><CheckCircle2 className="h-3 w-3" /> Salvo</span>;
  return <span className="text-[11px] text-transparent">.</span>;
}

function ItemCard({ item, answer, photos, onAnswer, onConformity, onAddPhoto, onRemovePhoto, primary }: {
  item: ChecklistItem;
  answer?: ChecklistAnswer;
  photos: StoredPhoto[];
  onAnswer: (p: Partial<ChecklistAnswer>) => void;
  onConformity: (c: ChecklistAnswer["conformity"]) => void;
  onAddPhoto: (f: File) => void;
  onRemovePhoto: (id: string) => void;
  primary: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isNonConform = answer?.conformity === "nao_conforme";

  const updateIrregularities = (next: ChecklistIrregularity[]) => {
    onAnswer({
      irregularities: next,
      observation: irregularitiesToObservation(item, next),
    });
  };

  return (
    <article className="rounded-3xl border bg-card p-4 shadow-sm">
      <h3 className="text-[15px] font-extrabold leading-snug">{item.label}</h3>

      {item.type === "conformidade" && (
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <ConfButton active={answer?.conformity === "conforme"} variant="ok" onClick={() => onConformity("conforme")} label="Conforme" icon={CheckCircle2} />
          <ConfButton active={answer?.conformity === "nao_conforme"} variant="bad" onClick={() => onConformity("nao_conforme")} label="Não Conf." icon={XCircle} />
          <ConfButton active={answer?.conformity === "nao_realizado"} variant="neutral" onClick={() => onConformity("nao_realizado")} label="Não Realiz." icon={MinusCircle} />
        </div>
      )}

      {item.type === "numero" && (
        <input
          type="number" inputMode="numeric"
          value={answer?.numberValue ?? ""}
          onChange={(e) => onAnswer({ numberValue: e.target.value === "" ? null : Number(e.target.value) })}
          className="mt-4 h-14 w-full rounded-2xl border bg-background px-4 text-base outline-none focus:border-primary"
          placeholder="Digite o número"
        />
      )}

      {item.type === "texto" && (
        <textarea
          value={answer?.textValue ?? ""}
          onChange={(e) => onAnswer({ textValue: e.target.value })}
          className="mt-4 min-h-[90px] w-full rounded-2xl border bg-background p-3 text-base outline-none focus:border-primary"
          placeholder="Digite sua resposta"
        />
      )}

      {item.type === "conformidade" && isNonConform && (
        <div className="mt-4 space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
          {item.auditKind ? (
            <AuditIrregularities
              item={item}
              irregularities={answer?.irregularities?.length ? answer.irregularities : [newIrregularity()]}
              onChange={updateIrregularities}
            />
          ) : (
            <textarea
              value={answer?.observation ?? ""}
              onChange={(e) => onAnswer({ observation: e.target.value })}
              placeholder="Descreva o motivo da não conformidade"
              className="min-h-[82px] w-full rounded-xl border bg-background p-3 text-sm outline-none focus:border-destructive"
              required
            />
          )}

          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddPhoto(f); e.target.value = ""; }}
          />
          <button
            type="button" onClick={() => fileRef.current?.click()}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-bold"
            style={{ borderColor: primary, color: primary }}
          >
            <Camera className="h-5 w-5" /> Adicionar foto opcional
          </button>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border">
                  <img src={p.dataUrl} alt="anexo" className="h-full w-full object-cover" />
                  <button
                    onClick={() => onRemovePhoto(p.id)}
                    className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
                    aria-label="Remover foto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function AuditIrregularities({ item, irregularities, onChange }: {
  item: ChecklistItem;
  irregularities: ChecklistIrregularity[];
  onChange: (next: ChecklistIrregularity[]) => void;
}) {
  const update = (id: string, patch: Partial<ChecklistIrregularity>) => {
    onChange(irregularities.map((irr) => irr.id === id ? { ...irr, ...patch } : irr));
  };

  const remove = (id: string) => {
    if (irregularities.length === 1) {
      onChange([{ ...newIrregularity() }]);
      return;
    }
    onChange(irregularities.filter((irr) => irr.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wide text-destructive">Irregularidades encontradas</div>

      {irregularities.map((irr, index) => (
        <div key={irr.id} className="rounded-2xl border bg-background p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-black">Irregularidade {index + 1}</div>
            <button
              type="button"
              onClick={() => remove(irr.id)}
              className="grid h-8 w-8 place-items-center rounded-full border text-muted-foreground"
              aria-label="Remover irregularidade"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="text-xs font-bold uppercase text-muted-foreground">Andar</label>
          <select
            value={irr.floor || ""}
            onChange={(e) => update(irr.id, { floor: e.target.value })}
            className="mt-1 h-12 w-full rounded-xl border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
          >
            <option value="">Selecione o andar</option>
            {FLOORS.map((floor) => <option key={floor} value={floor}>{floor}</option>)}
          </select>

          {item.auditKind === "elevadores" && (
            <>
              <label className="mt-3 block text-xs font-bold uppercase text-muted-foreground">Qual elevador?</label>
              <select
                value={irr.elevator || ""}
                onChange={(e) => update(irr.id, { elevator: e.target.value as ChecklistIrregularity["elevator"] })}
                className="mt-1 h-12 w-full rounded-xl border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="">Selecione</option>
                {ELEVATORS.map((elevator) => <option key={elevator.value} value={elevator.value}>{elevator.label}</option>)}
              </select>
            </>
          )}

          <label className="mt-3 block text-xs font-bold uppercase text-muted-foreground">Descreva a irregularidade</label>
          <textarea
            value={irr.description}
            onChange={(e) => update(irr.id, { description: e.target.value })}
            placeholder="Ex: Faltando 1 extintor próximo ao elevador."
            className="mt-1 min-h-[82px] w-full rounded-xl border bg-background p-3 text-sm outline-none focus:border-destructive"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...irregularities, newIrregularity()])}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border bg-card text-sm font-bold"
      >
        <Plus className="h-4 w-4" /> Adicionar outra irregularidade
      </button>
    </div>
  );
}

function ConfButton({ active, onClick, label, icon: Icon, variant }: {
  active: boolean; onClick: () => void; label: string;
  icon: ComponentType<{ className?: string }>;
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
      className={`flex h-[74px] min-h-[44px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 text-[12px] font-black leading-tight transition active:scale-[0.97] ${active ? colors.active : `bg-background ${colors.base}`}`}
    >
      <Icon className={`h-5 w-5 ${active ? "animate-pop" : ""}`} />
      <span>{label}</span>
    </button>
  );
}
