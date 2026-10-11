import { describe, expect, it } from "vitest";
import { describeParsed, formatAmount, formatResellRange, parseProductMessage } from "./productMessage";

const EXAMPLE = `100ml Original sugar marshmallow

48,000 wholesale

55,000-60,000 Resell`;

describe("parseProductMessage: the shop's own format", () => {
  it("reads name, wholesale price and resell range", () => {
    const parsed = parseProductMessage(EXAMPLE);
    expect(parsed.name).toBe("100ml Original sugar marshmallow");
    expect(parsed.wholesale).toBe(48000);
    expect(parsed.resellLow).toBe(55000);
    expect(parsed.resellHigh).toBe(60000);
    expect(parsed.moq).toBeNull();
    expect(parsed.currency).toBeNull();
    expect(parsed.warnings).toEqual([]);
    expect(parsed.notes).toEqual([]);
  });

  it("reads the same message written on one line", () => {
    const parsed = parseProductMessage("100ml Original sugar marshmallow 48,000 wholesale 55,000-60,000 Resell");
    expect(parsed).toMatchObject({ name: "100ml Original sugar marshmallow", wholesale: 48000, resellLow: 55000, resellHigh: 60000 });
  });

  it("does not need blank lines between the parts", () => {
    const parsed = parseProductMessage("100ml Original sugar marshmallow\n48,000 wholesale\n55,000-60,000 Resell");
    expect(parsed).toMatchObject({ name: "100ml Original sugar marshmallow", wholesale: 48000, resellLow: 55000, resellHigh: 60000 });
  });

  it("copes with Windows line endings and stray spaces", () => {
    const parsed = parseProductMessage("  Sugar marshmallow  \r\n  48,000   wholesale \r\n 55,000 - 60,000  resell  ");
    expect(parsed).toMatchObject({ name: "Sugar marshmallow", wholesale: 48000, resellLow: 55000, resellHigh: 60000 });
  });
});

describe("parseProductMessage: labels and number styles", () => {
  it("reads labels written before the number", () => {
    const parsed = parseProductMessage("Body mist 100ml\nWholesale: ₦48,000\nResell: ₦55,000 - ₦60,000");
    expect(parsed).toMatchObject({ name: "Body mist 100ml", wholesale: 48000, resellLow: 55000, resellHigh: 60000, currency: "NGN" });
  });

  it("reads before-labels on a single line", () => {
    const parsed = parseProductMessage("Body mist wholesale 48,000 resell 55,000-60,000");
    expect(parsed).toMatchObject({ name: "Body mist", wholesale: 48000, resellLow: 55000, resellHigh: 60000 });
  });

  it("reads a label on one line and its number on the next", () => {
    const parsed = parseProductMessage("Body mist\nWholesale:\n48,000\nResell:\n55,000");
    expect(parsed).toMatchObject({ name: "Body mist", wholesale: 48000, resellLow: 55000, resellHigh: 55000 });
  });

  it("understands k for thousands, including 55-60k", () => {
    const parsed = parseProductMessage("Body mist\n48k wholesale\nResell 55-60k");
    expect(parsed).toMatchObject({ wholesale: 48000, resellLow: 55000, resellHigh: 60000 });
  });

  it("reads thousands written with a dot or no separator", () => {
    expect(parseProductMessage("Body mist\n48.000 wholesale").wholesale).toBe(48000);
    expect(parseProductMessage("Body mist\n48000 wholesale").wholesale).toBe(48000);
  });

  it("reads decimals", () => {
    expect(parseProductMessage("Sticker pack\n$12.50 wholesale").wholesale).toBe(12.5);
  });

  it("reads ws, w/s, bulk and retail as labels", () => {
    expect(parseProductMessage("Bag\n3,000 ws\n4,500 retail")).toMatchObject({ wholesale: 3000, resellLow: 4500 });
    expect(parseProductMessage("Bag\nbulk price 3,000")).toMatchObject({ wholesale: 3000 });
    expect(parseProductMessage("Bag\n3,000 w/s")).toMatchObject({ wholesale: 3000 });
  });

  it("does not read the letters ws inside another word as a label", () => {
    const parsed = parseProductMessage("Latest news bag 3,000");
    expect(parsed.name).toBe("Latest news bag");
    expect(parsed.wholesale).toBe(3000);
  });

  it("reads a price with no label as the wholesale price", () => {
    const parsed = parseProductMessage("Rattan bag\n₦12,500");
    expect(parsed).toMatchObject({ name: "Rattan bag", wholesale: 12500, resellLow: null, currency: "NGN" });
    expect(parsed.warnings).toEqual([]);
  });

  it("reads Price: 48000 even without a comma", () => {
    expect(parseProductMessage("Rattan bag\nPrice: 48000").wholesale).toBe(48000);
  });

  it("takes two unlabelled prices as wholesale then resell, and says so", () => {
    const parsed = parseProductMessage("Rattan bag\n12,500\n15,000");
    expect(parsed).toMatchObject({ wholesale: 12500, resellLow: 15000, resellHigh: 15000 });
    expect(parsed.warnings.join(" ")).toMatch(/no labels/i);
  });

  it("uses the lower number when wholesale is a range, and says so", () => {
    const parsed = parseProductMessage("Rattan bag\nwholesale 12,000-13,000");
    expect(parsed.wholesale).toBe(12000);
    expect(parsed.warnings.join(" ")).toMatch(/range/i);
  });

  it("warns when the resell price is lower than wholesale", () => {
    const parsed = parseProductMessage("Rattan bag\n12,500 wholesale\n9,000 resell");
    expect(parsed.warnings.join(" ")).toMatch(/lower than the wholesale/i);
  });

  it("warns when only a resell price is given", () => {
    const parsed = parseProductMessage("Rattan bag\n15,000 resell");
    expect(parsed.wholesale).toBeNull();
    expect(parsed.resellLow).toBe(15000);
    expect(parsed.warnings.join(" ")).toMatch(/only a resell/i);
  });
});

