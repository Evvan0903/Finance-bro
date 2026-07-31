import * as XLSX from "xlsx";
import {
  VISUAL_ASSET_FORMATS,
  type StoredVisualAsset,
  type VisualAssetColumn,
  type VisualAssetExport,
  type VisualAssetFormat,
  type VisualAssetInput,
  type VisualAssetMetadata,
  type VisualAssetValue,
} from "./types";

const MAX_SVG_BYTES = 1_000_000;
const MAX_DATASET_ROWS = 25_000;
const MAX_DATASET_COLUMNS = 100;
const MAX_TITLE_LENGTH = 160;
const SENSITIVE_KEY = /(api[ _-]?key|authorization|cookie|password|secret|token)/i;
const LOCAL_PATH = /(?:file:\/\/|\/(?:Users|home|private|var|tmp)\/|[A-Za-z]:\\)[^\s"'<>]*/g;
const SECRET_QUERY = /([?&](?:api[ _-]?key|apikey|key|token|access_token|secret)=)[^&#\s]*/gi;
const PNG_WIDTH = 1600;
const PNG_HEIGHT = 900;
const FONT: Record<string, string[]> = {
  " ": ["000","000","000","000","000","000","000"],
  A:["01110","10001","10001","11111","10001","10001","10001"],B:["11110","10001","10001","11110","10001","10001","11110"],
  C:["01111","10000","10000","10000","10000","10000","01111"],D:["11110","10001","10001","10001","10001","10001","11110"],
  E:["11111","10000","10000","11110","10000","10000","11111"],F:["11111","10000","10000","11110","10000","10000","10000"],
  G:["01111","10000","10000","10111","10001","10001","01111"],H:["10001","10001","10001","11111","10001","10001","10001"],
  I:["11111","00100","00100","00100","00100","00100","11111"],J:["00111","00010","00010","00010","10010","10010","01100"],
  K:["10001","10010","10100","11000","10100","10010","10001"],L:["10000","10000","10000","10000","10000","10000","11111"],
  M:["10001","11011","10101","10101","10001","10001","10001"],N:["10001","11001","10101","10011","10001","10001","10001"],
  O:["01110","10001","10001","10001","10001","10001","01110"],P:["11110","10001","10001","11110","10000","10000","10000"],
  Q:["01110","10001","10001","10001","10101","10010","01101"],R:["11110","10001","10001","11110","10100","10010","10001"],
  S:["01111","10000","10000","01110","00001","00001","11110"],T:["11111","00100","00100","00100","00100","00100","00100"],
  U:["10001","10001","10001","10001","10001","10001","01110"],V:["10001","10001","10001","10001","10001","01010","00100"],
  W:["10001","10001","10001","10101","10101","10101","01010"],X:["10001","10001","01010","00100","01010","10001","10001"],
  Y:["10001","10001","01010","00100","00100","00100","00100"],Z:["11111","00001","00010","00100","01000","10000","11111"],
  "0":["01110","10001","10011","10101","11001","10001","01110"],"1":["00100","01100","00100","00100","00100","00100","01110"],
  "2":["01110","10001","00001","00010","00100","01000","11111"],"3":["11110","00001","00001","01110","00001","00001","11110"],
  "4":["00010","00110","01010","10010","11111","00010","00010"],"5":["11111","10000","10000","11110","00001","00001","11110"],
  "6":["01110","10000","10000","11110","10001","10001","01110"],"7":["11111","00001","00010","00100","01000","01000","01000"],
  "8":["01110","10001","10001","01110","10001","10001","01110"],"9":["01110","10001","10001","01111","00001","00001","01110"],
  "-":["000","000","000","111","000","000","000"],".":["0","0","0","0","0","1","1"],"%":["10001","00010","00100","01000","10001","00000","00000"],
  "/":["00001","00010","00100","01000","10000","00000","00000"],":":["0","1","1","0","1","1","0"],"_":["00000","00000","00000","00000","00000","00000","11111"],
};

export class VisualAssetExportError extends Error {
  constructor(
    readonly code:
      | "INVALID_ASSET"
      | "UNSUPPORTED_FORMAT"
      | "MISSING_SVG"
      | "INVALID_SVG",
    message: string,
  ) {
    super(message);
    this.name = "VisualAssetExportError";
  }
}

function plainText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function redactSensitiveText(value: string) {
  return value
    .replace(SECRET_QUERY, "$1[REDACTED]")
    .replace(LOCAL_PATH, "[REDACTED_PATH]");
}

function sanitizeValue(value: VisualAssetValue): VisualAssetValue {
  return typeof value === "string" ? redactSensitiveText(value).replaceAll("\u0000", "") : value;
}

function sanitizedMetadata(metadata: VisualAssetMetadata | undefined): VisualAssetMetadata {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).map(([key, value]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeValue(value),
    ]),
  );
}

