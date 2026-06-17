import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { hotelService } from "./hotelService";
import { checklistService } from "./checklistService";
import { photoService } from "./photoService";
import type { Round } from "@/lib/types";

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR");
}

async function embedFromDataUrl(pdf: PDFDocument, dataUrl: string) {
  const isPng = dataUrl.startsWith("data:image/png");
  const base64 = dataUrl.split(",")[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return isPng ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

export const pdfService = {
  async generate(round: Round): Promise<Uint8Array> {
    const hotel = hotelService.get(round.hotel_id)!;
    const items = checklistService.forHotel(round.hotel_id);
    const photos = await photoService.listForRound(round.id);
    const photoMap = new Map(photos.map((p) => [p.id, p]));

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const color = hexToRgb(hotel.primaryColor);
    const margin = 40;
    const pageW = 595;
    const pageH = 842;

    let page = pdf.addPage([pageW, pageH]);
    let y = pageH - margin;

    const newPage = () => {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - margin;
    };
    const ensure = (h: number) => { if (y - h < margin) newPage(); };

    const drawText = (text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
      const size = opts.size ?? 10;
      ensure(size + 4);
      page.drawText(text, {
        x: opts.x ?? margin,
        y: y - size,
        size,
        font: opts.bold ? bold : font,
        color: opts.color ?? rgb(0, 0, 0),
        maxWidth: pageW - margin * 2,
      });
      y -= size + 4;
    };
    const wrap = (text: string, maxChars = 90) => {
      const lines: string[] = [];
      const words = text.split(/\s+/);
      let cur = "";
      for (const w of words) {
        if ((cur + " " + w).trim().length > maxChars) { lines.push(cur); cur = w; }
        else cur = (cur + " " + w).trim();
      }
      if (cur) lines.push(cur);
      return lines;
    };

    // Header band
    page.drawRectangle({ x: 0, y: pageH - 60, width: pageW, height: 60, color });
    page.drawText("RondaCheck", { x: margin, y: pageH - 35, size: 18, font: bold, color: rgb(1, 1, 1) });
    page.drawText(hotel.name, { x: margin, y: pageH - 52, size: 11, font, color: rgb(1, 1, 1) });
    y = pageH - 80;

    drawText(`Ronda Nº ${round.number}/${round.year}`, { size: 14, bold: true });
    drawText(`Responsável: ${round.userName}`);
    drawText(`Turno: ${round.shift === "diurno" ? "Diurno" : "Noturno"}`);
    drawText(`Início: ${fmtDate(round.startedAt)}`);
    drawText(`Término: ${fmtDate(round.finishedAt)}`);
    drawText(`Nota: ${round.score ?? 0}%`, { bold: true, color });
    y -= 8;

    // Sections / items
    const sections: string[] = [];
    items.forEach((i) => { if (!sections.includes(i.section)) sections.push(i.section); });

    for (const section of sections) {
      ensure(20);
      drawText(section, { size: 12, bold: true, color });
      const sectionItems = items.filter((i) => i.section === section);
      for (const it of sectionItems) {
        const a = round.answers[it.id];
        let resp = "(sem resposta)";
        if (a) {
          if (it.type === "conformidade") {
            resp = a.conformity === "conforme" ? "Conforme" : a.conformity === "nao_conforme" ? "Não Conforme" : a.conformity === "nao_realizado" ? "Não Realizado" : "(sem resposta)";
          } else if (it.type === "numero") {
            resp = a.numberValue != null ? String(a.numberValue) : "(sem resposta)";
          } else {
            resp = a.textValue || "(sem resposta)";
          }
        }
        drawText(`• ${it.label}`, { size: 10, bold: true });
        for (const ln of wrap(`   Resposta: ${resp}`)) drawText(ln);
        if (a?.observation) for (const ln of wrap(`   Obs.: ${a.observation}`)) drawText(ln);
        if (a?.photoIds?.length) {
          for (const pid of a.photoIds) {
            const ph = photoMap.get(pid);
            if (!ph) continue;
            try {
              const img = await embedFromDataUrl(pdf, ph.dataUrl);
              const maxW = 180; const maxH = 135;
              const ratio = Math.min(maxW / img.width, maxH / img.height);
              const w = img.width * ratio; const h = img.height * ratio;
              ensure(h + 6);
              page.drawImage(img, { x: margin + 12, y: y - h, width: w, height: h });
              y -= h + 6;
            } catch { /* ignore */ }
          }
        }
        y -= 2;
      }
      y -= 4;
    }

    if (round.generalObservation) {
      ensure(40);
      drawText("Observações Gerais do Plantão", { size: 12, bold: true, color });
      for (const ln of wrap(round.generalObservation)) drawText(ln);
    }

    // Signature
    if (round.signatureDataUrl) {
      ensure(120);
      y -= 8;
      drawText("Assinatura do Rondante:", { bold: true });
      try {
        const img = await embedFromDataUrl(pdf, round.signatureDataUrl);
        const w = 200; const h = (img.height / img.width) * w;
        ensure(h + 20);
        page.drawImage(img, { x: margin, y: y - h, width: w, height: h });
        y -= h + 4;
        page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.5, color: rgb(0, 0, 0) });
        y -= 12;
        drawText(round.userName);
      } catch { /* ignore */ }
    }

    return await pdf.save();
  },

  async downloadBlob(round: Round): Promise<Blob> {
    const bytes = await this.generate(round);
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  },
};
