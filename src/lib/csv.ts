const spreadsheetFormulaPrefix = /^[=+@\t\r]/;
const negativeNumber = /^-\d+(?:\.\d+)?$/;

export function csvCell(value: string) {
  const normalised = value.replace(/\s+/g, " ").trim();
  const safeValue =
    spreadsheetFormulaPrefix.test(normalised) ||
    (normalised.startsWith("-") && !negativeNumber.test(normalised))
      ? `'${normalised}`
      : normalised;

  return `"${safeValue.replace(/"/g, '""')}"`;
}
