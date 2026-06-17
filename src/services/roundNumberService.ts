import { getAllRounds } from "@/lib/db";

export const roundNumberService = {
  async next(hotel_id: string, year: number): Promise<number> {
    const all = await getAllRounds();
    const existing = all.filter((r) => r.hotel_id === hotel_id && r.year === year);
    return existing.length + 1;
  },
};
