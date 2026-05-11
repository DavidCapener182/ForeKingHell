const DEFAULT_SINGLE_USER_ID = "00000000-0000-0000-0000-000000000001";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getDefaultUserId() {
  const configuredId = process.env.DEFAULT_USER_ID;

  if (configuredId && UUID_PATTERN.test(configuredId)) {
    return configuredId;
  }

  return DEFAULT_SINGLE_USER_ID;
}
