/**
 * pdfService.ts
 * Converts a markdown-style draft document into a PDF buffer (base64-encoded).
 *
 * Implemented against the PDF 1.4 specification using only Node.js built-ins —
 * no external npm dependencies required.
 *
 * Produces a single-or-multi-page A4 document with:
 *   - Title block (bold, centred)
 *   - Section headers (bold)
 *   - Body text (regular, line-wrapped at 90 chars)
 *   - Signature lines
 *   - Page numbers
 *
 * Limitations of this zero-dep approach:
 *   - Only the 14 standard PDF core fonts are available (no Unicode beyond Latin-1).
 *     Indonesian text (Latin characters + diacritics ä ö ü) renders correctly;
 *     CJK or Arabic characters will not.
 *   - No image embedding.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PdfLine {
  text: string;
  bold?: boolean;
  centered?: boolean;
  heading?: boolean; // slightly larger
  italic?: boolean;
  skip?: boolean; // blank line
  separator?: boolean; // horizontal rule
}

// ---------------------------------------------------------------------------
// Markdown → Line list parser
// ---------------------------------------------------------------------------

export function parseMarkdownToLines(markdown: string): PdfLine[] {
  const lines: PdfLine[] = [];
  const raw = markdown.split(/\r?\n/);

  for (const rawLine of raw) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      lines.push({ text: "", skip: true });
      continue;
    }

    // H1 → centred title
    if (/^#\s+/.test(trimmed)) {
      lines.push({
        text: trimmed.replace(/^#+\s+/, "").replace(/\*\*/g, ""),
        bold: true,
        centered: true,
        heading: true,
      });
      continue;
    }

    // H2 → section heading
    if (/^##\s+/.test(trimmed)) {
      lines.push({
        text: trimmed.replace(/^#+\s+/, "").replace(/\*\*/g, ""),
        bold: true,
        heading: true,
      });
      continue;
    }

    // Horizontal rule ---/***
    if (/^[-*]{3,}$/.test(trimmed)) {
      lines.push({ text: "", separator: true });
      continue;
    }

    // Bold ** ... ** markers (keep as bold line)
    if (/^\*\*.*\*\*$/.test(trimmed)) {
      lines.push({ text: trimmed.replace(/\*\*/g, "").trim(), bold: true });
      continue;
    }

    // Italic * ... * markers
    if (/^\*[^*].*[^*]\*$/.test(trimmed)) {
      lines.push({ text: trimmed.replace(/\*/g, "").trim(), italic: true });
      continue;
    }

    // Inline bold removal (keep plain text)
    const plain = trimmed.replace(/\*\*/g, "").replace(/\*/g, "");
    lines.push({ text: plain });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Low-level PDF binary builder
// ---------------------------------------------------------------------------

/**
 * Build a minimal but fully compliant PDF 1.4 document.
 *
 * Each page holds a fixed number of text lines (see PAGE_HEIGHT_LINES).
 * The function applies automatic word-wrapping so long lines never overflow.
 */
export function buildPdf(pdfLines: PdfLine[]): Buffer {
  // Page geometry (A4 points: 595 × 842)
  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN_L = 60;
  const MARGIN_T = 780; // top text baseline
  const MARGIN_B = 60; // stop rendering below this y
  const LINE_H = 14; // normal leading
  const HEADING_H = 18; // heading leading
  const FONT_SIZE = 11;
  const HEADING_SIZE = 13;

  const MAX_CHARS_NORMAL = Math.floor((PAGE_W - MARGIN_L * 2) / (FONT_SIZE * 0.5));
  const MAX_CHARS_HEADING = Math.floor((PAGE_W - MARGIN_L * 2) / (HEADING_SIZE * 0.5));

  // Word-wrap a single line into multiple display lines
  function wrapLine(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) return [text];
    const words = text.split(" ");
    const result: string[] = [];
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length > maxChars) {
        if (current) result.push(current);
        current = word;
      } else {
        current = current ? current + " " + word : word;
      }
    }
    if (current) result.push(current);
    return result;
  }

  // Escape PDF string special characters
  function escapePdf(s: string): string {
    return (
      s
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        // Convert common Unicode to Latin-1 equivalents
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2026]/g, "...")
    );
  }

  // Build expanded render list (after word-wrap)
  interface RenderLine {
    text: string;
    bold: boolean;
    centered: boolean;
    heading: boolean;
    italic: boolean;
    skip: boolean;
    separator: boolean;
  }

  const renderLines: RenderLine[] = [];

  for (const pl of pdfLines) {
    if (pl.skip || pl.separator || !pl.text.trim()) {
      renderLines.push({
        text: pl.text,
        bold: !!pl.bold,
        centered: !!pl.centered,
        heading: !!pl.heading,
        italic: !!pl.italic,
        skip: pl.skip !== false,
        separator: !!pl.separator,
      });
      continue;
    }
    const maxC = pl.heading ? MAX_CHARS_HEADING : MAX_CHARS_NORMAL;
    const wrapped = wrapLine(pl.text, maxC);
    for (let i = 0; i < wrapped.length; i++) {
      renderLines.push({
        text: wrapped[i],
        bold: !!pl.bold,
        centered: !!pl.centered && i === 0,
        heading: !!pl.heading && i === 0,
        italic: !!pl.italic,
        skip: false,
        separator: false,
      });
    }
  }

  // Paginate
  const pages: RenderLine[][] = [];
  let currentPage: RenderLine[] = [];
  let currentY = MARGIN_T;

  for (const rl of renderLines) {
    const lh = rl.heading ? HEADING_H : LINE_H;
    if (currentY - lh < MARGIN_B) {
      pages.push(currentPage);
      currentPage = [];
      currentY = MARGIN_T;
    }
    currentPage.push(rl);
    currentY -= rl.skip || rl.separator ? LINE_H : lh;
  }
  if (currentPage.length > 0) pages.push(currentPage);
  if (pages.length === 0) pages.push([]);

  // -------------------------------------------------------------------------
  // PDF object assembly
  // -------------------------------------------------------------------------
  const objects: string[] = [];
  const offsets: number[] = [];
  let objNum = 0;

  function addObject(content: string): number {
    objNum++;
    objects.push(`${objNum} 0 obj\n${content}\nendobj\n`);
    return objNum;
  }

  // Font objects
  const fontHelveticaId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );
  const fontHelveticaBId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  );
  const fontHelveticaOId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>",
  );
  const fontHelveticaBOId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique >>",
  );

  // Resource dictionary
  const resourcesId = addObject(
    `<< /Font << /F1 ${fontHelveticaId} 0 R /F2 ${fontHelveticaBId} 0 R /F3 ${fontHelveticaOId} 0 R /F4 ${fontHelveticaBOId} 0 R >> >>`,
  );

  // Page content streams
  const contentIds: number[] = [];
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    const ops: string[] = [];
    ops.push("BT"); // Begin Text

    let y = MARGIN_T;

    for (const rl of page) {
      if (rl.separator) {
        ops.push(`ET`);
        ops.push(`${MARGIN_L} ${y - 4} m ${PAGE_W - MARGIN_L} ${y - 4} l S`);
        ops.push(`BT`);
        y -= LINE_H;
        continue;
      }

      if (rl.skip) {
        y -= LINE_H;
        continue;
      }

      const fontSize = rl.heading ? HEADING_SIZE : FONT_SIZE;
      const fontRef =
        rl.bold && rl.italic ? "/F4" : rl.bold ? "/F2" : rl.italic ? "/F3" : "/F1";
      const lh = rl.heading ? HEADING_H : LINE_H;

      const textEsc = escapePdf(rl.text);

      if (rl.centered) {
        // Approximate text width at 0.55 em per char
        const approxWidth = textEsc.length * fontSize * 0.55;
        const x = Math.max(MARGIN_L, (PAGE_W - approxWidth) / 2);
        ops.push(`${fontRef} ${fontSize} Tf`);
        ops.push(`1 0 0 1 ${x} ${y} Tm`); // absolute position
        ops.push(`(${textEsc}) Tj`);
      } else {
        ops.push(`${fontRef} ${fontSize} Tf`);
        ops.push(`1 0 0 1 ${MARGIN_L} ${y} Tm`); // absolute position
        ops.push(`(${textEsc}) Tj`);
      }
      y -= lh;
    }

    // Page number footer
    ops.push(`/F1 9 Tf`);
    ops.push(`1 0 0 1 ${PAGE_W / 2 - 20} ${MARGIN_B - 15} Tm`); // absolute position
    ops.push(`(Halaman ${pi + 1} dari ${pages.length}) Tj`);
    ops.push("ET");

    const stream = ops.join("\n");
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
    contentIds.push(contentId);
  }

  // Page objects
  const pageIds: number[] = [];
  for (let pi = 0; pi < pages.length; pi++) {
    const pageId = addObject(
      `<< /Type /Page /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources ${resourcesId} 0 R /Contents ${contentIds[pi]} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  // Pages dictionary
  const pagesId = addObject(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );

  // Update each page to point to parent
  // (Re-create page objects with /Parent — rebuild them)
  const pageObjIndices: number[] = [];
  for (let pi = 0; pi < pages.length; pi++) {
    // Update the page object inline (simple approach: include parent in original obj)
    objects[pageIds[pi] - 1] = objects[pageIds[pi] - 1].replace(
      "<< /Type /Page",
      `<< /Type /Page /Parent ${pagesId} 0 R`,
    );
    pageObjIndices.push(pageIds[pi]);
  }

  // Catalog
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  // -------------------------------------------------------------------------
  // Serialize to PDF bytes
  // -------------------------------------------------------------------------
  const header = "%PDF-1.4\n%\xc3\xa4\xc3\xbc\xc3\xb6\n"; // PDF header + 4-byte binary comment
  const chunks: string[] = [header];
  let offset = Buffer.byteLength(header, "latin1");

  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset);
    chunks.push(objects[i]);
    offset += Buffer.byteLength(objects[i], "latin1");
  }

  // Cross-reference table
  const xrefOffset = offset;
  const xrefLines = [`xref\n0 ${objNum + 1}\n`, `0000000000 65535 f \n`];
  for (const off of offsets) {
    xrefLines.push(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  const xref = xrefLines.join("");
  chunks.push(xref);

  // Trailer
  chunks.push(
    `trailer\n<< /Size ${objNum + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.from(chunks.join(""), "latin1");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a markdown-formatted draft document into a base64-encoded PDF string.
 *
 * @param markdownDraft  Full markdown document produced by assembleDraft()
 * @returns base64 string of the PDF file
 */
export function generateDraftPdf(markdownDraft: string): string {
  const lines = parseMarkdownToLines(markdownDraft);
  const buffer = buildPdf(lines);
  return buffer.toString("base64");
}
