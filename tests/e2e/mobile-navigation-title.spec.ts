import { build } from "esbuild";
import { expect, test } from "@playwright/test";

// Exercise the real viewport hook without an account, database or synthetic golf records.
test("compact detail titles follow visible content across navigation and streamed updates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const bundle = await build({
    stdin: {
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { useMobileNavigationViewport } from './src/components/app/use-mobile-navigation-viewport';
        function Screen() {
          const [location, setLocation] = useState('/bag/driver');
          const [title, setTitle] = useState('Driver');
          const view = useMobileNavigationViewport(location);
          function navigate() {
            history.pushState({}, '', '/bag/iron');
            setLocation('/bag/iron');
            setTitle('7 Iron');
          }
          return <>
            <header aria-label="Mobile app bar" style={{position:'fixed',top:0,height:52,background:'white'}}>
              <span data-testid="compact" data-visible={view.compactTitleVisible}>{view.compactTitle || 'Bag map'}</span>
              <button onClick={navigate}>Next club</button>
              <button onClick={() => setTitle('Pitching Wedge')}>Update club</button>
              <button onClick={() => setTitle('')}>Remove heading</button>
            </header>
            <main style={{paddingTop:80,minHeight:2400}}>
              <h1 style={{display:'none'}}>Desktop heading</h1>
              {title ? <h1>{title}</h1> : null}
            </main>
          </>;
        }
        createRoot(document.getElementById('root')).render(<Screen/>);
      `,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    jsx: "automatic",
    write: false,
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.route("https://navigation.test/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body style="margin:0"><div id="root"></div></body></html>',
    }),
  );
  await page.goto("https://navigation.test/bag/driver");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  const compact = page.getByTestId("compact");
  await expect(compact).toHaveText("Driver");
  await expect(compact).toHaveAttribute("data-visible", "false");
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect(compact).toHaveAttribute("data-visible", "true");
  await expect(compact).toHaveText("Driver");
  await page.getByRole("button", { name: "Next club" }).click();
  await expect(compact).toHaveText("7 Iron");
  await page.getByRole("button", { name: "Update club" }).click();
  await expect(compact).toHaveText("Pitching Wedge");
  await page.getByRole("button", { name: "Remove heading" }).click();
  await expect(compact).toHaveText("Bag map");
  await expect(compact).toHaveAttribute("data-visible", "false");
  expect(errors).toEqual([]);
});
