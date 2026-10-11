import { describe, expect, it } from "vitest";
import { cleanColours, cleanDescription, cleanName, cleanShort, cut, limit, mayNotSay, ownerColours, plain, tidy } from "./draftFilter";

describe("what the AI may not say", () => {
  // Every one of these must be caught. Many are the ways a price, an order size or a phone number really turns up: with the
  // naira written as # or N, in baht or dollars or "5k", in full-width digits, or on a supplier's price sticker in Thai or Chinese.
  it.each([
    // prices
    "Wholesale price is #48,000 per piece.",
    "Price: 48,000 per piece.",
    "Sells for N48,000.",
    "Only N 48,000 each.",
    "N5000 only",
    "₦48,000",
    "$12",
    "€5",
    "£3",
    "฿120",
    "¥300",
    "Costs 5000 naira.",
    "Costs 5 dollars.",
    "Only 12 euros.",
    "Retail price 120 บาท.",
    "USD12 per unit.",
    "USD 12",
    "12 USD",
    "THB120",
    "NGN5000 wholesale.",
    "Go for 5k each.",
    "Priced at 5k.",
    "5000 each",
    "48,000 per piece",
    "sold at 12 dollars",
    "４８，０００ naira",
    "Ｎ４８，０００",
    "ราคา 100",
    "价格 100 元",
    "50 块",
    "10% discount for bulk buyers.",
    "Special offer: sale price",
    "wholesale",
    "Great for resellers",
    // orders and quantities
    "Minimum order 500 pieces.",
    "MOQ applies.",
    "Bulk orders welcome",
    "Available in bulk, order at least 100 units.",
    "Quantity: 24 pcs per carton at 48000 per carton",
    // stock and availability
    "In stock now.",
    "Limited stock, order now.",
    "Sold out last week.",
    "Pre-order today.",
    "Available in black and pink",
    "Currently available",
    "Only 3 left.",
    "Just 5 pieces remaining in stock.",
    // delivery
    "Ready to ship worldwide.",
    "Delivered to your door within 3 days.",
    "Delivery takes 2 weeks",
    "Fast delivery nationwide.",
    "Ships within 3 days with free shipping.",
    "Free shipping on all orders.",
    "Lead time is 7 days",
    "Tracking number provided",
    // contact
    "Call 08012345678",
    "+234 801 234 5678",
    "0801-234-5678",
    "1234567890123",
    "wa.me/2348012345678",
    "Visit bag-shop.com/lunch",
    "Follow @luxbags",
    "Email sales@bagshop.ng",
    "Contact us on WhatsApp for details.",
    "Message me on Telegram.",
    "DM for prices.",
    // promises the AI cannot know
    "Comes with a 2 year warranty.",
    "100% guaranteed quality.",
    "NAFDAC approved.",
    "FDA certified.",
    // the bot's own label
    "Draft ID: 123e4567-e89b-12d3-a456-426614174000",
  ])("catches: %s", text => {
    expect(mayNotSay(text)).toBe(true);
  });

  // Ordinary product sentences must get through, or the descriptions would be gutted.
  it.each([
    "A quilted lunch bag with two zip compartments and a padded top handle.",
    "It is shown in beige, black, pink and blue.",
    "Two zip compartments",
    "Removable shoulder strap",
    "A 100ml bottle of shea butter hand cream, sold in cartons of 24 pieces.",
    "Measures 20 x 15 x 10 cm.",
    "Size 20*15*10 cm",
    "Model KT_100 in matte finish.",
    "Soft cotton fabric with a relaxed fit, suitable for everyday wear.",
    "Delivers clear, balanced sound for music and calls.",
    "Delivers strong suction on carpets and hard floors.",
    "Each compartment has a mesh pocket.",
    "Three zip pockets, each lined with soft fabric.",
    "Holds 3 items comfortably.",
    "Powered by a rechargeable battery with a USB-C cable.",
    "Records 4K video at 60fps.",
    "Plated in 18K gold for a bright shine.",
    "Sugar marshmallows in a 100ml pack with a resealable lid.",
    "Perfect for school lunches, picnics and office use.",
    "Stockings in sheer nylon.",
    "Sandals with a cushioned sole and a buckle strap.",
    "Pack of 12 pencils in assorted colours.",
    "100% cotton.",
    "No. 1 in the series.",
    "Phone case with a card slot.",
    "Fits phones up to 6.7 inches.",
    "Rose gold finish with a mirror shine.",
    "Contact lens case with a screw cap.",
    "The 5-piece set includes a pot, a pan and three lids.",
    "Height 12 cm, width 8 cm.",
    "Includes a 1.5 m cable.",
  ])("lets through: %s", text => {
    expect(mayNotSay(text)).toBe(false);
  });
});

