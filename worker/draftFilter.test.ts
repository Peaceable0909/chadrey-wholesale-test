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
    "Wholesale: 48,000",
    "55,000-60,000 resell",
    "Retail 55,000",
    // orders and quantities
    "Minimum order 500 pieces.",
    "MOQ applies.",
    "Bulk orders welcome",
    "Available in bulk, order at least 100 units.",
    "Quantity: 24 pcs per carton at 48000 per carton",
    "Sold in cartons of 24.",
    "Sold per carton of 24 pieces.",
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
    // found by the second independent review: price forms
    "A sticker on the box reads N48k.",
    "The tag shows N48.5k.",
    "A tag says #48,000.",
    "A handwritten label says #48000.",
    "The tag reads N-48000.",
    "The label shows N 48 000.",
    "The label is printed 48000/-.",
    "The sticker says 48,000/-.",
    "The label says 120/pc.",
    "The label shows 48k/pc.",
    "Tag: 5,000 a dozen.",
    "Tag: 5,000/dozen.",
    "The sticker says 2 for 5,000.",
    "The tag reads Rp 50.000.",
    "The tag reads MYR 50.",
    "The tag reads SGD 20.",
    "The tag reads KRW 12000.",
    "Valued at 5,000 per set.",
    "Only 5,000.",
    // offers and order sizes
    "Buy 3 get 1 free.",
    "Buy one get one.",
    "Free gift with every set.",
    "Min. 24 pcs.",
    "Min 24 pcs per colour.",
    "Order 24 or more.",
    "Order 24+ pieces.",
    "24 pcs and above.",
    // stock and delivery times
    "Only a few pieces left.",
    "Last pieces.",
    "Limited pieces.",
    "Selling fast.",
    "We have 500 pcs on hand.",
    "Coming soon.",
    "Arrives in 3-5 days.",
    "Ready in 7 days.",
    "Production time 7-10 days.",
    "Takes 7 to 10 days to make.",
    "COD accepted.",
    "FOB Bangkok.",
    "Send to your door by air or sea.",
    // ways to get in touch
    "Line: abc123",
    "IG: myshop",
    "Wechat: abc123",
    "Contact: Somchai",
    "DM for details.",
    "DM to order.",
    "Inbox me.",
    "Chat with us.",
    "Call now.",
    "Scan the QR code to follow.",
    "Follow our page.",
    "Subscribe to our channel.",
    "Call (555) 123-4567.",
    "Call 081 - 234 - 5678.",
    "Call (081) 234 5678.",
    "Visit linktr.ee/myshop",
    "Order at myshop.in",
    "Order at myshop.de",
    "Order at myshop.hk",
    "Order at myshop.tech",
    "Weixin: abc123",
    // compliance claims
    "ISO 9001 compliant.",
    "CE marked.",
    "RoHS compliant.",
    "BPA-free.",
    "Halal.",
    "Dermatologically tested.",
    "Lab tested.",
    "Money-back promise.",
    "Free replacement if damaged.",
    "Returns accepted within 7 days.",
    "100% authentic.",
  ])("catches: %s", text => {
    expect(mayNotSay(text)).toBe(true);
  });

  // Ordinary product sentences must get through, or the descriptions would be gutted.
  it.each([
    "A quilted lunch bag with two zip compartments and a padded top handle.",
    "It is shown in beige, black, pink and blue.",
    "Two zip compartments",
    "Removable shoulder strap",
    "A 100ml bottle of shea butter hand cream, with 24 pieces in the display box.",
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
    // ordinary words the first version wrongly dropped (found by the second independent review)
    "Wholesale buyers will like the set of 6 cups.",
    "Ideal for boutiques, retailers and gift shops.",
    "Perfect for wholesale buyers who need a classic everyday tote.",
    "Comes in retail packaging with a branded hang tag.",
    "Great for resellers.",
    "Just 25 cm wide, it fits easily under the arm.",
    "A lightweight shoulder bag, only 300 g.",
    "Only 2 drops are needed per use.",
    "Requires 2 AA batteries only.",
    "Weighs just 250 g, easy to carry.",
    "Sizes 36 38 40 42 44 are shown on the label.",
    "Size chart: 38 40 42 44 46 48.",
    "Supports USB Power Delivery for fast charging.",
    "Supports PD (Power Delivery) fast charging up to 20W.",
    "Colourful pirate ship toy for ages 3 and up.",
    "Ships flat for easy storage.",
    "Comes in boxes of 100 each.",
    "Building blocks, 100 pieces per set.",
    "10,000mAh power bank with two USB ports and a digital display.",
    "Refresh rate 120 Hz.",
    "Sample rate 48 kHz.",
    "Takes 3 hours to charge fully.",
    "Battery lasts up to 7 days.",
    "Cod fish crackers in a 50g pack.",
    "Item no. 5083 in the range.",
    "Item #1 in the range.",
    "Pantone #2 shade.",
    "Order 2 sizes up if you prefer a looser fit.",
    "Pick up the pen with ease.",
    "Keep your essentials on hand.",
    "Fits 6.7 inch phones.",
    "Mobile phone holder with a flexible neck.",
    "A-line dress with 3/4 sleeves.",
    "Sizes S/M/L/XL.",
    "Dimensions 20/15/10 cm.",
    "Made in Thailand.",
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

  it("removes links and email addresses, sentence by sentence", () => {
    expect(cleanDescription("A soft bag with a zip. See https://evil.example/x or mail me@evil.example. Padded handle.")).toBe("A soft bag with a zip. Padded handle.");
  });

  it("does not let invisible characters hide what a line says: a phone number split by zero-width spaces, or words glued together", () => {
    // The line goes, because it says what it may not once the invisible characters are read either as nothing or as spaces. Its neighbours stay.
    expect(cleanDescription("A soft bag with a zip.\nCall 08\u200b012\u200b345678 now.\nPadded handle.")).toBe("A soft bag with a zip.\nPadded handle.");
    expect(cleanDescription("A soft bag with a zip.\nFree\u200bshipping on every order.\nPadded handle.")).toBe("A soft bag with a zip.\nPadded handle.");
    expect(cleanDescription("A soft bag with a zip.\nPri\u200bce: twelve.\nPadded handle.")).toBe("A soft bag with a zip.\nPadded handle.");
    // Invisible characters on their own are just removed.
    expect(cleanDescription("A soft\u200b bag with a zip.")).toBe("A soft bag with a zip.");
  });

  it("does not end a sentence after an abbreviation, so 'Min. 24 pcs' is seen whole", () => {
    expect(cleanDescription("A soft bag with a zip. Min. 24 pcs. Padded handle.")).toBe("A soft bag with a zip. Padded handle.");
    expect(cleanDescription("Measures approx. 20 cm wide. Item No. 5083 in the range.")).toBe("Measures approx. 20 cm wide. Item No. 5083 in the range.");
  });

  it("removes characters that cannot be seen: zero-width, right-to-left overrides, hidden tag characters, control characters", () => {
    const hidden = "A‮ quilted​ bag\u0007 with\ud800 a zip.\u{E0041}";
    expect(cleanDescription(hidden)).toBe("A quilted bag with a zip.");
    expect(tidy("a\u0085b\u009bc\u2028d", 100)).toBe("a b c" + "d");
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

  it("is refused when it has a price or a number to call in it", () => {
    expect(cleanName("Lunch Bag ₦5,000 In Stock")).toBe("");
    expect(cleanName("Lunch Bag - call 08012345678")).toBe("");
    expect(cleanName("Lunch Bag N48,000")).toBe("");
  });

  it("keeps the rest of a name when ONE ordinary word in it is the problem", () => {
    expect(cleanName("Stainless Steel Stock Pot")).toBe("Stainless Steel Pot");
    expect(cleanName("Bulk Storage Container Set")).toBe("Storage Container Set");
    expect(cleanName("Available Lunch Bag")).toBe("Lunch Bag");
    // Words that are fine on their own stay.
    expect(cleanName("Wholesale Lunch Box")).toBe("Wholesale Lunch Box");
    expect(cleanName("Pirate Ship Toy Set")).toBe("Pirate Ship Toy Set");
    expect(cleanName("Retail Display Stand")).toBe("Retail Display Stand");
    expect(cleanName("Sizes 36 38 40 42 44 Sneakers")).toBe("Sizes 36 38 40 42 44 Sneakers");
    // Two problems, or a name that is nothing but the problem, are not worth keeping.
    expect(cleanName("Stock Bulk Pot")).toBe("");
    expect(cleanName("In Stock")).toBe("");
    expect(cleanName("Free\u200bshipping Lunch Bag")).toBe("");
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
    expect(cleanShort("Min. 24 pcs, ships worldwide")).toBe("");
    expect(cleanShort("A soft lunch bag.\u200b")).toBe("A soft lunch bag.");
    expect(cleanShort("Free\u200bshipping")).toBe("");
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
