import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mobileQuickBagClub } from "./mobile-quick-bag-evidence";
import { mobileBagRows } from "./mobile-bag-rows";
import { MobileBagLadder } from "@/app/bag/mobile-bag-ladder";

const club = (id: string, model: string | null, carry: number | null) => ({
  ...mobileQuickBagClub({ id, type: "7i", brand: null, model }, []),
  trustedCarryYd: carry,
  sampleSize: carry == null ? 0 : 20,
});

describe("mobile equipment identity", () => {
  it("retains separate equipment distances, links and labels within one club family", () => {
    const input = [club("older", "Older iron", 145), club("newer", "New iron", 155)];
    const rows = mobileBagRows(input);
    expect(rows.map((row) => [row.id, row.trustedCarryYd, row.equipmentLabel])).toEqual([
      ["newer", 155, "New iron"],
      ["older", 145, "Older iron"],
    ]);
    const html = renderToStaticMarkup(<MobileBagLadder clubs={input} />);
    expect(html).toContain('href="/bag/newer"');
    expect(html).toContain('href="/bag/older"');
    expect(html).toContain("20 trusted shots");
    expect(html).toContain("155 yd");
    expect(html).toContain("145 yd");
  });
  it("identifies indistinguishable records consistently and puts missing carry last", () => {
    const input = [club("b", null, null), club("a", null, 145)];
    expect(mobileBagRows(input)).toEqual(mobileBagRows([...input].reverse()));
    expect(mobileBagRows(input).map((row) => row.equipmentLabel)).toEqual([
      "Current club · 1",
      "Current club · 2",
    ]);
    expect(mobileBagRows([input[0]])[0].equipmentLabel).toBeNull();
  });
});
