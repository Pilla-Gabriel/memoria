import { PDFDocument, PDFFont, rgb, StandardFonts } from "pdf-lib";
import type { buildWeeklyReportData } from "@/lib/services/weekly-report";
import { threeLineSummary } from "@/lib/services/frentes";

const PRIMARY = rgb(6 / 255, 169 / 255, 244 / 255);
const PRIMARY_DARK = rgb(0, 151 / 255, 230 / 255);
const TEXT = rgb(31 / 255, 41 / 255, 55 / 255);
const TEXT_SECONDARY = rgb(107 / 255, 114 / 255, 128 / 255);
const DANGER = rgb(239 / 255, 68 / 255, 68 / 255);
const SUCCESS = rgb(34 / 255, 197 / 255, 94 / 255);

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type ReportData = Awaited<ReturnType<typeof buildWeeklyReportData>>;

// A fonte Helvetica padrão só suporta WinAnsi (ASCII + Latin-1 + pontuação
// "smart" comum). Texto livre digitado pelo usuário pode conter emoji,
// bullets (•) ou outros símbolos fora desse conjunto, o que faz o pdf-lib
// lançar um erro em tempo de geração. Substituímos o que não for suportado
// por "?" para nunca quebrar a geração do PDF.
const WINANSI_SAFE = /[\x09\x0A\x0D\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/;

function sanitizeForPdf(value: string): string {
  return Array.from(value)
    .map((char) => (WINANSI_SAFE.test(char) ? char : "?"))
    .join("");
}

function wrapText(rawText: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const text = sanitizeForPdf(rawText);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateWeeklyReportPdf(data: ReportData) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) newPage();
  }

  function text(value: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gapAfter?: number } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? fontRegular;
    const color = opts.color ?? TEXT;
    const paragraphs = value.split(/\n{2,}/);
    const lines = paragraphs.flatMap((p, i) => {
      const wrapped = wrapText(p.replace(/\s+/g, " ").trim(), font, size, CONTENT_WIDTH);
      return i < paragraphs.length - 1 ? [...wrapped, ""] : wrapped;
    });

    for (const line of lines) {
      if (line === "") {
        y -= size * 0.6;
        continue;
      }
      ensureSpace(size + 4);
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= size + 4;
    }
    y -= opts.gapAfter ?? 2;
  }

  function heading(value: string) {
    ensureSpace(30);
    page.drawRectangle({ x: MARGIN, y: y - 22, width: CONTENT_WIDTH, height: 26, color: PRIMARY });
    page.drawText(value, { x: MARGIN + 10, y: y - 16, size: 12, font: fontBold, color: rgb(1, 1, 1) });
    y -= 34;
  }

  // Cabeçalho
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 70, width: PAGE_WIDTH, height: 70, color: PRIMARY_DARK });
  page.drawText("MEMÓRIA", { x: MARGIN, y: PAGE_HEIGHT - 30, size: 16, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Relatório de Entrega Semanal", {
    x: MARGIN,
    y: PAGE_HEIGHT - 50,
    size: 11,
    font: fontRegular,
    color: rgb(1, 1, 1),
  });
  y = PAGE_HEIGHT - 90;

  const kindLabel = data.report.kind === "SEGUNDA" ? "Segunda-feira" : "Sexta-feira";
  text(`Semana de ${data.report.weekStart.toLocaleDateString("pt-BR")} · ${kindLabel}`, {
    size: 10,
    color: TEXT_SECONDARY,
    gapAfter: 2,
  });
  text(`Responsável: ${data.report.createdBy.name}`, { size: 10, color: TEXT_SECONDARY, gapAfter: 14 });

  for (const comparison of data.comparisons) {
    const summary = threeLineSummary(comparison);
    heading(comparison.frente.name);

    if (comparison.isAtRisk) {
      text("EM RISCO — pode não atingir a meta de 30 dias", { size: 9.5, font: fontBold, color: DANGER, gapAfter: 4 });
    }

    text(summary.line1, { font: fontBold, gapAfter: 4 });
    text(summary.line2, { gapAfter: 4 });
    text(summary.line3, { gapAfter: 4 });

    const deltaLabel =
      comparison.deltaPct === null
        ? `Variação: ${comparison.deltaAbs >= 0 ? "+" : ""}${comparison.deltaAbs} ${comparison.frente.unit}`
        : `Variação: ${comparison.deltaAbs >= 0 ? "+" : ""}${comparison.deltaAbs} ${comparison.frente.unit} (${comparison.deltaPct >= 0 ? "+" : ""}${comparison.deltaPct.toFixed(1)}%)`;
    text(deltaLabel, {
      size: 9.5,
      font: fontBold,
      color: comparison.deltaAbs >= 0 ? SUCCESS : DANGER,
      gapAfter: 2,
    });

    text(
      `Fonte: ${comparison.frente.source.replaceAll("_", " ")}${comparison.frente.sourceDetail ? " — " + comparison.frente.sourceDetail : ""}`,
      { size: 9, color: TEXT_SECONDARY, gapAfter: 14 }
    );
  }

  heading("Plano semanal");
  text(`Hoje: ${data.report.hoje || "—"}`, { gapAfter: 6 });
  text(`Semana: ${data.report.semana || "—"}`, { gapAfter: 6 });
  text(`Vitória: ${data.report.vitoria || "—"}`, { gapAfter: 6 });

  ensureSpace(20);
  text(`Gerado em ${new Date().toLocaleString("pt-BR")} · Uma solução ONCLICK`, {
    size: 8,
    color: TEXT_SECONDARY,
  });

  return pdfDoc.save();
}