describe("parseProductMessage: numbers that are not prices", () => {
  it("does not read sizes as prices", () => {
    expect(parseProductMessage("250 ml bottle\n4,000 wholesale")).toMatchObject({ name: "250 ml bottle", wholesale: 4000 });
    expect(parseProductMessage("Power bank 20000mAh\n15,000 wholesale")).toMatchObject({ name: "Power bank 20000mAh", wholesale: 15000 });
    expect(parseProductMessage("Rice 5 kg\n9,000 wholesale")).toMatchObject({ name: "Rice 5 kg", wholesale: 9000 });
  });

  it("does not read N95 or model numbers as prices", () => {
    expect(parseProductMessage("N95 face mask\n2,500 wholesale")).toMatchObject({ name: "N95 face mask", wholesale: 2500 });
    expect(parseProductMessage("iPhone 15 case\n3,000 wholesale")).toMatchObject({ name: "iPhone 15 case", wholesale: 3000 });
  });

  it("does not read counts as prices", () => {
    const parsed = parseProductMessage("Pack of 12 socks\n6,000 wholesale");
    expect(parsed).toMatchObject({ name: "Pack of 12 socks", wholesale: 6000 });
  });

  it("finds no price in a message that only has a name", () => {
    const parsed = parseProductMessage("100ml Original sugar marshmallow");
    expect(parsed).toMatchObject({ name: "100ml Original sugar marshmallow", wholesale: null });
    expect(parsed.warnings).toEqual(["No price was found."]);
  });

  it("ignores phone numbers and dates", () => {
    const parsed = parseProductMessage("Bag 3,000 wholesale\nCall 08012345678\n10/10/2026");
    expect(parsed.wholesale).toBe(3000);
    expect(parsed.resellLow).toBeNull();
  });
});

