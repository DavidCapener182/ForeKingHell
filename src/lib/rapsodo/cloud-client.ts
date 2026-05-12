import { buildClubKey, formatClubType, normalizeClubType } from "@/lib/rapsodo/parser";

export type RapsodoProviderKind = "practice" | "simulation";

export type RapsodoCloudSession = {
  providerKind: RapsodoProviderKind;
  providerSessionId: string;
  providerSessionType: string | null;
  providerSessionMode: string | null;
  title: string;
  dateIso: string | null;
  shotCount: number | null;
  courseName: string | null;
  raw: Record<string, unknown>;
};

export type RapsodoBagClub = {
  rapsodoClubId: string;
  clubType: string;
  clubLabel: string;
  clubBrand: string | null;
  clubModel: string | null;
  clubKey: string;
  raw: Record<string, unknown>;
};

export type RapsodoShotRef = {
  rapsodoShotId: string;
  shotNumber: number | null;
  sequenceIndex: number;
  raw: Record<string, unknown>;
};

export type RapsodoShotClubUpdate = {
  rapsodoShotId: string;
  rapsodoClubId: string;
};

export type RapsodoLoginResult = {
  token: string;
  profile: Record<string, unknown> | null;
};

export type RapsodoCloudClientOptions = {
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
};

export class RapsodoCloudError extends Error {
  status: number | null;
  code: string;

  constructor(message: string, options: { status?: number | null; code?: string } = {}) {
    super(message);
    this.name = "RapsodoCloudError";
    this.status = options.status ?? null;
    this.code = options.code ?? "RAPSODO_CLOUD_ERROR";
  }
}

const DEFAULT_API_BASE_URL = "https://mlm.rapsodo.com";
const DEFAULT_TAKE = 50;
const PRACTICE_SESSION_LISTS = [
  { mode: "practice", type: "0, 1, 2, 3", sessionModes: null },
  { mode: "combines", type: "4", sessionModes: null },
  { mode: "virtualRange", type: "0, 3", sessionModes: "7" },
] as const;
const SIMULATION_SESSION_LISTS = [
  { mode: "courses", gameType: "0,8,9" },
  { mode: "range", gameType: "1" },
  { mode: "target", gameType: "2" },
  { mode: "ctp", gameType: "4" },
] as const;

