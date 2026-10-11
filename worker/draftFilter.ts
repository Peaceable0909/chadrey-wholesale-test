/*
 * Keeps what the AI writes fit to put on a product page.
 *
 * The question sent to the AI already says what it may not write. This is the safety net for when it does anyway, or when
 * words printed on a supplier's photo make it: prices, order sizes, stock, delivery, contact details and promises are removed,
 * one sentence at a time, so a single bad sentence does not cost the whole draft. It cannot catch everything, which is why
 * every draft stays hidden until a person has read it.
 *
 * Text is checked BEFORE any formatting is stripped ("#48,000" is a naira price, and the "#" must still be there to see it).
 */

// --- Safe text ----------------------------------------------------------------------------------------------------------

/** Cuts to at most `max` characters without leaving half of a two-part character (an emoji, say) at the end. */
export function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, (text.charCodeAt(max - 1) & 0xfc00) === 0xd800 ? max - 1 : max);
}

/** Cuts at the end of a sentence (or at a word) near the limit rather than in the middle of one. */
export function limit(text: string, max: number): string {
  if (text.length <= max) return text;
  const cutText = cut(text, max);
  const sentence = Math.max(cutText.lastIndexOf(". "), cutText.lastIndexOf(".\n"));
  if (sentence > max * 0.5) return cutText.slice(0, sentence + 1).trim();
  const space = cutText.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cutText.slice(0, space) : cutText).trim()}…`;
}

/** Zero-width and right-to-left control characters, hidden "tag" characters and stray halves of characters: invisible to the person checking a draft. */
const HIDDEN = /[\p{Cf}\p{Cs}\u2028\u2029]/gu;
/** Control characters other than the new line. */
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;
const HTML_TAG = /<\/?[A-Za-z!][^<>]{0,200}>/g;

/** One field of the AI's answer, made safe to look at: a sane length first, then without invisible characters, control characters or HTML tags. New lines are kept. */
export function tidy(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return cut(value, max).replace(/\r\n?/g, "\n").replace(HIDDEN, "").replace(CONTROL, " ").replace(HTML_TAG, " ");
}

/** Plain words: formatting marks removed, but not the ones that are part of a size or a code ("20*15*10 cm", "KT_100", "#1"). */
export function plain(value: string): string {
  return value
    .replace(/^\s*#{1,6}\s+/, "") // "## Heading"
    .replace(/(\d)\s*\*\s*(?=\d)/g, "$1 x ") // "20*15*10" is a size, not emphasis
    .replace(/[*`]+|~~/g, "") // **bold**, *italic*, `code`, ~~strike~~
    .replace(/(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, "") // _italic_ but not KT_100
    .replace(/\s+/g, " ")
    .trim();
}

// --- What the AI may not say --------------------------------------------------------------------------------------------

/** Dollar, pound, euro, naira, baht, yen and the other money signs. */
const CURRENCY_SIGN = /[$¢£¤¥฿₠-₿﷼]/;
const CODES = "ngn|usd|thb|eur|gbp|cny|rmb|cad|aud|zar|ghs|kes|jpy|inr|aed";

const MONEY = new RegExp(
  [
    `(?<![a-z])(?:${CODES})\\s?\\d`, // NGN5000, USD 12
    `\\d[\\d,.]{0,15}\\s?(?:${CODES})(?![a-z])`, // 5000 NGN
    "(?<![a-z\\d])n\\s?(?:\\d{1,3}(?:,\\d{3})+|\\d{3,})", // N48,000 and N 5000: the naira sign the way people type it
    "\\b(?:for|at|only|just|from|costs?|priced?|sells?|sold|goes?|worth)\\s+\\d+(?:\\.\\d+)?\\s?k(?![a-z\\d])", // "for 5k"
    "(?<![\\d.])\\d+(?:\\.\\d+)?\\s?k\\s*(?:each|apiece|per\\b|only|naira|ngn)", // "5k each" (only from the start of a number, so a very long run of digits stays quick)
    "\\b(?:naira|baht|dollars?|euros?|yuan|rmb|kobo|cedis?|shillings?|dirhams?|rupees?|ringgit|pesos?|bucks)\\b",
    "บาท|ราคา|元|价|價|块|塊|円", // baht and "price" in Thai, yuan and "price" in Chinese, yen
  ].join("|"),
  "i",
);