describe("parseProductMessage: minimum order, unit, currency, category", () => {
  it("reads the minimum order in common phrasings", () => {
    expect(parseProductMessage("Bag\n3,000 wholesale\nMOQ 24").moq).toBe(24);
    expect(parseProductMessage("Bag\n3,000 wholesale\nMin order: 12 pcs").moq).toBe(12);
    expect(parseProductMessage("Bag\n3,000 wholesale\nminimum 6").moq).toBe(6);
    expect(parseProductMessage("Bag\n3,000 wholesale\n12 pcs minimum").moq).toBe(12);
  });

  it("keeps the MOQ line out of the name and notes", () => {
    const parsed = parseProductMessage("Bag\nMOQ 24 pcs\n3,000 wholesale");
    expect(parsed.name).toBe("Bag");
    expect(parsed.notes).toEqual([]);
  });

  it("does not take Mini 12 for a minimum order", () => {
    expect(parseProductMessage("Mini 12 speaker\n3,000 wholesale").moq).toBeNull();
  });

  it("reads the unit the price is for", () => {
    expect(parseProductMessage("Soap\n48,000 per carton wholesale")).toMatchObject({ wholesale: 48000, unit: "carton" });
    expect(parseProductMessage("Rice\n5,000/kg wholesale")).toMatchObject({ wholesale: 5000, unit: "kg" });
    expect(parseProductMessage("Soap\n600 per dozen")).toMatchObject({ wholesale: 600, unit: "dozen" });
  });

  it("leaves the unit empty when the message does not name one", () => {
    expect(parseProductMessage(EXAMPLE).unit).toBeNull();
  });

  it("reads currencies", () => {
    expect(parseProductMessage("Bag\n฿450 wholesale").currency).toBe("THB");
    expect(parseProductMessage("Bag\n$12.50 wholesale").currency).toBe("USD");
    expect(parseProductMessage("Bag\nNGN 48000 wholesale").currency).toBe("NGN");
    expect(parseProductMessage("Bag\n450 baht wholesale").currency).toBe("THB");
    expect(parseProductMessage("Bag\n48,000 NGN wholesale").currency).toBe("NGN");
    expect(parseProductMessage("Bag\n48,000₦ wholesale").currency).toBe("NGN");
  });

  it("reads a hashtag or a Category line", () => {
    expect(parseProductMessage("Body mist\n48,000 wholesale\n#perfume").category).toBe("perfume");
    expect(parseProductMessage("Body mist #body_care\n48,000 wholesale")).toMatchObject({ name: "Body mist", category: "body care" });
    expect(parseProductMessage("Body mist\n48,000 wholesale\nCategory: Beauty & Care")).toMatchObject({ category: "Beauty & Care", notes: [] });
  });
});

describe("parseProductMessage: names and extra lines", () => {
  it("strips bullets and emoji from the start of the name", () => {
    expect(parseProductMessage("🔥 100ml Original sugar marshmallow\n48,000 wholesale").name).toBe("100ml Original sugar marshmallow");
    expect(parseProductMessage("- Body mist\n48,000 wholesale").name).toBe("Body mist");
  });

  it("keeps other lines as notes", () => {
    const parsed = parseProductMessage("Body mist\nColors: pink, white\n48,000 wholesale\nOriginal quality");
    expect(parsed.name).toBe("Body mist");
    expect(parsed.notes).toEqual(["Colors: pink, white", "Original quality"]);
  });

  it("works with Thai names and Thai digits", () => {
    const parsed = parseProductMessage("กระเป๋าหวาย\n๔๘,๐๐๐ wholesale");
    expect(parsed.name).toBe("กระเป๋าหวาย");
    expect(parsed.wholesale).toBe(48000);
  });

  it("limits very long names", () => {
    const parsed = parseProductMessage(`${"a".repeat(500)}\n3,000 wholesale`);
    expect(parsed.name).toHaveLength(160);
  });

  it("never throws on odd input", () => {
    for (const input of ["", "   ", "\n\n", "48,000", "wholesale", "####", "₦₦₦", "1-2-3-4", "a".repeat(5000), "0 wholesale", "99999999999999999999 wholesale"]) {
      expect(() => parseProductMessage(input)).not.toThrow();
    }
    const empty = parseProductMessage("");
    expect(empty.name).toBe("");
    expect(empty.warnings).toEqual(["No price was found."]);
  });

  it("returns no name when the message is only prices", () => {
    expect(parseProductMessage("48,000 wholesale\n55,000 resell")).toMatchObject({ name: "", wholesale: 48000, resellLow: 55000 });
  });
});

