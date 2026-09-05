import type { LoginActionState } from "./actions";

const transportMessages = new Set([
  "Failed to fetch",
  "Load failed",
  "NetworkError when attempting to fetch resource.",
]);

// Catch only browser transport failures. Next's redirect exceptions and application
// errors must reach the framework unchanged; a dropped response is not a failed login.
export function recoverLoginConnection(
  action: (state: LoginActionState, data: FormData) => Promise<LoginActionState>,
  message: string,
) {
  return async (state: LoginActionState, data: FormData): Promise<LoginActionState> => {
    try {
      return await action(state, data);
    } catch (error) {
      if (error instanceof TypeError && transportMessages.has(error.message)) {
        return { status: "error", message };
      }
      throw error;
    }
  };
}
