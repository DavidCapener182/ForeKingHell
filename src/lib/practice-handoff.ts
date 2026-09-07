const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Old import links used session for a record ID; session=range/speed still means activity type. */
export function practiceSourceSessionId(params?: { sourceSessionId?: string; session?: string }) {
  return (
    params?.sourceSessionId || (UUID.test(params?.session ?? "") ? params?.session : undefined)
  );
}

export function validPracticeRecordId(value: string) {
  return UUID.test(value);
}