describe("parseProductMessage: real chat styles", () => {
  it("reads # and N as the naira sign, but not as a hashtag or a model number", () => {
    expect(parseProductMessage("Body mist\n#48,000 wholesale\n#55,000-60,000 resell")).toMatchObject({ category: null, wholesale: 48000, resellLow: 55000, resellHigh: 60000, currency: "NGN" });
    expect(parseProductMessage("Body mist\nN48,000 wholesale")).toMatchObject({ wholesale: 48000, currency: "NGN" });
    expect(parseProductMessage("Sachet\nN500 wholesale")).toMatchObject({ wholesale: 500, currency: "NGN" });
    expect(parseProductMessage("Sachet\nwholesale: #500")).toMatchObject({ wholesale: 500, currency: "NGN" });
    expect(parseProductMessage("N95 face mask\nN2,500 wholesale")).toMatchObject({ name: "N95 face mask", wholesale: 2500 });
    expect(parseProductMessage("Lot #12 scarves\n3,000 wholesale")).toMatchObject({ name: "Lot #12 scarves", wholesale: 3000, currency: null });
  });

  it("reads a message full of emoji", () => {
    const parsed = parseProductMessage("🔥🔥 NEW ARRIVAL 🔥🔥\nVictoria's Secret Love Spell Body Mist 250ml\n💰 Wholesale: ₦65,000\n💰 Resell: ₦75,000–85,000\n📦 MOQ: 6");
    expect(parsed.name).toBe("Victoria's Secret Love Spell Body Mist 250ml");
    expect(parsed.notes).toEqual([]);
    expect(parsed).toMatchObject({ wholesale: 65000, resellLow: 75000, resellHigh: 85000, moq: 6, currency: "NGN" });
  });

  it("keeps a banner line as the name when it is all the message has", () => {
    expect(parseProductMessage("NEW ARRIVAL\n3,000 wholesale").name).toBe("NEW ARRIVAL");
  });

  it("drops trailing emoji from the name", () => {
    expect(parseProductMessage("Body mist 100ml ✨🔥\n3,000 wholesale").name).toBe("Body mist 100ml");
  });

  it("reads labels with the currency sign attached", () => {
    const parsed = parseProductMessage("Dubai abaya\nWholesale price:₦25,000\nRetail price:₦30,000");
    expect(parsed).toMatchObject({ name: "Dubai abaya", wholesale: 25000, resellLow: 30000, currency: "NGN" });
  });

  it("reads Thai labels and baht", () => {
    const parsed = parseProductMessage("สบู่มะพร้าว\nราคาส่ง 450 บาท\nราคาปลีก 600 บาท");
    expect(parsed).toMatchObject({ name: "สบู่มะพร้าว", wholesale: 450, resellLow: 600, currency: "THB" });
    expect(parsed.warnings).toEqual([]);
  });

  it("reads a set count in the name and a grouped price", () => {
    expect(parseProductMessage("3pcs set sunglasses 7,500")).toMatchObject({ name: "3pcs set sunglasses", wholesale: 7500 });
  });

  it("reads item codes and dealer prices in baht", () => {
    const parsed = parseProductMessage("Item code: TH-1042\nRattan basket\nWholesale 450 baht");
    expect(parsed).toMatchObject({ wholesale: 450, currency: "THB", name: "Item code: TH-1042", notes: ["Rattan basket"] });
  });
});

describe("money text", () => {
  it("formats amounts like the storefront", () => {
    expect(formatAmount(48000, "NGN")).toBe("₦48,000");
    expect(formatAmount(12.5, "USD")).toBe("$12.50");
    expect(formatAmount(450, "THB")).toBe("฿450");
    expect(formatAmount(10, "EUR")).toBe("EUR 10");
  });

  it("formats a resale range or a single price", () => {
    expect(formatResellRange(55000, 60000, "NGN")).toBe("₦55,000 – ₦60,000");
    expect(formatResellRange(55000, 55000, "NGN")).toBe("₦55,000");
  });

  it("builds the description from the extra lines only, never from the resell range", () => {
    const parsed = parseProductMessage("Body mist\nColors: pink, white\n48,000 wholesale\n55,000-60,000 resell");
    expect(parsed.resellLow).toBe(55000);
    expect(describeParsed(parsed)).toBe("Colors: pink, white");
    expect(describeParsed(parseProductMessage("Body mist\n48,000 wholesale\n55,000-60,000 resell"))).toBe("");
  });
});