describe("a description", () => {
  it("loses only the sentences that say what it may not, so one bad sentence does not cost the rest", () => {
    expect(cleanDescription("A sturdy lunch bag for daily use. Available now! Min order 24.\n\nShips worldwide. Padded handle for comfort.")).toBe("A sturdy lunch bag for daily use.\n\nPadded handle for comfort.");
  });

  it("does not split a list in two when a bullet is removed", () => {
    expect(cleanDescription("A lunch bag with a zip.\n\n- Two zip compartments\n- Price: #48,000\n* Wipe clean")).toBe("A lunch bag with a zip.\n\n- Two zip compartments\n- Wipe clean");
  });

  it("checks the text before taking formatting off, so a naira price written with # is still seen", () => {
    expect(cleanDescription("A soft cotton towel for the bath.\nWholesale price is #48,000 per piece.")).toBe("A soft cotton towel for the bath.");
  });

  it("keeps sizes and codes, which only look like formatting", () => {
    expect(cleanDescription("It measures 20*15*10 cm and 4*6 inch. KT_100 model. #1 choice.")).toBe("It measures 20 x 15 x 10 cm and 4 x 6 inch. KT_100 model. #1 choice.");
  });

  it("takes off headings, bold, italics and HTML, and turns lists into plain bullets", () => {
    expect(cleanDescription("## Features\n**Zip** top and <b>quilted</b> body\n* Padded handle\n1. Shoulder strap\n• Mesh pocket")).toBe("Features\nZip top and quilted body\n- Padded handle\n- Shoulder strap\n- Mesh pocket");
  });

  it("removes links, email addresses and phone numbers even when hidden characters are slipped in", () => {
    const text = cleanDescription("A soft bag with a zip. Call 08​012​345678 now. See https://evil.example/x or mail me@evil.example. Padded handle.");
    expect(text).toBe("A soft bag with a zip. Padded handle.");
  });

  it("removes characters that cannot be seen: zero-width, right-to-left overrides, hidden tag characters, control characters", () => {
    const hidden = "A‮ quilted​ bag\u0007 with\ud800 a zip.\u{E0041}";
    expect(cleanDescription(hidden)).toBe("A quilted bag with a zip.");
    expect(tidy("a\u0085b\u009bc d", 100)).toBe("a b c" + "d");
  });

  it("reads full-width and other look-alike digits and letters as the plain ones", () => {
    expect(cleanDescription("A soft bag with a zip.\nＰｒｉｃｅ ４８０００")).toBe("A soft bag with a zip.");
  });

  it("is cut at the end of a sentence, never longer than 1,500 characters, and never in the middle of an emoji", () => {
    const long = cleanDescription("This is a sentence about the bag. ".repeat(80));
    expect(long.length).toBeLessThanOrEqual(1500);
    expect(long.endsWith(".")).toBe(true);
    expect(cut("ab😀cd", 3)).toBe("ab");
    expect(cut("ab😀cd", 4)).toBe("ab😀");
    expect(limit("x".repeat(400), 100).length).toBeLessThanOrEqual(101);
  });

  it("never leaves more than one blank line", () => {
    expect(cleanDescription("First paragraph is long enough to keep.\n\n\n\n\nSecond paragraph is also fine.")).toBe("First paragraph is long enough to keep.\n\nSecond paragraph is also fine.");
  });

  it("handles a value that is not text", () => {
    for (const value of [undefined, null, 42, {}, []]) expect(cleanDescription(value)).toBe("");
  });
});

