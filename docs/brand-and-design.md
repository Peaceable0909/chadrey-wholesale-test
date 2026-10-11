# The Chadrey look

The site uses the Chadrey logo's two colours: **orange** for the things a buyer should do, **deep navy** for everything else
that carries meaning (text, navigation, the footer). Pages and cards are white.

## Colours

| Name | Value | Where it is used |
| --- | --- | --- |
| Chadrey orange | `#FF7014` | Buttons (Request a quote, Add product), the selected category, "New" tags. Always a **background**, with navy text on it. |
| Deep navy | `#071C3B` | Headings, product names, prices, navigation, the footer, the label on every orange button. |
| White | `#FFFFFF` | Page background of the shop front and every card. |
| Soft grey | `#F4F6F9` | The background behind grouped lists (account, admin) and quiet fills such as photo frames. |
| Muted slate | `#586579` | Secondary text: categories, MOQ, helper text. |
| Deep orange | `#AD4100` | Small orange **text**: links, "Clear all filters", the current admin menu item. |
| Borders | `#DDE3EC` (cards, dividers), `#8793A5` (search box and select boxes, so they are easy to see) | |

### Why the buttons have navy text

White text on `#FF7014` has a contrast of only **2.8 : 1** (the web accessibility rules ask for 4.5 : 1), so it is hard to
read for many people and a Lighthouse accessibility check flags it. Navy on the same orange is **6.1 : 1**, and it is the
same pairing the logo uses. Orange used as small text on white has the same problem, which is why links use the deeper
`#AD4100` (5.9 : 1). Orange is never used on its own to show a state.

Other contrast figures: navy on white 17.0 : 1, muted slate on white 5.9 : 1, muted slate on soft grey 5.5 : 1.
Dark mode (the phone's dark setting) uses navy surfaces `#07172E` / `#0C2142`, off-white text and the same orange.

## Where to change it

* `client/src/index.css`, section 1 ("Tokens"): every colour, for light and dark mode. Change a colour there and the whole
  site follows. Section 2 gives the colours their names (`bg-tint`, `text-label`, `text-on-tint` ...).
* `client/src/components/ios/` holds the shared pieces (buttons, chips, search box, sheets). `Button` has the orange
  `filled` look (the default), `navy`, `outline`, `gray`, `plain`, and `light`/`glass` for use on navy.
* `client/src/components/store/ProductCard.tsx` is the product tile used on the Products page, the home page and
  "More in this category". `QuickView.tsx` is the preview window. `client/src/pages/Catalogue.tsx` is the page.
* `client/src/lib/catalogueView.ts` holds the small rules behind it (which filters are active, how a photo is fitted, how
  "4 colors · 3 sizes" is worked out), with tests.

## The logo

`client/src/components/ios/Logo.tsx` draws the logo as a vector, so it is sharp at every size: the cart-shaped "C" keeps its
orange gradient and the word "hadrey" takes the text colour (navy on white, white on navy and in dark mode).

> The logo was supplied as a picture in a chat, not as a file, so this vector is a redraw made by eye from that picture.
> If you have the original in a vector format (SVG, PDF or AI), put it in the project and replace the drawing in
> `Logo.tsx` (keep the `Logo` and `LogoMark` names). The browser icon (`client/public/favicon.svg`) and the app icons
> (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) were made from the same mark.

## Rules the screens follow

* **One orange action per area.** Navy, outline or grey buttons for everything else.
* Nothing important only shows on hover: the heart, quick view and Request quote buttons are always visible and at least
  40 px, so they work on a phone.
* Cards have a fine border and 12 px corners, with no heavy shadows. Product photos sit in a square frame: a photo that is
  about square fills it, any other shape is shown whole (never cut off or stretched).
* Prices and minimum orders come from the product itself. A product with no price says "Price on request".
* Green and red remain only where they mean something (a paid status, an error).

## Checking it

The accessibility audit used `axe-core` (WCAG 2.x A and AA) on 52 page and screen-size combinations, light and dark: no
violations. Lighthouse on the Products page (phone settings, simulated slow 4G): accessibility 100, best practices 100,
SEO 100, performance 84 to 89 (about 100 on desktop). Automated checks do not catch everything: please also look at the
site on a real phone.
