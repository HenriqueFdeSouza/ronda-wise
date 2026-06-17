import type { ChecklistAnswer, ChecklistItem } from "@/lib/types";

export function calculateRoundScore(
  items: ChecklistItem[],
  answers: Record<string, ChecklistAnswer>,
): number {
  const conformidade = items.filter((i) => i.type === "conformidade");
  if (conformidade.length === 0) return 100;
  let counted = 0;
  let conformes = 0;
  for (const item of conformidade) {
    const a = answers[item.id];
    if (!a || !a.conformity || a.conformity === "nao_realizado") continue;
    counted += 1;
    if (a.conformity === "conforme") conformes += 1;
  }
  if (counted === 0) return 100;
  return Math.round((conformes / counted) * 100);
}
