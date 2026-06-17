import { getInProgressRound, getRound, getRoundsForUser, putRound } from "@/lib/db";
import type { ChecklistAnswer, Round, Shift } from "@/lib/types";
import { roundNumberService } from "./roundNumberService";

function uuid() {
  return "r_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const roundService = {
  async start(opts: { hotel_id: string; user_id: string; userName: string; shift: Shift }): Promise<Round> {
    const existing = await getInProgressRound(opts.hotel_id, opts.user_id);
    if (existing) return existing;
    const now = new Date();
    const year = now.getFullYear();
    const number = await roundNumberService.next(opts.hotel_id, year);
    const round: Round = {
      id: uuid(),
      hotel_id: opts.hotel_id,
      user_id: opts.user_id,
      userName: opts.userName,
      number,
      year,
      shift: opts.shift,
      status: "em_andamento",
      startedAt: now.toISOString(),
      serverStartedAt: null,
      answers: {},
    };
    await putRound(round);
    return round;
  },
  async save(round: Round): Promise<void> {
    await putRound(round);
  },
  async setAnswer(round: Round, itemId: string, patch: Partial<ChecklistAnswer>): Promise<Round> {
    const current = round.answers[itemId] || { itemId };
    const next: Round = {
      ...round,
      answers: { ...round.answers, [itemId]: { ...current, ...patch, itemId } },
    };
    await putRound(next);
    return next;
  },
  async finish(round: Round, opts: { generalObservation?: string; signatureDataUrl: string; score: number }): Promise<Round> {
    const final: Round = {
      ...round,
      generalObservation: opts.generalObservation,
      signatureDataUrl: opts.signatureDataUrl,
      score: opts.score,
      status: "finalizado",
      finishedAt: new Date().toISOString(),
    };
    await putRound(final);
    return final;
  },
  getInProgress: getInProgressRound,
  get: getRound,
  listForUser: getRoundsForUser,
};