const WORDS = new RegExp(
  `\\b(?:${[
    // Prices
    "prices?|priced|pricing|costs?|costing|discount\\w*|bargain\\w*|wholesale|retail\\w*|resell\\w*|resale|profit\\w*|margins?|on sale|for sale|sale price|payments?|refund\\w*|invoice\\w*|quotations?",
    // Orders and quantities
    "minimum|moq|min\\.? ?(?:order|qty|quantity)|(?:orders?|ordering) (?:now|today|online|more|here|in bulk|at least|min\\w*|quantity|qty|size|from|by|via|yours|direct)|(?:place|placing|bulk|pre|re|repeat|sample) ?-?orders?|quantity|quantities|qty|bulk|at least \\d+",
    // Stock and availability
    "available|availability|in[- ]?stock|out[- ]of[- ]stock|stock(?:s|ed|ist)?|restock\\w*|sold[- ]?out|limited (?:stock|supply|quantity|quantities|edition|offer|time)|while (?:stocks?|supplies) last|pre-?orders?|back-?orders?|in store|ready (?:to (?:ship|dispatch)|stock|for (?:shipping|dispatch|delivery))",
    // Shipping and delivery
    "ships?|shipped|shipping|shipments?|deliver(?:y|ies)|deliver(?:s|ed|ing)? (?:to|within|in \\d+|worldwide|nationwide|anywhere|by (?:air|sea|road|courier))|dispatch(?:ed|es|ing)?|courier|freight|nationwide|worldwide|door-?to-?door|lead[- ]?time|turnaround|tracking number",
    // Contact details and messaging apps
    "whats ?app|we ?chat|telegram|instagram|facebook|tiktok|snapchat|viber|line id|(?:contact|call|message|text|dm|email|e-mail|write to) (?:us|me)|get in touch|follow us|visit (?:us|our)|our (?:shop|store|website|web site|page|catalogue|catalog)|inquir\\w+|enquir\\w+",
    // Promises the AI cannot know
    "warrant(?:y|ies)|guarantee[ds]?|certified|certification|nafdac|fda|haccp",
    // The bot's own label for a draft, which must never be copied into a draft
    "draft id",
  ].join("|")})\\b`,
  "i",
);

/** A price per item: "5,000 each", "48000 per piece". Small numbers are fine ("3 pockets, each with a zip"). */
const MONEY_UNIT = /(?<![\d,.])\d[\d,.]{2,20}\s?k?\s*(?:each|apiece|a piece|per (?:piece|pc|pcs|unit|item|dozen))/i;
const ONLY_OR_JUST = /\b(?:only|just)\b/i;
/** Nine or more digits in a row, with the odd space, bracket or dash: a phone number, or a barcode. */
const PHONE = /\+?\d(?:[ ().-]?\d){8,}/;
const LINK = /(?:https?:\/\/|www\.)\S|\b[a-z0-9-]{1,63}\.(?:com|net|org|co|io|ng|shop|store|online|site|info|biz|me|app|xyz|top|cn|th|uk|us|ly|link|page|cc|tv|asia|club)\b/i;

function trips(text: string): boolean {
  return (
    CURRENCY_SIGN.test(text) ||
    MONEY.test(text) ||
    WORDS.test(text) ||
    MONEY_UNIT.test(text) ||
    PHONE.test(text) ||
    LINK.test(text) ||
    text.includes("@") ||
    (/\d/.test(text) && ONLY_OR_JUST.test(text))
  );
}

/**
 * True when a piece of text says something only the owner may say: a price, an order size, stock, delivery, a way to
 * get in touch, or a promise. Full-width and other look-alike characters are read as the plain ones they imitate.
 */
export function mayNotSay(text: string): boolean {
  if (trips(text)) return true;
  const folded = text.normalize("NFKC");
  return folded !== text && trips(folded);
}

// --- Cleaning each part of the answer -----------------------------------------------------------------------------------

const BULLET = /^\s*(?:[-*•–—]|\d{1,2}[.)])\s+/;
const sentencesOf = (line: string) => line.split(/(?<=[.!?…])\s+/);

