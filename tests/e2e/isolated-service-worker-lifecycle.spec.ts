import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });
test("real service worker waits for safe update and preserves the real owner queue", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(90000);
  const bundle = await build({
    stdin: {
      contents: `
      import React, {useState, useLayoutEffect} from 'react';
      import {createRoot} from 'react-dom/client';
      import {PwaRegister} from './src/components/pwa-register';
      import * as queue from './src/lib/offline-queue';
      window.fixtureQueue=queue;
      function Fixture(){const [owner,setOwner]=useState('synthetic-a');const [draft,setDraft]=useState(true);useLayoutEffect(()=>{document.documentElement.dataset.offlineAccountId=owner;},[owner]);
        return <main><PwaRegister activeUserId={owner}/>{draft?<form><label>Unsaved score<input name="score"/></label></form>:null}
        <button onClick={()=>setDraft(false)}>Finish draft</button><button onClick={()=>setOwner('synthetic-b')}>Switch synthetic account</button></main>}
      createRoot(document.getElementById('root')).render(<Fixture/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "fixture-navigation",
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: 'export const usePathname=()=>"/settings";',
            loader: "js",
          }));
        },
      },
    ],
  });
  let version = 1;
  let fail = true;
  const receipts: { owner: string; id: string }[] = [];
  const server = createServer((request, response) => {
    const path = new URL(request.url!, "http://fixture").pathname;
    response.setHeader("cache-control", "no-store");
    if (path === "/sw.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(
        readFileSync("public/sw.js", "utf8").replace(
          /"forekinghell-pwa-v\d+"/,
          `"forekinghell-pwa-v11-fixture-${version}"`,
        ),
      );
    } else if (path === "/fixture.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text);
    } else if (path.startsWith("/api/offline/")) {
      request.resume();
      response.setHeader("content-type", "application/json");
      response.statusCode = fail ? 503 : 200;
      if (!fail)
        receipts.push({
          owner: String(request.headers["x-fkh-offline-owner"]),
          id: String(request.headers["x-fkh-offline-operation"]),
        });
      response.end(fail ? "{}" : '{"ok":true}');
    } else if (path === "/private") {
      response.setHeader("content-type", "text/html");
      response.end("<h1>Synthetic private account page</h1>");
    } else if (path === "/offline") {
      response.setHeader("content-type", "text/html");
      response.end("<h1>Safe offline fixture</h1>");
    } else if (path === "/") {
      response.setHeader("content-type", "text/html");
      response.end(
        '<!doctype html><html><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
      );
    } else response.end("fixture asset");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    await page.goto(origin);
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-offline-account-id", "synthetic-a");
    await page.getByLabel("Unsaved score").fill("5");
    await context.setOffline(true);
    await page.evaluate(async () => {
      const q = (
        window as unknown as { fixtureQueue: typeof import("../../src/lib/offline-queue") }
      ).fixtureQueue;
      await q.queueOfflineAction({
        id: "synthetic-action",
        kind: "round-edit",
        payload: { score: 5 },
      });
    });
    await context.setOffline(false);
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (
              await (
                window as unknown as { fixtureQueue: typeof import("../../src/lib/offline-queue") }
              ).fixtureQueue.listOfflineActions("synthetic-a")
            )[0]?.retryCount,
        ),
      )
      .toBeGreaterThan(0);
    version = 2;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    await expect
      .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting)))
      .toBe(true);
    await expect(page.getByRole("button", { name: "Apply update", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Unsaved score")).toHaveValue("5");
    expect(await page.evaluate(() => caches.keys())).toContain("forekinghell-pwa-v11-fixture-1");
    expect(receipts).toHaveLength(0);
    fail = false;
    // Advance beyond the real queue's backoff without rewriting its IndexedDB record.
    await page.clock.setFixedTime(new Date(Date.now() + 120000));
    await page.evaluate(() => window.dispatchEvent(new Event("fkh-offline-retry-requested")));
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (
              await (
                window as unknown as { fixtureQueue: typeof import("../../src/lib/offline-queue") }
              ).fixtureQueue.listOfflineActions("synthetic-a")
            ).length,
        ),
      )
      .toBe(0);
    expect(receipts).toEqual([{ owner: "synthetic-a", id: "synthetic-action" }]);
    const apply = page.getByRole("button", { name: "Apply update", exact: true });
    await apply.click();
    await expect(
      page.getByText(
        "Save your changes, leave the form and finish syncing before applying this update.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Unsaved score")).toHaveValue("5");
    await page.getByRole("button", { name: "Finish draft" }).click();
    await Promise.all([
      page.waitForEvent("framenavigated", { predicate: (frame) => frame === page.mainFrame() }),
      apply.click(),
    ]);
    await expect(page.getByLabel("Unsaved score")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          async () => !(await caches.keys()).includes("forekinghell-pwa-v11-fixture-1"),
        ),
      )
      .toBe(true);
    await expect(page.getByLabel("Unsaved score")).toBeVisible();
    await context.setOffline(true);
    await page.evaluate(async () => {
      await (
        window as unknown as { fixtureQueue: typeof import("../../src/lib/offline-queue") }
      ).fixtureQueue.queueOfflineAction({
        id: "foreign-pending",
        kind: "round-edit",
        payload: { score: 9 },
      });
    });
    await page.getByRole("button", { name: "Switch synthetic account" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-offline-account-id", "synthetic-b");
    expect(
      await page.evaluate(
        async () =>
          (
            await (
              window as unknown as { fixtureQueue: typeof import("../../src/lib/offline-queue") }
            ).fixtureQueue.listOfflineActions("synthetic-b")
          ).length,
      ),
    ).toBe(0);
    await context.setOffline(false);
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (
              await (
                window as unknown as { fixtureQueue: typeof import("../../src/lib/offline-queue") }
              ).fixtureQueue.listOfflineActions("synthetic-a")
            ).length,
        ),
      )
      .toBe(0);
    await context.setOffline(false);
    expect(receipts).toHaveLength(1);
    await page.goto(`${origin}/private`);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Safe offline fixture" })).toBeVisible();
    await expect(page.getByText("Synthetic private account page")).toHaveCount(0);
  } finally {
    await context.setOffline(false);
    await page.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