function safeIdentifier(value: string, field: string) {
  const trimmed = plainText(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(trimmed)) {
    throw new VisualAssetExportError("INVALID_ASSET", `${field} must be a safe identifier.`);
  }
  return trimmed;
}

function validateColumns(columns: VisualAssetColumn[]) {
  if (!columns.length || columns.length > MAX_DATASET_COLUMNS) {
    throw new VisualAssetExportError("INVALID_ASSET", "Dataset columns are invalid.");
  }
  const keys = new Set<string>();
  return columns.map((column) => {
    const key = safeIdentifier(column.key, "Column key");
    if (keys.has(key)) throw new VisualAssetExportError("INVALID_ASSET", "Dataset column keys must be unique.");
    keys.add(key);
    const label = plainText(column.label);
    if (!label || label.length > MAX_TITLE_LENGTH) {
      throw new VisualAssetExportError("INVALID_ASSET", "Dataset column labels are invalid.");
    }
    return { ...column, key, label: redactSensitiveText(label) };
  });
}

export function sanitizeStandaloneSvg(value: string) {
  const source = value.trim();
  if (!source || Buffer.byteLength(source, "utf8") > MAX_SVG_BYTES) {
    throw new VisualAssetExportError("INVALID_SVG", "SVG content is missing or too large.");
  }
  if (!/^<svg\b/i.test(source) || /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(source)) {
    throw new VisualAssetExportError("INVALID_SVG", "SVG must be a standalone SVG document.");
  }
  let svg = source
    .replace(/<\s*(script|foreignObject|iframe|object|embed|audio|video)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|foreignObject|iframe|object|embed|audio|video)\b[^>]*\/?\s*>/gi, "")
    .replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:href|xlink:href|src)\s*=\s*(?:"(?!#)[^"]*"|'(?!#)[^']*'|(?!#)[^\s>]+)/gi, "")
    .replace(/\s+style\s*=\s*("[^"]*(?:url\s*\(|expression\s*\(|@import)[^"]*"|'[^']*(?:url\s*\(|expression\s*\(|@import)[^']*'|[^\s>]*(?:url\s*\(|expression\s*\(|@import)[^\s>]*)/gi, "");
  if (!/\bxmlns\s*=/.test(svg.slice(0, svg.indexOf(">") + 1))) {
    svg = svg.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (/<\s*(script|foreignObject|iframe|object|embed|audio|video)\b|(?:javascript|data):/i.test(svg)) {
    throw new VisualAssetExportError("INVALID_SVG", "SVG contains unsupported external or executable content.");
  }
  return svg;
}

export function sanitizeVisualAssetInput(input: VisualAssetInput): VisualAssetInput {
  const title = plainText(input.title);
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw new VisualAssetExportError("INVALID_ASSET", "Asset title is invalid.");
  }
  const filenameStem = plainText(input.filenameStem);
  if (!filenameStem || filenameStem.length > MAX_TITLE_LENGTH) {
    throw new VisualAssetExportError("INVALID_ASSET", "Asset filename is invalid.");
  }
  const dataset = input.dataset;
  const id = safeIdentifier(dataset.id, "Dataset id");
  const datasetTitle = plainText(dataset.title);
  if (!datasetTitle || datasetTitle.length > MAX_TITLE_LENGTH || dataset.rows.length > MAX_DATASET_ROWS) {
    throw new VisualAssetExportError("INVALID_ASSET", "Dataset content is invalid.");
  }
  const columns = validateColumns(dataset.columns);
  const columnKeys = new Set(columns.map((column) => column.key));
  const rows = dataset.rows.map((row) => {
    const next: Record<string, VisualAssetValue> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!columnKeys.has(key)) continue;
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new VisualAssetExportError("INVALID_ASSET", "Dataset numbers must be finite.");
      }
      next[key] = sanitizeValue(value);
    }
    return next;
  });
  const requestedFormats = input.formats?.length ? input.formats : ["csv", "xlsx", ...(input.svg ? ["svg", "png"] : [])];
  const formats = [...new Set(requestedFormats)];
  if (!formats.every((format): format is VisualAssetFormat => (VISUAL_ASSET_FORMATS as readonly string[]).includes(format))) {
    throw new VisualAssetExportError("UNSUPPORTED_FORMAT", "Asset contains an unsupported export format.");
  }
  const svg = input.svg ? sanitizeStandaloneSvg(input.svg) : undefined;
  if ((formats.includes("svg") || formats.includes("png")) && !svg) {
    throw new VisualAssetExportError("MISSING_SVG", "A chart export requires a standalone SVG.");
  }
  return {
    reportId: safeIdentifier(input.reportId, "Report id"),
    title: redactSensitiveText(title),
    subtitle: input.subtitle ? redactSensitiveText(input.subtitle) : undefined,
    filenameStem: redactSensitiveText(filenameStem),
    assetType: input.assetType,
    category: input.category,
    sectionId: safeIdentifier(input.sectionId, "Section id"),
    sectionTitle: redactSensitiveText(input.sectionTitle),
    dataset: {
      id,
      title: redactSensitiveText(datasetTitle),
      description: dataset.description ? redactSensitiveText(dataset.description) : undefined,
      columns,
      rows,
    },
    metadata: sanitizedMetadata(input.metadata),
    svg,
    formats,
  };
}

export function assertVisualAssetFormat(value: string): VisualAssetFormat {
  if (!(VISUAL_ASSET_FORMATS as readonly string[]).includes(value)) {
    throw new VisualAssetExportError("UNSUPPORTED_FORMAT", "The requested export format is not supported.");
  }
  return value as VisualAssetFormat;
}

export function safeAssetFilename(asset: Pick<StoredVisualAsset, "filenameStem" | "assetId">, extension: string) {
  const slug = asset.filenameStem
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 72);
  return `finbro-${slug || "visual-asset"}.${extension}`;
}

function csvCell(value: VisualAssetValue) {
  if (value === null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const protectedText = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(protectedText) ? `"${protectedText.replaceAll('"', '""')}"` : protectedText;
}

export function visualAssetToCsv(asset: StoredVisualAsset) {
  const { columns, rows } = asset.dataset;
  const header = columns.map((column) => csvCell(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(row[column.key] ?? null)).join(","));
  return `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
}

function cellValue(value: VisualAssetValue, type: VisualAssetColumn["type"]) {
  if (value === null) return null;
  if (type === "number" && typeof value === "number") return value;
  if (type === "boolean" && typeof value === "boolean") return value;
  const text = String(value);
  return /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
}

function applyFrozenHeader(sheet: XLSX.WorkSheet) {
  // SheetJS CE does not currently emit pane XML from worksheet properties. The
  // marker remains useful to consumers and is reinforced in finalizeWorkbook.
  (sheet as XLSX.WorkSheet & { "!freeze"?: unknown })["!freeze"] = {
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };
}

function injectFrozenHeader(workbook: Uint8Array) {
  const cfb = XLSX.CFB.read(workbook, { type: "buffer" });
  const entry = XLSX.CFB.find(cfb, "xl/worksheets/sheet1.xml");
  if (!entry?.content) return workbook;
  const original = new TextDecoder().decode(entry.content as Uint8Array);
  const pane = '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>';
  const next = original.replace(
    /<sheetView([^>]*)\/>/,
    `<sheetView$1>${pane}</sheetView>`,
  ).replace(
    /(<sheetView[^>]*>)(?![\s\S]*?<pane\b)/,
    `$1${pane}`,
  );
  if (next === original) return workbook;
  entry.content = new TextEncoder().encode(next);
  entry.size = entry.content.length;
  return XLSX.CFB.write(cfb, { type: "buffer" }) as Uint8Array;
}

export function visualAssetToXlsx(asset: StoredVisualAsset) {
  const { columns, rows } = asset.dataset;
  const dataRows = [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => cellValue(row[column.key] ?? null, column.type))),
  ];
  const data = XLSX.utils.aoa_to_sheet(dataRows);
  data["!cols"] = columns.map((column) => ({
    wch: Math.min(48, Math.max(12, column.label.length + 2, ...rows.map((row) => String(row[column.key] ?? "").length + 2))),
  }));
  data["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length), c: columns.length - 1 } }) };
  applyFrozenHeader(data);

  const metadataRows = [
    ["Field", "Value"],
    ["Asset ID", asset.assetId],
    ["Title", asset.title],
    ["Dataset ID", asset.dataset.id],
    ["Dataset title", asset.dataset.title],
    ["Created at", asset.createdAt],
    ["Expires at", asset.expiresAt],
    ...Object.entries(asset.metadata ?? {}).map(([key, value]) => [key, value ?? ""]),
  ];
  const metadata = XLSX.utils.aoa_to_sheet(metadataRows);
  metadata["!cols"] = [{ wch: 28 }, { wch: 72 }];
  applyFrozenHeader(metadata);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, data, "Data");
  XLSX.utils.book_append_sheet(workbook, metadata, "Metadata");
  workbook.Props = { Title: asset.title, Subject: asset.dataset.title, Author: "FinBro" };
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", compression: true }) as Uint8Array;
  return injectFrozenHeader(output);
}

function pngCrc(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  const output = new Uint8Array(12 + data.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  view.setUint32(8 + data.length, pngCrc(output.slice(4, 8 + data.length)));
  return output;
}

function adler32(bytes: Uint8Array) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function uncompressedZlib(bytes: Uint8Array) {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let offset = 0; offset < bytes.length; offset += 65535) {
    const length = Math.min(65535, bytes.length - offset);
    const block = new Uint8Array(5 + length);
    block[0] = offset + length >= bytes.length ? 1 : 0;
    block[1] = length & 0xff;
    block[2] = length >>> 8;
    const inverse = (~length) & 0xffff;
    block[3] = inverse & 0xff;
    block[4] = inverse >>> 8;
    block.set(bytes.subarray(offset, offset + length), 5);
    blocks.push(block);
  }
  const checksum = new Uint8Array(4);
  new DataView(checksum.buffer).setUint32(0, adler32(bytes));
  blocks.push(checksum);
  const size = blocks.reduce((sum, block) => sum + block.length, 0);
  const output = new Uint8Array(size);
  let cursor = 0;
  for (const block of blocks) {
    output.set(block, cursor);
    cursor += block.length;
  }
  return output;
}

async function compressedZlib(bytes: Uint8Array) {
  if (typeof CompressionStream === "undefined") return uncompressedZlib(bytes);
  try {
    const compressed = new Blob([bytes.slice().buffer])
      .stream()
      .pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(compressed).arrayBuffer());
  } catch {
    return uncompressedZlib(bytes);
  }
}

function concatBytes(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

async function bitmapPng(asset: StoredVisualAsset) {
  const pixels = new Uint8Array(PNG_WIDTH * PNG_HEIGHT * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 255;
    pixels[index + 1] = 255;
    pixels[index + 2] = 255;
    pixels[index + 3] = 255;
  }
  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= PNG_WIDTH || y >= PNG_HEIGHT) return;
    const index = (Math.floor(y) * PNG_WIDTH + Math.floor(x)) * 4;
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
  };
  const rect = (x: number, y: number, width: number, height: number, color: [number, number, number]) => {
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(PNG_HEIGHT, Math.ceil(y + height)); py += 1) {
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(PNG_WIDTH, Math.ceil(x + width)); px += 1) setPixel(px, py, color);
    }
  };
  const text = (value: unknown, x: number, y: number, scale = 3, color: [number, number, number] = [26, 26, 26]) => {
    let cursor = x;
    for (const character of String(value ?? "").toUpperCase().slice(0, 52)) {
      const glyph = FONT[character] ?? ["11111","10001","00110","00110","00110","10001","11111"];
      for (let row = 0; row < glyph.length; row += 1) {
        for (let col = 0; col < glyph[row].length; col += 1) {
          if (glyph[row][col] === "1") rect(cursor + col * scale, y + row * scale, scale, scale, color);
        }
      }
      cursor += (glyph[0].length + 1) * scale;
    }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, color: [number, number, number], thickness = 3) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let step = 0; step <= steps; step += 1) {
      const x = x0 + (x1 - x0) * step / steps;
      const y = y0 + (y1 - y0) * step / steps;
      rect(x - thickness / 2, y - thickness / 2, thickness, thickness, color);
    }
  };
  const compactNumber = (value: number) => {
    const absolute = Math.abs(value);
    const units: Array<[number, string]> = [
      [1_000_000_000_000, "T"],
      [1_000_000_000, "B"],
      [1_000_000, "M"],
      [1_000, "K"],
    ];
    const unit = units.find(([threshold]) => absolute >= threshold);
    if (!unit) return value.toFixed(Math.abs(value) < 10 ? 1 : 0);
    const scaled = value / unit[0];
    return `${scaled.toFixed(Math.abs(scaled) < 10 ? 1 : 0)}${unit[1]}`;
  };
  const asciiLabel = (value: string, fallback: string) =>
    /^[\x20-\x7E]+$/.test(value) ? value : fallback;

  text(asciiLabel(asset.title, asset.dataset.title), 64, 48, 5);
  const { columns, rows } = asset.dataset;
  if (asset.assetType === "chart") {
    const numeric = columns.filter((column) => column.type === "number").slice(0, 3);
    const xColumn = columns.find((column) => column.type === "string") ?? columns[0];
    const values = numeric.flatMap((column) => rows.map((row) => row[column.key]).filter((value): value is number => typeof value === "number"));
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const range = Math.max(1, max - min);
    const left = 120;
    const top = 190;
    const width = 1370;
    const height = 560;
    for (let grid = 0; grid <= 4; grid += 1) {
      const y = top + grid * height / 4;
      line(left, y, left + width, y, [221, 228, 236], 2);
      text(compactNumber(max - range * grid / 4), 40, y - 10, 2, [97, 112, 128]);
    }
    const colors: Array<[number, number, number]> = [[0,85,255],[18,165,148],[164,107,255]];
    numeric.forEach((column, seriesIndex) => {
      text(asciiLabel(column.label, column.key), 120 + seriesIndex * 360, 130, 3, colors[seriesIndex]);
      let previous: { x: number; y: number } | null = null;
      rows.forEach((row, index) => {
        const value = row[column.key];
        if (typeof value !== "number") return;
        const x = left + (rows.length === 1 ? width / 2 : index * width / (rows.length - 1));
        const y = top + (max - value) / range * height;
        if (previous) line(previous.x, previous.y, x, y, colors[seriesIndex], 6);
        rect(x - 6, y - 6, 12, 12, colors[seriesIndex]);
        previous = { x, y };
      });
    });
    rows.forEach((row, index) => {
      const x = left + (rows.length === 1 ? width / 2 : index * width / (rows.length - 1));
      text(row[xColumn.key], x - 40, 790, 2, [97, 112, 128]);
    });
  } else {
    const visibleColumns = columns.slice(0, 7);
    const visibleRows = rows.slice(0, 16);
    const left = 55;
    const top = 145;
    const width = 1490;
    const rowHeight = 42;
    const colWidth = width / visibleColumns.length;
    rect(left, top, width, rowHeight, [234, 241, 255]);
    visibleColumns.forEach((column, index) => text(column.label, left + index * colWidth + 8, top + 9, 2));
    visibleRows.forEach((row, rowIndex) => {
      const y = top + (rowIndex + 1) * rowHeight;
      if (rowIndex % 2) rect(left, y, width, rowHeight, [247, 247, 247]);
      visibleColumns.forEach((column, columnIndex) => text(row[column.key], left + columnIndex * colWidth + 8, y + 9, 2, [55, 69, 83]));
      line(left, y, left + width, y, [224, 224, 224], 1);
    });
  }
  text("FINBRO STRUCTURED VISUAL ASSET", 64, 852, 2, [122, 122, 122]);

  const stride = PNG_WIDTH * 4 + 1;
  const scanlines = new Uint8Array(stride * PNG_HEIGHT);
  for (let row = 0; row < PNG_HEIGHT; row += 1) {
    scanlines[row * stride] = 0;
    scanlines.set(pixels.subarray(row * PNG_WIDTH * 4, (row + 1) * PNG_WIDTH * 4), row * stride + 1);
  }
  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, PNG_WIDTH);
  header.setUint32(4, PNG_HEIGHT);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const title = new TextEncoder().encode(`Title\u0000${redactSensitiveText(asset.title)}`);
  return concatBytes([
    new Uint8Array([137,80,78,71,13,10,26,10]),
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", title),
    pngChunk("IDAT", await compressedZlib(scanlines)),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

export async function exportVisualAsset(asset: StoredVisualAsset, format: VisualAssetFormat): Promise<VisualAssetExport> {
  if (!asset.formats?.includes(format)) {
    throw new VisualAssetExportError("UNSUPPORTED_FORMAT", "This asset does not support the requested format.");
  }
  if (format === "csv") {
    return {
      body: new TextEncoder().encode(visualAssetToCsv(asset)),
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
      filename: safeAssetFilename(asset, "csv"),
    };
  }
  if (format === "xlsx") {
    return {
      body: visualAssetToXlsx(asset),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
      filename: safeAssetFilename(asset, "xlsx"),
    };
  }
  if (!asset.svg) throw new VisualAssetExportError("MISSING_SVG", "This asset has no SVG surface.");
  const svg = sanitizeStandaloneSvg(asset.svg);
  if (format === "svg") {
    return {
      body: new TextEncoder().encode(svg),
      contentType: "image/svg+xml; charset=utf-8",
      extension: "svg",
      filename: safeAssetFilename(asset, "svg"),
    };
  }
  return {
    body: await bitmapPng(asset),
    contentType: "image/png",
    extension: "png",
    filename: safeAssetFilename(asset, "png"),
  };
}
