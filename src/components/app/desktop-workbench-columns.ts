type WorkbenchColumnVisibility = {
  id: string;
  locked?: boolean;
};

export function resolveVisibleColumnIds(
  columns: readonly WorkbenchColumnVisibility[],
  requestedIds: readonly string[],
) {
  const requestedIdSet = new Set(requestedIds);
  const hasValidRequestedId = columns.some((column) => requestedIdSet.has(column.id));

  if (!hasValidRequestedId) {
    return columns.map((column) => column.id);
  }

  return columns
    .filter((column) => column.locked || requestedIdSet.has(column.id))
    .map((column) => column.id);
}
