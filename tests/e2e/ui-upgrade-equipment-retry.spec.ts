import { build } from "esbuild";
import { expect, test } from "@playwright/test";

test("equipment snapshot retries retain request identity and the edited draft", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  const bundle = await build({
    stdin: {
      contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { EquipmentInlineForm } from './src/app/equipment/equipment-form-panels';
      function Fixture() {
        const [requests,setRequests] = useState([]);
        return <main><EquipmentInlineForm snapshotIdentity submitLabel="Capture snapshot" action={async(data) => {
          const request = {id:data.get('creationId'),label:data.get('label')};
          setRequests(previous => [...previous,request]);
          if (requests.length === 0) throw new Error('Synthetic response lost after capture');
          return {ok:true};
        }}><label>Snapshot label<input name="label" defaultValue="Original setup" /></label></EquipmentInlineForm>
        <output aria-label="Requests">{JSON.stringify(requests)}</output></main>;
      }
      createRoot(document.getElementById('root')).render(<Fixture />);
    `,
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
        name: "isolated-equipment-actions",
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "fixture",
          }));
          builder.onResolve({ filter: /^\.\/actions$/ }, (args) =>
            args.importer.endsWith("equipment-form-panels.tsx")
              ? { path: "actions", namespace: "fixture" }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents:
              args.path === "navigation"
                ? "export const useRouter=()=>({refresh(){}});"
                : "export const retireClubWithStateAction=()=>{throw new Error('No mutations allowed')};",
            loader: "js",
          }));
        },
      },
    ],
  });
  await page.route("https://equipment.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Snapshot retry fixture</title></head><body><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("https://equipment.fixture/");
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    const label = page.getByRole("textbox", { name: "Snapshot label" });
    await label.fill("Edited setup");
    const submit = page.getByRole("button", { name: "Capture snapshot", exact: true });
    await submit.click();
    await expect(page.getByRole("alert")).toHaveText(
      "The change could not be saved. Your entries are still here; try again.",
    );
    await expect(label).toHaveValue("Edited setup");
    await submit.click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await expect
      .poll(
        async () =>
          JSON.parse((await page.getByRole("status", { name: "Requests" }).textContent())!).length,
      )
      .toBe(2);
    let requests = JSON.parse(
      (await page.getByRole("status", { name: "Requests" }).textContent())!,
    );
    expect(requests).toHaveLength(2);
    expect(requests[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(requests[1]).toEqual(requests[0]);
    await submit.click();
    await expect
      .poll(
        async () =>
          JSON.parse((await page.getByRole("status", { name: "Requests" }).textContent())!).length,
      )
      .toBe(3);
    requests = JSON.parse((await page.getByRole("status", { name: "Requests" }).textContent())!);
    expect(requests[2].id).not.toBe(requests[1].id);
    await expect(label).toHaveValue("Edited setup");
  }
  expect(errors).toEqual([]);
});
