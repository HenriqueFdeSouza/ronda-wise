import type { Hotel } from "@/lib/types";
import type { ReactNode } from "react";

export function HotelHeader({ hotel, right, subtitle }: { hotel: Hotel; right?: ReactNode; subtitle?: string }) {
  return (
    <header
      className="safe-top px-4 pt-4 pb-5 text-white"
      style={{ background: `linear-gradient(135deg, ${hotel.primaryColor}, ${hotel.primaryColor}cc)` }}
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 text-lg font-black backdrop-blur">
          {hotel.logoText}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider opacity-90">RondaCheck</div>
          <h1 className="truncate text-base font-bold">{hotel.name}</h1>
          {subtitle && <div className="truncate text-xs opacity-90">{subtitle}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}
