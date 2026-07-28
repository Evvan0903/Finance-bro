"use client";

import { REPORT_RENDERING_MODEL } from "./report-rendering-model";

type PdfExportMeta = {
  ticker: string;
  researchDate: string;
  filename: string;
  footerLabel?: string;
  subject?: string;
};

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_MARGIN = 70;
const FOOTER_HEIGHT = 70;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_MARGIN * 2 - FOOTER_HEIGHT;

function stylesheetText() {
  const css: string[] = [];
  for (const stylesheet of Array.from(document.styleSheets)) {
    try {
      css.push(
        Array.from(stylesheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n"),
      );
    } catch {
      // Same-origin application styles remain available; inaccessible extension styles are ignored.
    }
  }
  css.push(`
    * { animation: none !important; transition: none !important; }
    body { margin: 0 !important; background: #fff !important; }
    [data-pdf-block] { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
    .table-wrap { overflow: visible !important; }
    table { min-width: 0 !important; table-layout: fixed !important; width: 100% !important; }
    th, td { white-space: normal !important; overflow-wrap: anywhere !important; }
    a { text-decoration: none !important; }
  `);
  return css.join("\n");
}

async function renderBlock(block: HTMLElement, css: string) {
  const bounds = block.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(bounds.width));
  const height = Math.max(1, Math.ceil(block.scrollHeight));
  const clone = block.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.height = "auto";
  const markup = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject x="0" y="0" width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>${css.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</style>
          ${markup}
        </div>
      </foreignObject>
    </svg>
  `;
  // A Blob URL gives the SVG an opaque origin in Chromium. Drawing an SVG
  // foreignObject from that origin taints the canvas and prevents PDF encoding.
  // An inline data URL preserves the same self-contained markup without tainting.
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const scale = 1.5;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function newPage() {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return canvas;
}

function addFooter(canvas: HTMLCanvasElement, meta: PdfExportMeta, pageNumber: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const y = PAGE_HEIGHT - 42;
  context.strokeStyle = "#cfd6d3";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(PAGE_MARGIN, y - 24);
  context.lineTo(PAGE_WIDTH - PAGE_MARGIN, y - 24);
  context.stroke();
  context.fillStyle = "#526878";
  context.font = "18px Arial, sans-serif";
  context.textBaseline = "middle";
  context.fillText(
    `${meta.footerLabel ?? "FinBro Equity Research"} | ${meta.subject ?? meta.ticker} | ${meta.researchDate} | Page ${pageNumber}`,
    PAGE_MARGIN,
    y,
  );
}

function findNaturalBreak(
  canvas: HTMLCanvasElement,
  sourceY: number,
  idealHeight: number,
) {
  const context = canvas.getContext("2d");
  if (!context) return Math.max(1, Math.floor(idealHeight));
  const maximum = Math.min(canvas.height - sourceY, Math.floor(idealHeight));
  const minimum = Math.max(1, Math.floor(maximum * 0.58));
  const start = sourceY + maximum;
  const end = sourceY + minimum;
  for (let row = start; row >= end; row -= 4) {
    const pixels = context.getImageData(0, row, canvas.width, 1).data;
    let lightSamples = 0;
    let samples = 0;
    for (let x = 0; x < canvas.width; x += 24) {
      const offset = x * 4;
      samples += 1;
      if (
        pixels[offset] >= 246 &&
        pixels[offset + 1] >= 246 &&
        pixels[offset + 2] >= 246
      ) lightSamples += 1;
    }
    if (samples && lightSamples / samples >= 0.985) {
      return Math.max(1, row - sourceY);
    }
  }
  return maximum;
}

function sliceHasVisibleContent(
  canvas: HTMLCanvasElement,
  sourceY: number,
  sourceHeight: number,
) {
  const context = canvas.getContext("2d");
  if (!context) return true;
  const end = Math.min(canvas.height, Math.ceil(sourceY + sourceHeight));
  for (let row = Math.floor(sourceY); row < end; row += 12) {
    const pixels = context.getImageData(0, row, canvas.width, 1).data;
    for (let x = 0; x < canvas.width; x += 24) {
      const offset = x * 4;
      if (
        pixels[offset] < 244 ||
        pixels[offset + 1] < 244 ||
        pixels[offset + 2] < 244
      ) return true;
    }
  }
  return false;
}

async function composePages(root: HTMLElement, meta: PdfExportMeta) {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-block]"));
  if (!blocks.length) throw new Error("No printable report blocks were found.");
  const css = stylesheetText();
  const rendered = [];
  for (const block of blocks) rendered.push(await renderBlock(block, css));

  const pages: HTMLCanvasElement[] = [];
  let page = newPage();
  let y = PAGE_MARGIN;
  let pageHasContent = false;
  for (const block of rendered) {
    const naturalScale = CONTENT_WIDTH / block.width;
    let sourceY = 0;
    while (sourceY < block.height) {
      let availableHeight = PAGE_MARGIN + CONTENT_HEIGHT - y;
      const remainingHeight = (block.height - sourceY) * naturalScale;
      if (
        remainingHeight > availableHeight &&
        y > PAGE_MARGIN &&
        availableHeight < CONTENT_HEIGHT * 0.35
      ) {
        pages.push(page);
        page = newPage();
        y = PAGE_MARGIN;
        pageHasContent = false;
        availableHeight = CONTENT_HEIGHT;
      }
      const idealSourceHeight = Math.min(
        block.height - sourceY,
        availableHeight / naturalScale,
      );
      const sourceHeight =
        remainingHeight > availableHeight
          ? findNaturalBreak(block, sourceY, idealSourceHeight)
          : idealSourceHeight;
      if (!sliceHasVisibleContent(block, sourceY, sourceHeight)) {
        sourceY += sourceHeight;
        if (block.height - sourceY < 1) sourceY = block.height;
        continue;
      }
      const drawHeight = sourceHeight * naturalScale;
      const context = page.getContext("2d");
      if (!context) throw new Error("Canvas rendering is unavailable.");
      context.drawImage(
        block,
        0,
        sourceY,
        block.width,
        sourceHeight,
        PAGE_MARGIN,
        y,
        CONTENT_WIDTH,
        drawHeight,
      );
      sourceY += sourceHeight;
      if (block.height - sourceY < 1) sourceY = block.height;
      y += drawHeight;
      pageHasContent = pageHasContent || drawHeight >= 1;
      if (sourceY < block.height) {
        pages.push(page);
        page = newPage();
        y = PAGE_MARGIN;
        pageHasContent = false;
      } else {
        y += 18;
      }
    }
  }
  if (pageHasContent) pages.push(page);
  pages.forEach((item, index) => addFooter(item, meta, index + 1));
  return pages;
}

function ascii(value: string) {
  return new TextEncoder().encode(value);
}

function concat(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function jpegBytes(canvas: HTMLCanvasElement) {
  const base64 = canvas.toDataURL("image/jpeg", 0.94).split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function pdfBlob(pages: HTMLCanvasElement[]) {
  const objectCount = 2 + pages.length * 3;
  const objects = new Map<number, Uint8Array>();
  objects.set(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  const pageIds = pages.map((_, index) => 3 + index * 3);
  objects.set(
    2,
    ascii(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`),
  );

  pages.forEach((canvas, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const jpeg = jpegBytes(canvas);
    const imageHeader = ascii(
      `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    objects.set(imageId, concat([imageHeader, jpeg, ascii("\nendstream")]));
    const content = `q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ`;
    objects.set(
      contentId,
      ascii(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    );
    objects.set(
      pageId,
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  });

  const header = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
  const parts: Uint8Array[] = [header];
  const offsets = [0];
  let cursor = header.length;
  for (let id = 1; id <= objectCount; id += 1) {
    const body = objects.get(id);
    if (!body) throw new Error(`Missing PDF object ${id}.`);
    const prefix = ascii(`${id} 0 obj\n`);
    const suffix = ascii("\nendobj\n");
    offsets[id] = cursor;
    parts.push(prefix, body, suffix);
    cursor += prefix.length + body.length + suffix.length;
  }
  const xrefOffset = cursor;
  const xrefRows = offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  const trailer = ascii(
    `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n${xrefRows}trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );
  parts.push(trailer);
  const bytes = new Uint8Array(concat(parts));
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function exportReportPdf(root: HTMLElement, meta: PdfExportMeta) {
  if (root.dataset.renderingModel !== REPORT_RENDERING_MODEL.pdf) {
    throw new Error("PDF export requires the audited shared report data model.");
  }
  if ("fonts" in document) await document.fonts.ready;
  const pages = await composePages(root, meta);
  const url = URL.createObjectURL(pdfBlob(pages));
  const link = document.createElement("a");
  link.href = url;
  link.download = meta.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
