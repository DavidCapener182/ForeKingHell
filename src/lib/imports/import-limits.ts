export const MAX_IMPORT_FILES_PER_BATCH = 5;
export const MAX_IMPORT_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_CSV_ROWS = 25000;
export const MAX_PARSED_SHOTS_PER_FILE = 5000;
export const MAX_IMPORT_CSV_FIELD_LENGTH = 4096;

export type OversizedImportField = {
  columnNumber: number;
  rowNumber: number;
};

export function findOversizedImportField(
  text: string,
  maxLength = MAX_IMPORT_CSV_FIELD_LENGTH,
): OversizedImportField | null {
  let columnNumber = 1;
  let fieldLength = 0;
  let inQuotes = false;
  let rowNumber = 1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        fieldLength += 1;
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && (character === "," || character === "\t")) {
      fieldLength = 0;
      columnNumber += 1;
    } else if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      fieldLength = 0;
      columnNumber = 1;
      rowNumber += 1;
    } else {
      fieldLength += 1;
    }

    if (fieldLength > maxLength) {
      return { columnNumber, rowNumber };
    }
  }

  return null;
}

const byteFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function formatMegabytes(bytes: number) {
  return `${byteFormatter.format(bytes / (1024 * 1024))} MB`;
}
