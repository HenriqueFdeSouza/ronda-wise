import type { ChecklistAnswer, ChecklistItem } from "@/lib/types";

function scoreForAnswer(item: ChecklistItem, answer?: ChecklistAnswer): number | null {
  if (!answer || !answer.conformity || answer.conformity === "nao_realizado") {
    return null;
  }

  if (answer.conformity === "conforme") {
    return 1;
  }

  if (item.auditKind) {
    const irregularities = answer.irregularities || [];
    const penalty = irregularities.length > 0 ? Math.min(1, irregularities.length * 0.2) : 1;
    return Math.max(0, 1 - penalty);
  }

  return 0;
}

export function calculateRoundScore(
  items: ChecklistItem[],
  answers: Record<string, ChecklistAnswer>,
): number {
  const conformidade = items.filter((i) => i.type === "conformidade");
  if (conformidade.length === 0) return 100;

  let counted = 0;
  let totalScore = 0;

  for (const item of conformidade) {
    const itemScore = scoreForAnswer(item, answers[item.id]);
    if (itemScore === null) continue;

    counted += 1;
    totalScore += itemScore;
  }

  if (counted === 0) return 100;
  return Math.round((totalScore / counted) * 100);
}
