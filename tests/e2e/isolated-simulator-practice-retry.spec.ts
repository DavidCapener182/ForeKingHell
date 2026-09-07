import { build } from "esbuild";
import { expect, test } from "@playwright/test";
test("Simulator draft form retains exact prescription and request identity after uncertain response", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {SimulatorPracticeDraftForm} from './src/app/simulator-lab/practice-draft-form';createRoot(document.getElementById('root')).render(<SimulatorPracticeDraftForm prescriptionId="primary-club" fingerprint={'a'.repeat(64)} creationId="33333333-3333-4333-8333-333333333333"/>);`,
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
        name: "fixture-response-loss",
        setup(builder) {
          builder.onResolve({ filter: /^\.\/practice-draft-action$/ }, () => ({
            path: "action",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            loader: "js",
            contents: `export async function createSimulatorPracticeDraftAction(previous,form){const request=Object.fromEntries(form);window.requests.push(request);await new Promise(resolve=>setTimeout(resolve,80));document.querySelector('output').textContent=JSON.stringify(window.requests);return {error:window.requests.length===1?'We could not confirm the saved draft. Your prescription is retained; try again.':null};}`,
          }));
        },
      },
    ],
  });
  await page.route("https://simulator-retry.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><style>body{margin:16px}button{min-height:44px;max-width:100%;white-space:normal}output{display:block;overflow-wrap:anywhere}</style></head><body><div id="root"></div><output></output></body></html>',
    }),
  );
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 1023, height: 800 },
    { width: 1024, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("https://simulator-retry.fixture/");
    await page.evaluate(() => {
      (window as unknown as { requests: unknown[] }).requests = [];
    });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    const save = page.getByRole("button", {
      name: "Save this drill as a practice draft",
      exact: true,
    });
    await save.press("Enter");
    await expect(page.getByRole("alert")).toContainText("prescription is retained");
    await save.click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    const receipts = JSON.parse(await page.locator("output").innerText());
    expect(receipts).toHaveLength(2);
    expect(receipts[1]).toEqual(receipts[0]);
    expect(receipts[0]).toEqual({
      prescriptionId: "primary-club",
      fingerprint: "a".repeat(64),
      creationId: "33333333-3333-4333-8333-333333333333",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
});