export class RapsodoCloudClient {
  private readonly apiBaseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: RapsodoCloudClientOptions = {}) {
    this.apiBaseUrl = (options.apiBaseUrl ?? process.env.RAPSODO_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(
      /\/$/,
      "",
    );
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async login(email: string, password: string): Promise<RapsodoLoginResult> {
    const payload = await this.requestJson<unknown>("auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const token = stringValue(payload, ["token", "accessToken", "jwt"]);

    if (!token) {
      throw new RapsodoCloudError("R-Cloud login succeeded but did not return a token.", {
        code: "RAPSODO_TOKEN_MISSING",
      });
    }

    const profile = recordValue(payload, "data") ?? recordValue(payload, "profile");
    const switchedToken = await this.switchTokenIfAvailable(token, profile);

    return {
      token: switchedToken ?? token,
      profile,
    };
  }

  async listSessions(
    token: string,
    options: { take?: number; startDate?: string | null; endDate?: string | null } = {},
  ): Promise<RapsodoCloudSession[]> {
    const results = await Promise.allSettled([
      ...PRACTICE_SESSION_LISTS.map((list) => this.listPracticeSessions(token, list, options)),
      ...SIMULATION_SESSION_LISTS.map((list) => this.listSimulationSessions(token, list, options)),
    ]);
    const authFailure = results.find(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof RapsodoCloudError &&
        (result.reason.status === 401 || result.reason.status === 403),
    );

    if (authFailure?.status === "rejected") {
      throw authFailure.reason;
    }

    const sessions = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

    if (sessions.length === 0 && results.every((result) => result.status === "rejected")) {
      const firstFailure = results.find((result) => result.status === "rejected");

      if (firstFailure?.status === "rejected") {
        throw firstFailure.reason;
      }
    }

    const uniqueSessions = new Map<string, RapsodoCloudSession>();

    for (const session of sessions) {
      uniqueSessions.set(`${session.providerKind}:${session.providerSessionId}`, session);
    }

    return [...uniqueSessions.values()].sort((left, right) => {
      const rightTime = right.dateIso ? new Date(right.dateIso).getTime() : 0;
      const leftTime = left.dateIso ? new Date(left.dateIso).getTime() : 0;
      return rightTime - leftTime;
    });
  }

  async exportSessionCsv(
    token: string,
    session: Pick<RapsodoCloudSession, "providerKind" | "providerSessionId">,
  ): Promise<string> {
    const path =
      session.providerKind === "simulation"
        ? `simulation/${encodeURIComponent(session.providerSessionId)}/details/export`
        : `session/${encodeURIComponent(session.providerSessionId)}/details/export`;

    return this.requestText(path, { method: "GET" }, token);
  }

  async listBagClubs(token: string): Promise<RapsodoBagClub[]> {
    const payload = await this.requestJson<unknown>("bag/v2/default", { method: "GET" }, token);
    const rows = firstArray(payload, ["clubs", "data", "items", "rows"]);

    return rows.map(normalizeBagClub).filter(isRapsodoBagClub);
  }

  async listSessionShotRefs(
    token: string,
    session: Pick<RapsodoCloudSession, "providerKind" | "providerSessionId">,
    take = 500,
  ): Promise<RapsodoShotRef[]> {
    const path =
      session.providerKind === "simulation"
        ? `simulation/${encodeURIComponent(session.providerSessionId)}/details?skip=0&take=${take}`
        : `session/${encodeURIComponent(session.providerSessionId)}/details?skip=0&take=${take}`;
    const payload = await this.requestJson<unknown>(path, { method: "GET" }, token);

    return shotDetailRows(payload).map(normalizeShotRef).filter(isRapsodoShotRef);
  }

  async updateShotClubs(
    token: string,
    session: Pick<RapsodoCloudSession, "providerKind">,
    updates: RapsodoShotClubUpdate[],
  ): Promise<number> {
    const updatesByClubId = groupBy(updates, (update) => update.rapsodoClubId);
    let updatedCount = 0;

    for (const [rapsodoClubId, clubUpdates] of updatesByClubId) {
      const shotIds = uniqueStrings(clubUpdates.map((update) => update.rapsodoShotId));

      if (shotIds.length === 0) {
        continue;
      }

      if (session.providerKind === "simulation") {
        await this.requestJson<unknown>(
          "simulation/shot/club",
          {
            method: "POST",
            body: JSON.stringify({ clubId: rapsodoClubId, shotIds }),
          },
          token,
        );
        updatedCount += shotIds.length;
        continue;
      }

      if (shotIds.length === 1) {
        await this.requestJson<unknown>(
          `shot/v2/${encodeURIComponent(shotIds[0])}/change/club`,
          {
            method: "POST",
            body: JSON.stringify({ clubId: rapsodoClubId }),
          },
          token,
        );
      } else {
        await this.requestJson<unknown>(
          "shot/v2/change/club",
          {
            method: "POST",
            body: JSON.stringify({ clubId: rapsodoClubId, shotIds }),
          },
          token,
        );
      }

      updatedCount += shotIds.length;
    }

    return updatedCount;
  }

  private async listPracticeSessions(
    token: string,
    list: (typeof PRACTICE_SESSION_LISTS)[number],
    options: { take?: number; startDate?: string | null; endDate?: string | null },
  ) {
    const params = sessionListParams({
      skip: 0,
      take: options.take ?? DEFAULT_TAKE,
      startDate: options.startDate,
      endDate: options.endDate,
      dateParamNames: ["startDate", "endDate"],
      extraParams: {
        type: list.type,
        ...(list.sessionModes ? { sessionModes: list.sessionModes } : {}),
      },
    });
    const payload = await this.requestJson<unknown>(`session/user/list?${params}`, { method: "GET" }, token);
    const rows = firstArray(payload, ["data", "sessions", "items", "rows"]);

    return rows.map((row) => normalizeSession(row, "practice", list.mode)).filter(isRapsodoCloudSession);
  }

  private async listSimulationSessions(
    token: string,
    list: (typeof SIMULATION_SESSION_LISTS)[number],
    options: { take?: number; startDate?: string | null; endDate?: string | null },
  ) {
    const params = sessionListParams({
      skip: 0,
      take: options.take ?? DEFAULT_TAKE,
      startDate: options.startDate,
      endDate: options.endDate,
      dateParamNames: ["minDate", "maxDate"],
    });
    const payload = await this.requestJson<unknown>(
      `simulation/sessions?${params}&gameType=${encodeURIComponent(list.gameType)}`,
      { method: "GET" },
      token,
    );
    const rows = firstArray(payload, ["simulations", "data", "sessions", "items", "rows"]);

    return rows.map((row) => normalizeSession(row, "simulation", list.mode)).filter(isRapsodoCloudSession);
  }

  private async switchTokenIfAvailable(token: string, profile: Record<string, unknown> | null) {
    const mlmType = profile?.registeredSerial ? "2" : null;

    if (!mlmType) {
      return null;
    }

    try {
      const payload = await this.requestJson<unknown>(
        `auth/token/switch/${mlmType}`,
        { method: "GET" },
        token,
      );

      return stringValue(payload, ["token"]);
    } catch {
      return null;
    }
  }

  private async requestJson<T>(path: string, init: RequestInit, token?: string): Promise<T> {
    const response = await this.request(path, init, token);
    const text = await response.text();

    if (!text.trim()) {
      return null as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new RapsodoCloudError("R-Cloud returned a response that was not valid JSON.", {
        status: response.status,
        code: "RAPSODO_BAD_JSON",
      });
    }
  }

  private async requestText(path: string, init: RequestInit, token?: string): Promise<string> {
    const response = await this.request(path, init, token);
    return response.text();
  }

  private async request(path: string, init: RequestInit, token?: string) {
    const response = await this.fetchFn(`${this.apiBaseUrl}/${path.replace(/^\//, "")}`, {
      ...init,
      headers: {
        accept: "application/json, text/csv, */*",
        "content-type": "application/json",
        os: "web",
        ...(token ? { authorization: token } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw await toRapsodoError(response);
    }

    return response;
  }
}

function sessionListParams(input: {
  skip: number;
  take: number;
  startDate?: string | null;
  endDate?: string | null;
  dateParamNames: [string, string];
  extraParams?: Record<string, string>;
}) {
  const params = new URLSearchParams({
    skip: input.skip.toString(),
    take: input.take.toString(),
  });

  if (input.startDate) {
    params.set(input.dateParamNames[0], input.startDate);
  }

  if (input.endDate) {
    params.set(input.dateParamNames[1], input.endDate);
  }

  for (const [key, value] of Object.entries(input.extraParams ?? {})) {
    params.set(key, value);
  }

  return params.toString();
}

async function toRapsodoError(response: Response) {
  const text = await response.text().catch(() => "");
  const payload = safeJson(text);
  const rawMessage = stringValue(payload, ["message", "error", "detail"]);
  const message = normalizeRapsodoErrorMessage(rawMessage, response.status);

  return new RapsodoCloudError(message, {
    status: response.status,
    code: response.status === 401 || response.status === 403 ? "RAPSODO_AUTH_EXPIRED" : "RAPSODO_REQUEST_FAILED",
  });
}

function normalizeRapsodoErrorMessage(message: string | null, status: number) {
  if (status === 401 || status === 403) {
    return message || "R-Cloud rejected the saved login token. Sign in again.";
  }

  if (message && !/^something went wrong\.?\s+code:/i.test(message)) {
    return message;
  }

  return "R-Cloud rejected that request. Try loading sessions again; if it keeps happening, export the CSV manually from R-Cloud and import it from /import.";
}

function normalizeSession(
  value: unknown,
  providerKind: RapsodoProviderKind,
  fallbackMode: string | null,
): RapsodoCloudSession | null {
  if (!isRecord(value)) {
    return null;
  }

  const providerSessionId = stringValue(value, ["id", "_id", "sessionId", "sessionid", "simulationId", "simulationid"]);

  if (!providerSessionId) {
    return null;
  }

  const providerSessionMode = fallbackMode ?? stringValue(value, ["gameType", "mode", "sessionMode"]);
  const providerSessionType = stringValue(value, ["type", "sessionType", "sessionTypeName"]);
  const courseName = stringValue(value, ["courseName", "coursename", "course", "golfCourseName"]);
  const title =
    stringValue(value, ["customName", "customname", "name", "title", "sessionName", "displayName"]) ||
    courseName ||
    `${providerSessionMode ?? providerKind} session`;
  const dateIso = dateIsoValue(value, ["startDate", "startdate", "createdAt", "createdat", "date", "sessionDate", "updatedAt"]);

  return {
    providerKind,
    providerSessionId,
    providerSessionType,
    providerSessionMode,
    title,
    dateIso,
    shotCount: numberValue(value, ["shotCount", "shotcount", "shotsCount", "totalShots", "count"]),
    courseName,
    raw: value,
  };
}

function normalizeBagClub(value: unknown): RapsodoBagClub | null {
  if (!isRecord(value)) {
    return null;
  }

  const rapsodoClubId = stringValue(value, ["id", "_id", "clubId"]);

  if (!rapsodoClubId) {
    return null;
  }

  const clubTypeRaw = stringValue(value, ["clubCode", "code", "clubType", "type", "clubName", "name"]);
  const clubType = normalizeClubType(clubTypeRaw);
  const clubBrand = stringValue(value, ["brandName", "brand", "clubBrand"]);
  const clubModel = stringValue(value, ["modelName", "model", "clubModel"]);

  return {
    rapsodoClubId,
    clubType,
    clubLabel: formatClubType(clubType),
    clubBrand,
    clubModel,
    clubKey: buildClubKey(clubType, clubBrand, clubModel),
    raw: value,
  };
}

function isRapsodoBagClub(value: RapsodoBagClub | null): value is RapsodoBagClub {
  return value !== null;
}

function normalizeShotRef(value: unknown, sequenceIndex: number): RapsodoShotRef | null {
  if (!isRecord(value)) {
    return null;
  }

  const rapsodoShotId = stringValue(value, ["localId", "localID", "id", "_id", "shotId"]);

  if (!rapsodoShotId) {
    return null;
  }

  return {
    rapsodoShotId,
    shotNumber: numberValue(value, ["shotNumber", "shotNo", "shot", "shotNum"]),
    sequenceIndex,
    raw: value,
  };
}

function isRapsodoShotRef(value: RapsodoShotRef | null): value is RapsodoShotRef {
  return value !== null;
}

function shotDetailRows(value: unknown): unknown[] {
  const rows = firstArray(value, ["shots", "data", "items", "rows"]);

  if (rows.length > 0) {
    return rows;
  }

  const record = recordValue(value, "data") ?? (isRecord(value) ? value : null);
  const shots = record?.shots;

  if (Array.isArray(shots)) {
    return shots;
  }

  if (isRecord(shots)) {
    return Object.values(shots).flatMap((entry) => (Array.isArray(entry) ? entry : []));
  }

  return [];
}

function isRapsodoCloudSession(value: RapsodoCloudSession | null): value is RapsodoCloudSession {
  return value !== null;
}

function firstArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of keys) {
    const candidate = value[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (isRecord(candidate)) {
      const nested = firstArray(candidate, keys);

      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [];
}

function groupBy<T, K>(values: T[], keyFn: (value: T) => K) {
  const grouped = new Map<K, T[]>();

  for (const value of values) {
    const key = keyFn(value);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }

  return grouped;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function stringValue(value: unknown, keys: string[]) {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate.toString();
    }
  }

  return null;
}

function numberValue(value: unknown, keys: string[]) {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    const candidate = value[key];
    const parsed = typeof candidate === "number" ? candidate : typeof candidate === "string" ? Number(candidate) : NaN;

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function dateIsoValue(value: unknown, keys: string[]) {
  const dateText = stringValue(value, keys);
  const parsed = dateText ? new Date(dateText) : null;

  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
}

function recordValue(value: unknown, key: string) {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value[key];
  return isRecord(candidate) ? candidate : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
