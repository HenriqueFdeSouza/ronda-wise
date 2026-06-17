import { HOTELS } from "@/data/seed";
import type { Hotel } from "@/lib/types";

export const hotelService = {
  list(): Hotel[] {
    return HOTELS;
  },
  get(id: string): Hotel | undefined {
    return HOTELS.find((h) => h.id === id);
  },
};
