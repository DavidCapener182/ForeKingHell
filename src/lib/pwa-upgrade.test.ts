import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

it("removes old page HTML on upgrade and recovers the newly precached offline shell", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const stores = new Map<string, Map<string, Response>>([
    ["forekinghell-pwa-pages-v3", new Map([["/offline", new Response("old shell")]])],
    ["forekinghell-pwa-v7", new Map()],
    ["forekinghell-pwa-v8", new Map()],
    ["forekinghell-pwa-v8-pages", new Map([["/offline", new Response("previous shell")]])],
    ["forekinghell-pwa-v9", new Map([["/offline", new Response("new shell")]])],
  ]);
  const context = {
    self: {
      location: new URL("https://golf.example"),
      addEventListener: (name: string, listener: (event: unknown) => void) =>
        listeners.set(name, listener),
      clients: { claim: async () => {} },
    },
    caches: {
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
      open: async (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        return { match: async (key: string) => stores.get(name)?.get(key) };
      },
    },
    URL,
    Response,
    fetch: async () => {
      throw new Error("Offline");
    },
  };
  runInNewContext(readFileSync(resolve("public/sw.js"), "utf8"), context);
  let activation: Promise<unknown> | undefined;
  listeners.get("activate")!({
    waitUntil: (work: Promise<unknown>) => {
      activation = work;
    },
  });
  await activation;
  expect(stores.has("forekinghell-pwa-pages-v3")).toBe(false);
  expect(stores.has("forekinghell-pwa-v7")).toBe(false);
  expect(stores.has("forekinghell-pwa-v8")).toBe(false);
  expect(stores.has("forekinghell-pwa-v8-pages")).toBe(false);
  const response: Response = await runInNewContext(
    'networkFirstPage({ url: "https://golf.example/quick-bag" })',
    context,
  );
  expect(await response.text()).toBe("new shell");
});
