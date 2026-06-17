import { CHECKLIST_ITEMS, SECTION_ORDER } from "@/data/seed";
import type { ChecklistItem } from "@/lib/types";

export const checklistService = {
  forHotel(hotel_id: string): ChecklistItem[] {
    return CHECKLIST_ITEMS.filter((c) => c.hotel_id === hotel_id).sort((a, b) => {
      const sa = SECTION_ORDER.indexOf(a.section);
      const sb = SECTION_ORDER.indexOf(b.section);
      if (sa !== sb) return sa - sb;
      return a.order - b.order;
    });
  },
  sectionsForHotel(hotel_id: string): string[] {
    const items = this.forHotel(hotel_id);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const i of items) if (!seen.has(i.section)) { seen.add(i.section); out.push(i.section); }
    return out;
  },
};