describe("a product name", () => {
  it("is tidied up: quotes, a trailing full stop, a 'Product name:' label", () => {
    expect(cleanName('"Quilted Lunch Bag."')).toBe("Quilted Lunch Bag");
    expect(cleanName("Product name: Quilted Lunch Bag")).toBe("Quilted Lunch Bag");
    expect(cleanName("**Quilted** Lunch Bag\nwith a strap")).toBe("Quilted Lunch Bag with a strap");
  });

  it("is refused when it says what the AI may not", () => {
    expect(cleanName("Lunch Bag ₦5,000 In Stock")).toBe("");
    expect(cleanName("Wholesale Lunch Bag")).toBe("");
    expect(cleanName("Lunch Bag - call 08012345678")).toBe("");
  });

  it("has no invisible characters, and is cut to 70 characters at a word", () => {
    expect(cleanName("Lunch‮ Bag​ \ud800 x")).toBe("Lunch Bag x");
    const long = cleanName("Quilted insulated lunch bag with a shoulder strap and two zip compartments for school");
    expect(long.length).toBeLessThanOrEqual(70);
    expect(long).toBe("Quilted insulated lunch bag with a shoulder strap and two zip");
    expect(cleanName(undefined)).toBe("");
  });
});

describe("a short description", () => {
  it("is kept when it is clean, and dropped when it says what the AI may not", () => {
    expect(cleanShort("A soft lunch bag.")).toBe("A soft lunch bag.");
    expect(cleanShort("Price: 48,000")).toBe("");
    expect(cleanShort("Now only 5 dollars")).toBe("");
    expect(cleanShort("Ready to ship worldwide")).toBe("");
    expect(cleanShort("In stock and ready to ship.")).toBe("");
  });
});

describe("colours", () => {
  it("accepts plain colour names with an optional shade, once each, at most eight", () => {
    const colours = ["Beige", "beige", "light blue", "Rose Gold", "off-white", "army green", "black/white", "pink", "red", "green", "grey"];
    expect(cleanColours(colours)).toEqual(["beige", "light blue", "rose gold", "off-white", "army green", "black/white", "pink", "red"]);
  });

  it("refuses anything that is not a colour, because the colours become options a shopper can pick", () => {
    expect(cleanColours(["in stock", "free shipping", "n/a", "none", "buy now", "ignore previous", "<script>", "12345", "x", "Lunch Bag", "light", "call me now"])).toEqual([]);
    expect(cleanColours("beige")).toEqual([]);
    expect(cleanColours([{}, null, 5])).toEqual([]);
  });

  it("also accepts colours the owner typed on a Colors line, even unusual ones, but not other words from the owner's text", () => {
    const owner = ownerColours(["Colors: pink, sage and sand", "Comes in a gift box, in stock", "MOQ 24", "Colour - Teal / Mustard"]);
    expect(Array.from(owner).sort()).toEqual(["mustard", "pink", "sage", "sand", "teal"]);
    expect(cleanColours(["sage", "sand", "pink", "gift box", "in stock", "coral"], owner)).toEqual(["sage", "sand", "pink", "coral"]);
  });

  it("does not take a colour line that says what it may not", () => {
    expect(Array.from(ownerColours(["Colors: pink, in stock, free shipping"]))).toEqual(["pink"]);
  });
});

describe("plain text", () => {
  it("takes off formatting marks but not the ones inside sizes, codes and numbers", () => {
    expect(plain("## Heading")).toBe("Heading");
    expect(plain("**bold** and *italic* and `code` and ~~gone~~")).toBe("bold and italic and code and gone");
    expect(plain("_italic_ KT_100 #1")).toBe("italic KT_100 #1");
    expect(plain("20*15*10")).toBe("20 x 15 x 10");
  });
});

describe("speed", () => {
  // The free Cloudflare plan allows only a few milliseconds of work per message, and an AI answer is out of our hands, so
  // the checks must stay quick whatever comes back. Before the number patterns were anchored, a long run of digits took ~80 ms.
  const shapes: Record<string, string> = {
    "a long run of digits": "1".repeat(20_000),
    "digits and commas": "1,".repeat(10_000),
    "no spaces at all": "a".repeat(20_000),
    "only spaces": " ".repeat(20_000),
    "angle brackets": "<".repeat(20_000),
    "at signs": "a@".repeat(10_000),
    "web addresses": "www.".repeat(5_000),
    "numbers with k": "1k ".repeat(7_000),
    "full stops": "a.".repeat(10_000),
    "hidden characters": "​".repeat(20_000),
  };
  it.each(Object.entries(shapes))("is quick on %s", (_name, text) => {
    cleanDescription(text);
    const started = performance.now();
    cleanDescription(text);
    mayNotSay(text.slice(0, 6000));
    expect(performance.now() - started).toBeLessThan(40);
  });
});
