import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { hotelService } from "./hotelService";
import { checklistService } from "./checklistService";
import { photoService } from "./photoService";
import type { Round, ChecklistItem } from "@/lib/types";

/* ---------- helpers ---------- */

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}
function fmtDateShort(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

async function embedFromDataUrl(pdf: PDFDocument, dataUrl: string) {
  const isPng = dataUrl.startsWith("data:image/png");
  const base64 = dataUrl.split(",")[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return isPng ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

const COLORS = {
  ocean: hexToRgb("#0f3a5f"),
  oceanDark: hexToRgb("#0a2843"),
  teal: hexToRgb("#0fb5c4"),
  ink: hexToRgb("#0f172a"),
  text: hexToRgb("#1f2937"),
  muted: hexToRgb("#64748b"),
  subtle: hexToRgb("#94a3b8"),
  hairline: hexToRgb("#e2e8f0"),
  surface: hexToRgb("#f8fafc"),
  surface2: hexToRgb("#eef4f9"),
  white: rgb(1, 1, 1),
  success: hexToRgb("#15803d"),
  successBg: hexToRgb("#dcfce7"),
  warning: hexToRgb("#b45309"),
  warningBg: hexToRgb("#fef3c7"),
  danger: hexToRgb("#b91c1c"),
  dangerBg: hexToRgb("#fee2e2"),
  neutral: hexToRgb("#475569"),
  neutralBg: hexToRgb("#e2e8f0"),
};

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\n/);
  const out: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const tentative = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(tentative, size) > maxWidth && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = tentative;
      }
    }
    if (cur) out.push(cur);
    if (paragraphs.length > 1) out.push("");
  }
  if (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

/* ---------- PDF builder ---------- */

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 36;
const HEADER_BAND_H = 26; // running header on continuation pages

export const pdfService = {
  async generate(round: Round): Promise<Uint8Array> {
    const hotel = hotelService.get(round.hotel_id)!;
    const items = checklistService.forHotel(round.hotel_id);
    const photos = await photoService.listForRound(round.id);
    const photoMap = new Map(photos.map((p) => [p.id, p]));

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);
    const hotelColor = hexToRgb(hotel.primaryColor);

    /* ---- stats ---- */
    const conformidadeItems = items.filter((i) => i.type === "conformidade");
    let conf = 0, naoConf = 0, naoReal = 0;
    for (const it of conformidadeItems) {
      const a = round.answers[it.id];
      if (!a?.conformity) { naoReal += 1; continue; }
      if (a.conformity === "conforme") conf += 1;
      else if (a.conformity === "nao_conforme") naoConf += 1;
      else naoReal += 1;
    }
    const totalAvaliados = conformidadeItems.length;
    const score = round.score ?? 0;
    const scoreColor = score >= 90 ? COLORS.success : score >= 70 ? COLORS.warning : COLORS.danger;
    const scoreBg = score >= 90 ? COLORS.successBg : score >= 70 ? COLORS.warningBg : COLORS.dangerBg;
    const scoreLabel = score >= 90 ? "EXCELENTE" : score >= 70 ? "ATENÇÃO" : "CRÍTICO";

    /* ---- page management ---- */
    let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;
    let pageIndex = 0;
    const drawnPages: PDFPage[] = [page];

    const newPage = (withRunningHeader = true) => {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      drawnPages.push(page);
      pageIndex += 1;
      y = PAGE_H - MARGIN;
      if (withRunningHeader) drawRunningHeader();
    };

    const ensure = (needed: number) => {
      if (y - needed < MARGIN + FOOTER_H) newPage(true);
    };

    const drawRunningHeader = () => {
      page.drawRectangle({ x: 0, y: PAGE_H - HEADER_BAND_H, width: PAGE_W, height: HEADER_BAND_H, color: COLORS.surface2 });
      page.drawRectangle({ x: 0, y: PAGE_H - HEADER_BAND_H - 1, width: PAGE_W, height: 1, color: COLORS.hairline });
      page.drawText("RondaCheck", { x: MARGIN, y: PAGE_H - 17, size: 9, font: bold, color: COLORS.ocean });
      const ctx = `${hotel.shortName} · Ronda Nº ${round.number}/${round.year}`;
      const w = font.widthOfTextAtSize(ctx, 9);
      page.drawText(ctx, { x: PAGE_W - MARGIN - w, y: PAGE_H - 17, size: 9, font, color: COLORS.muted });
      y = PAGE_H - HEADER_BAND_H - 16;
    };

    /* ---- COVER HEADER (page 1) ---- */
    const headerH = 130;
    page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: hotelColor });
    // accent strip
    page.drawRectangle({ x: 0, y: PAGE_H - headerH - 4, width: PAGE_W, height: 4, color: COLORS.teal });

    // Logo block
    const logoSize = 56;
    const logoX = MARGIN;
    const logoY = PAGE_H - 40 - logoSize;
    page.drawRectangle({
      x: logoX, y: logoY, width: logoSize, height: logoSize,
      color: COLORS.white, opacity: 0.18,
      borderColor: COLORS.white, borderWidth: 1, borderOpacity: 0.4,
    });
    const logoText = hotel.logoText;
    const logoFontSize = logoText.length > 1 ? 18 : 24;
    const lw = bold.widthOfTextAtSize(logoText, logoFontSize);
    page.drawText(logoText, {
      x: logoX + (logoSize - lw) / 2,
      y: logoY + (logoSize - logoFontSize) / 2 + 4,
      size: logoFontSize, font: bold, color: COLORS.white,
    });

    // Brand + hotel title (left col next to logo)
    const titleX = logoX + logoSize + 14;
    page.drawText("RondaCheck", { x: titleX, y: PAGE_H - 38, size: 10, font: bold, color: COLORS.white, opacity: 0.85 });
    page.drawText("RELATÓRIO DE RONDA", { x: titleX, y: PAGE_H - 52, size: 8, font, color: COLORS.white, opacity: 0.75 });
    const hotelLines = wrapText(hotel.name, bold, 16, 280);
    let hy = PAGE_H - 72;
    for (const ln of hotelLines.slice(0, 2)) {
      page.drawText(ln, { x: titleX, y: hy, size: 16, font: bold, color: COLORS.white });
      hy -= 18;
    }

    // Right column meta inside header (round number badge)
    const badgeW = 150;
    const badgeH = 72;
    const badgeX = PAGE_W - MARGIN - badgeW;
    const badgeY = PAGE_H - 40 - badgeH;
    page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: badgeH, color: COLORS.white, opacity: 0.15, borderColor: COLORS.white, borderWidth: 1, borderOpacity: 0.35 });
    page.drawText("RONDA Nº", { x: badgeX + 12, y: badgeY + badgeH - 18, size: 9, font, color: COLORS.white, opacity: 0.85 });
    const numText = `${round.number}/${round.year}`;
    page.drawText(numText, { x: badgeX + 12, y: badgeY + 18, size: 26, font: bold, color: COLORS.white });

    y = PAGE_H - headerH - 20;

    /* ---- META TWO-COLUMN ---- */
    const metaH = 76;
    page.drawRectangle({ x: MARGIN, y: y - metaH, width: CONTENT_W, height: metaH, color: COLORS.surface, borderColor: COLORS.hairline, borderWidth: 1 });
    const col1X = MARGIN + 16;
    const col2X = MARGIN + CONTENT_W / 2 + 8;
    const metaRow = (x: number, ry: number, label: string, value: string) => {
      page.drawText(label, { x, y: ry, size: 8, font: bold, color: COLORS.muted });
      page.drawText(value, { x, y: ry - 12, size: 10.5, font, color: COLORS.text });
    };
    metaRow(col1X, y - 18, "RONDANTE", round.userName);
    metaRow(col1X, y - 50, "TURNO", round.shift === "diurno" ? "Diurno (06h — 18h)" : "Noturno (18h — 06h)");
    metaRow(col2X, y - 18, "INÍCIO", fmtDate(round.startedAt));
    metaRow(col2X, y - 50, "TÉRMINO", fmtDate(round.finishedAt));
    y -= metaH + 18;

    /* ---- EXECUTIVE SUMMARY ---- */
    ensure(170);
    page.drawText("RESUMO EXECUTIVO", { x: MARGIN, y: y - 10, size: 10, font: bold, color: COLORS.ocean });
    page.drawLine({ start: { x: MARGIN, y: y - 16 }, end: { x: PAGE_W - MARGIN, y: y - 16 }, thickness: 0.6, color: COLORS.hairline });
    y -= 28;

    // KPI score box (large)
    const kpiH = 96;
    const kpiW = 200;
    page.drawRectangle({ x: MARGIN, y: y - kpiH, width: kpiW, height: kpiH, color: scoreBg, borderColor: scoreColor, borderWidth: 1 });
    page.drawText("NOTA FINAL", { x: MARGIN + 14, y: y - 18, size: 9, font: bold, color: scoreColor });
    const scoreText = `${score}%`;
    page.drawText(scoreText, { x: MARGIN + 14, y: y - 66, size: 44, font: bold, color: scoreColor });
    page.drawText(scoreLabel, { x: MARGIN + 14, y: y - 84, size: 9, font: bold, color: scoreColor });

    // Right: 2x2 mini cards
    const miniX = MARGIN + kpiW + 12;
    const miniW = (CONTENT_W - kpiW - 12 - 10) / 2;
    const miniH = (kpiH - 10) / 2;
    const drawMini = (x: number, my: number, label: string, value: string | number, color: RGB, bgc: RGB) => {
      page.drawRectangle({ x, y: my - miniH, width: miniW, height: miniH, color: bgc, borderColor: COLORS.hairline, borderWidth: 0.6 });
      page.drawText(String(value), { x: x + 12, y: my - 24, size: 20, font: bold, color });
      page.drawText(label, { x: x + 12, y: my - miniH + 8, size: 8, font: bold, color: COLORS.muted });
    };
    drawMini(miniX, y, "AVALIADOS", totalAvaliados, COLORS.ocean, COLORS.white);
    drawMini(miniX + miniW + 10, y, "CONFORMES", conf, COLORS.success, COLORS.white);
    drawMini(miniX, y - miniH - 10, "NÃO CONFORMES", naoConf, COLORS.danger, COLORS.white);
    drawMini(miniX + miniW + 10, y - miniH - 10, "NÃO REALIZADOS", naoReal, COLORS.neutral, COLORS.white);
    // Border around the mini grid
    page.drawRectangle({
      x: miniX, y: y - kpiH, width: CONTENT_W - kpiW - 12, height: kpiH,
      borderColor: COLORS.hairline, borderWidth: 0.6, opacity: 0,
    });
    y -= kpiH + 24;

    /* ---- SECTIONS ---- */
    const sections: string[] = [];
    items.forEach((i) => { if (!sections.includes(i.section)) sections.push(i.section); });

    const drawIndicator = (cx: number, cy: number, kind: "conforme" | "nao_conforme" | "nao_realizado" | "sem") => {
      const r = 6.5;
      if (kind === "conforme") {
        page.drawCircle({ x: cx, y: cy, size: r, color: COLORS.success });
        // check (two lines)
        page.drawLine({ start: { x: cx - 3, y: cy }, end: { x: cx - 0.8, y: cy - 2.2 }, thickness: 1.4, color: COLORS.white });
        page.drawLine({ start: { x: cx - 0.8, y: cy - 2.2 }, end: { x: cx + 3.2, y: cy + 2.4 }, thickness: 1.4, color: COLORS.white });
      } else if (kind === "nao_conforme") {
        page.drawCircle({ x: cx, y: cy, size: r, color: COLORS.danger });
        page.drawLine({ start: { x: cx - 3, y: cy - 3 }, end: { x: cx + 3, y: cy + 3 }, thickness: 1.4, color: COLORS.white });
        page.drawLine({ start: { x: cx - 3, y: cy + 3 }, end: { x: cx + 3, y: cy - 3 }, thickness: 1.4, color: COLORS.white });
      } else if (kind === "nao_realizado") {
        page.drawCircle({ x: cx, y: cy, size: r, color: COLORS.neutralBg });
        page.drawCircle({ x: cx, y: cy, size: r, borderColor: COLORS.neutral, borderWidth: 1, opacity: 0 });
      } else {
        page.drawCircle({ x: cx, y: cy, size: r, borderColor: COLORS.subtle, borderWidth: 1, opacity: 0 });
      }
    };

    const respLabel = (it: ChecklistItem): { text: string; kind: "conforme" | "nao_conforme" | "nao_realizado" | "sem"; isText?: boolean } => {
      const a = round.answers[it.id];
      if (!a) return { text: "Sem resposta", kind: "sem" };
      if (it.type === "conformidade") {
        if (a.conformity === "conforme") return { text: "Conforme", kind: "conforme" };
        if (a.conformity === "nao_conforme") return { text: "Não Conforme", kind: "nao_conforme" };
        if (a.conformity === "nao_realizado") return { text: "Não Realizado", kind: "nao_realizado" };
        return { text: "Sem resposta", kind: "sem" };
      }
      if (it.type === "numero") return { text: a.numberValue != null ? String(a.numberValue) : "Sem resposta", kind: "sem", isText: true };
      return { text: a.textValue || "Sem resposta", kind: "sem", isText: true };
    };

    for (const section of sections) {
      const sectionItems = items.filter((i) => i.section === section);

      // section header
      ensure(40);
      const sHeaderH = 28;
      page.drawRectangle({ x: MARGIN, y: y - sHeaderH, width: CONTENT_W, height: sHeaderH, color: COLORS.ocean });
      page.drawRectangle({ x: MARGIN, y: y - sHeaderH, width: 4, height: sHeaderH, color: COLORS.teal });
      page.drawText(section.toUpperCase(), { x: MARGIN + 14, y: y - 18, size: 10.5, font: bold, color: COLORS.white });
      const countTxt = `${sectionItems.length} ${sectionItems.length === 1 ? "item" : "itens"}`;
      const cw = font.widthOfTextAtSize(countTxt, 9);
      page.drawText(countTxt, { x: PAGE_W - MARGIN - 12 - cw, y: y - 18, size: 9, font, color: COLORS.white, opacity: 0.85 });
      y -= sHeaderH + 10;

      for (let idx = 0; idx < sectionItems.length; idx++) {
        const it = sectionItems[idx];
        const a = round.answers[it.id];
        const r = respLabel(it);
        const isNonConform = it.type === "conformidade" && a?.conformity === "nao_conforme";

        const labelLines = wrapText(it.label, bold, 10, CONTENT_W - 60);
        const respLines = r.isText ? wrapText(r.text, font, 10, CONTENT_W - 60) : [r.text];
        const obsLines = a?.observation ? wrapText(a.observation, oblique, 9.5, CONTENT_W - 80) : [];
        const photoIds = a?.photoIds || [];

        const blockBaseH =
          12 + labelLines.length * 12 + respLines.length * 12 +
          (obsLines.length ? 10 + obsLines.length * 12 : 0) + 10;

        ensure(blockBaseH);

        const blockTop = y;
        // background highlight for non-conformities
        if (isNonConform) {
          page.drawRectangle({
            x: MARGIN, y: y - blockBaseH + 6, width: CONTENT_W, height: blockBaseH - 6,
            color: COLORS.dangerBg, opacity: 0.55,
            borderColor: COLORS.danger, borderWidth: 0.8,
          });
        }

        // item label
        let ly = y - 12;
        for (const ln of labelLines) {
          page.drawText(ln, { x: MARGIN + 14, y: ly, size: 10, font: bold, color: COLORS.text });
          ly -= 12;
        }

        // response with indicator
        const indCx = MARGIN + 20;
        const indCy = ly - 4;
        if (it.type === "conformidade") {
          drawIndicator(indCx, indCy, r.kind);
          page.drawText(r.text, { x: indCx + 14, y: indCy - 3.5, size: 10, font: bold, color:
            r.kind === "conforme" ? COLORS.success :
            r.kind === "nao_conforme" ? COLORS.danger :
            r.kind === "nao_realizado" ? COLORS.neutral : COLORS.muted });
          ly -= 14;
        } else {
          // numeric/text response chip
          const txt = r.text;
          page.drawText("Resposta:", { x: MARGIN + 14, y: ly - 4, size: 9, font: bold, color: COLORS.muted });
          for (let i = 0; i < respLines.length; i++) {
            page.drawText(respLines[i], { x: MARGIN + 70, y: ly - 4 - i * 12, size: 10, font, color: COLORS.text });
          }
          ly -= 14 + (respLines.length - 1) * 12;
          // keep var used
          void txt;
        }

        // observation
        if (obsLines.length) {
          ly -= 4;
          page.drawText("Observação:", { x: MARGIN + 14, y: ly, size: 8.5, font: bold, color: isNonConform ? COLORS.danger : COLORS.muted });
          ly -= 12;
          for (const ln of obsLines) {
            page.drawText(ln, { x: MARGIN + 14, y: ly, size: 9.5, font: oblique, color: COLORS.text });
            ly -= 12;
          }
        }

        y = ly - 6;

        // photos in 2-col grid
        if (photoIds.length) {
          const cellW = (CONTENT_W - 14 - 24) / 2;
          const cellH = 110;
          for (let i = 0; i < photoIds.length; i += 2) {
            ensure(cellH + 28);
            for (let j = 0; j < 2 && i + j < photoIds.length; j++) {
              const ph = photoMap.get(photoIds[i + j]);
              if (!ph) continue;
              const cx = MARGIN + 14 + j * (cellW + 14);
              const cy = y - cellH;
              page.drawRectangle({ x: cx, y: cy, width: cellW, height: cellH, color: COLORS.white, borderColor: COLORS.hairline, borderWidth: 0.8 });
              try {
                const img = await embedFromDataUrl(pdf, ph.dataUrl);
                const padding = 6;
                const innerW = cellW - padding * 2;
                const innerH = cellH - padding * 2 - 14;
                const ratio = Math.min(innerW / img.width, innerH / img.height);
                const w = img.width * ratio;
                const h = img.height * ratio;
                page.drawImage(img, { x: cx + (cellW - w) / 2, y: cy + 18 + (innerH - h) / 2, width: w, height: h });
              } catch { /* ignore */ }
              const cap = `Foto ${i + j + 1} de ${photoIds.length}`;
              page.drawText(cap, { x: cx + 8, y: cy + 6, size: 8, font, color: COLORS.muted });
            }
            y -= cellH + 12;
          }
        }

        // divider
        if (idx < sectionItems.length - 1) {
          page.drawLine({ start: { x: MARGIN + 14, y }, end: { x: PAGE_W - MARGIN - 14, y }, thickness: 0.4, color: COLORS.hairline });
          y -= 8;
        }
        void blockTop;
      }
      y -= 12;
    }

    /* ---- OBSERVAÇÕES GERAIS ---- */
    if (round.generalObservation && round.generalObservation.trim()) {
      const obsLines = wrapText(round.generalObservation, font, 10.5, CONTENT_W - 32);
      const blockH = 36 + obsLines.length * 14 + 16;
      ensure(blockH);
      page.drawRectangle({ x: MARGIN, y: y - blockH, width: CONTENT_W, height: blockH, color: COLORS.surface, borderColor: COLORS.hairline, borderWidth: 0.8 });
      page.drawRectangle({ x: MARGIN, y: y - blockH, width: 4, height: blockH, color: COLORS.teal });
      page.drawText("OBSERVAÇÕES GERAIS DO PLANTÃO", { x: MARGIN + 16, y: y - 18, size: 10, font: bold, color: COLORS.ocean });
      let oy = y - 36;
      for (const ln of obsLines) {
        page.drawText(ln, { x: MARGIN + 16, y: oy, size: 10.5, font, color: COLORS.text });
        oy -= 14;
      }
      y -= blockH + 16;
    }

    /* ---- ASSINATURA ---- */
    if (round.signatureDataUrl) {
      ensure(160);
      page.drawText("ASSINATURA DO RONDANTE", {
        x: MARGIN, y: y - 12, size: 10, font: bold, color: COLORS.ocean,
      });
      page.drawLine({ start: { x: MARGIN, y: y - 18 }, end: { x: PAGE_W - MARGIN, y: y - 18 }, thickness: 0.6, color: COLORS.hairline });
      y -= 30;

      try {
        const img = await embedFromDataUrl(pdf, round.signatureDataUrl);
        const targetW = 220;
        const targetH = (img.height / img.width) * targetW;
        const sx = (PAGE_W - targetW) / 2;
        page.drawImage(img, { x: sx, y: y - targetH, width: targetW, height: targetH });
        const lineY = y - targetH - 6;
        page.drawLine({ start: { x: sx, y: lineY }, end: { x: sx + targetW, y: lineY }, thickness: 0.6, color: COLORS.text });
        const nameW = bold.widthOfTextAtSize(round.userName, 10.5);
        page.drawText(round.userName, { x: (PAGE_W - nameW) / 2, y: lineY - 14, size: 10.5, font: bold, color: COLORS.text });
        const finished = `Finalizado em ${fmtDate(round.finishedAt || round.startedAt)}`;
        const fw = font.widthOfTextAtSize(finished, 9);
        page.drawText(finished, { x: (PAGE_W - fw) / 2, y: lineY - 28, size: 9, font, color: COLORS.muted });
        y = lineY - 40;
      } catch { /* ignore */ }
    }

    /* ---- FOOTER on every page ---- */
    const totalPages = drawnPages.length;
    const genStr = `Gerado em ${fmtDateShort(new Date().toISOString())}`;
    drawnPages.forEach((p, i) => {
      p.drawLine({ start: { x: MARGIN, y: FOOTER_H }, end: { x: PAGE_W - MARGIN, y: FOOTER_H }, thickness: 0.6, color: COLORS.hairline });
      // accent dot
      p.drawCircle({ x: MARGIN + 3, y: 18, size: 2.5, color: COLORS.teal });
      p.drawText("RondaCheck", { x: MARGIN + 10, y: 14, size: 8.5, font: bold, color: COLORS.ocean });
      const mid = `${hotel.shortName} · ${genStr}`;
      const mw = font.widthOfTextAtSize(mid, 8.5);
      p.drawText(mid, { x: (PAGE_W - mw) / 2, y: 14, size: 8.5, font, color: COLORS.muted });
      const pg = `Página ${i + 1} de ${totalPages}`;
      const pw = font.widthOfTextAtSize(pg, 8.5);
      p.drawText(pg, { x: PAGE_W - MARGIN - pw, y: 14, size: 8.5, font, color: COLORS.muted });
    });

    return await pdf.save();
  },

  async downloadBlob(round: Round): Promise<Blob> {
    const bytes = await this.generate(round);
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  },
};
