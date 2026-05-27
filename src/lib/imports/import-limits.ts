export const MAX_IMPORT_FILES_PER_BATCH = 5;
export const MAX_IMPORT_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_CSV_ROWS = 25000;
export const MAX_PARSED_SHOTS_PER_FILE = 5000;

const byteFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function formatMegabytes(bytes: number) {
  return `${byteFormatter.format(bytes / (1024 * 1024))} MB`;
}