/** Plain text with short paragraphs and "- " bullets, minus every sentence that says what it may not. */
export function cleanDescription(value: unknown): string {
  const lines = tidy(value, 6000)
    .split("\n")
    .flatMap(line => {
      // A blank line is a paragraph break and stays. A line that loses all its sentences disappears, so a list is not split in two.
      if (!line.trim()) return [""];
      const bullet = BULLET.test(line);
      const kept = sentencesOf(line.replace(BULLET, ""))
        .map(raw => ({ raw, text: plain(raw) }))
        .filter(({ raw, text }) => text && !mayNotSay(raw) && !mayNotSay(text))
        .map(({ text }) => text)
        .join(" ");
      return kept ? [bullet ? `- ${kept}` : kept] : [];
    });
  return limit(lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), 1500);
}

/** The AI's suggestion for a product name, or "" when it has none, or one that says what it may not. */
export function cleanName(value: unknown): string {
  const raw = tidy(value, 300).replace(/\n+/g, " ");
  const name = plain(raw)
    .replace(/^product name\s*:\s*/i, "")
    .replace(/^["'“”‘’`]+|["'“”‘’`.]+$/g, "")
    .trim();
  if (!name || mayNotSay(raw) || mayNotSay(name)) return "";
  if (name.length <= 70) return name;
  const shortened = cut(name, 70);
  const space = shortened.lastIndexOf(" ");
  return (space > 35 ? shortened.slice(0, space) : shortened).trim();
}

/** One short sentence, or "" when the AI's one is missing or says what it may not. */
export function cleanShort(value: unknown): string {
  const raw = tidy(value, 600).replace(/\n+/g, " ");
  const text = plain(raw);
  if (!text || mayNotSay(raw) || mayNotSay(text)) return "";
  return limit(text, 160);
}

// --- Colours -------------------------------------------------------------------------------------------------------------

const COLOUR_WORDS = new Set(
  "black white grey gray silver gold red pink orange yellow green blue purple violet brown beige cream ivory khaki tan navy teal turquoise cyan aqua maroon burgundy magenta lavender lilac mint olive lime coral peach salmon nude camel coffee chocolate charcoal mustard rust copper bronze apricot sand champagne denim indigo plum fuchsia transparent clear multicolor multicolour multicolored multicoloured rose wine".split(" "),
);
const COLOUR_SHADES = new Set("light dark pale deep bright baby hot neon pastel soft warm cool army royal sky off milk matte".split(" "));

/** Colours the owner typed on a "Colors: pink, white, sage" line. The AI may repeat those even when they are not everyday colour names. */
export function ownerColours(notes: string[]): Set<string> {
  const found = new Set<string>();
  for (const line of notes) {
    const match = /^\s*colou?rs?\s*[:=–-]\s*(.{1,200})$/i.exec(line);
    if (!match) continue;
    for (const part of match[1].split(/\s*(?:[,;/&+]|\band\b|\bor\b)\s*/i)) {
      const colour = part.trim().toLowerCase();
      if (/^[a-z][a-z -]{1,23}$/.test(colour) && !mayNotSay(colour)) found.add(colour);
    }
  }
  return found;
}

/**
 * The colours to put on a product: only plain colour names (optionally with a shade, like "light blue"), or colours the owner
 * typed. The colours become options a shopper can pick, so nothing else may get through ("in stock", "n/a", "buy now").
 */
export function cleanColours(value: unknown, owner: ReadonlySet<string> = new Set()): string[] {
  const colours: string[] = [];
  if (!Array.isArray(value)) return colours;
  for (const entry of value.slice(0, 24)) {
    const colour = plain(tidy(entry, 60).replace(/\n+/g, " ")).toLowerCase();
    if (!/^[a-z][a-z /-]{1,23}$/.test(colour) || mayNotSay(colour)) continue;
    const words = colour.split(/[\s/-]+/).filter(Boolean);
    const everyday = words.length <= 3 && words.every(word => COLOUR_WORDS.has(word) || COLOUR_SHADES.has(word)) && words.some(word => COLOUR_WORDS.has(word));
    if ((everyday || owner.has(colour)) && !colours.includes(colour)) colours.push(colour);
    if (colours.length === 8) break;
  }
  return colours;
}
