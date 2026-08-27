# Chadrey Wholesale Quote Workflow and Admin Layout Plan

## Executive assessment

The current experience is disorganized because it mixes **catalogue content, editing controls, and operational detail at the same visual level**. On the admin products page, a large product image and the entire long description determine the height of the product card. The edit form then appears below the product content, which forces the administrator to scroll through a full product presentation before reaching the fields and save controls. The page is acting simultaneously as a product detail page, a catalogue list, and an editor.

The customer quote form has a related problem. It presents generic hardcoded product options and assumes that every product has colors, sizes, packaging, and customization values. It does not yet use the product's own uploaded images, and its current submission contract does not reliably preserve all line notes and customer requirements. The redesign should make a quote a structured request with a clear human brief, while allowing product-specific fields to disappear when they are not relevant.

> **Design principle:** Show only the decisions relevant to the selected product, then provide a large, unmistakable space for anything outside the predefined options.

## 1. Proposed customer quote flow

The customer should enter the quote flow from **Request a Quote**, a product detail page, or a product card. If they start from a product page, that product becomes the first line and its real product data is loaded from Supabase. If they start from the general quote page, the first screen should ask them to choose a live catalogue product rather than using a hardcoded list.

Each product line should be a compact card with five areas: the product identity, quantity, applicable product options, preferred images, and custom requirements. The product identity should show a small primary image, product name, category, MOQ, and a change-product action. The form should not display an empty Size selector for a product that has no sizes.

The main free-form requirement field should be visually prominent and labelled **“Tell us exactly what you need”**. Its helper text should invite dimensions, material, color breakdown, packaging instructions, branding, target use, delivery deadline, budget context, and anything not represented by a selector. A shorter per-line note can remain available for product-specific instructions, while a request-level brief can cover requirements that apply to the complete quote.

| Quote area | Customer experience | Required? |
|---|---|---:|
| Product | Live Supabase product selector with image, name, category, and MOQ | Yes |
| Quantity | Numeric quantity with MOQ guidance and validation | Yes |
| Colors | Shown only when the product has colors; include “Other / not listed” | No |
| Sizes | Shown only when the product has sizes; include “Other / not listed” | No |
| Product form | Dynamic label such as Style, Capacity, Model, or Finish when configured by admin | No |
| Packaging | Shown only when packaging choices exist; include “Other / not listed” | No |
| Customization | Shown only when customization choices exist; include “Other / not listed” | No |
| Preferred images | Select one or more uploaded product images; primary image selected initially | No |
| Product requirements | Free-form field for anything specific to that line | Recommended |
| Overall request brief | Free-form field for shared requirements, deadline, destination, and commercial context | Recommended |
| Contact and delivery | Customer identity, email, phone, company, and delivery destination | Yes |

The image selector should use the uploaded product gallery rather than a separate upload field. Thumbnails should have a clear selected border and an accessible label. The customer may select one image when they have an exact preferred style or multiple images when they want a combination, color family, or reference range. The selected image metadata should be shown to the administrator during review.

The form should use progressive disclosure. By default, show the product, quantity, applicable selectors, a compact “Preferred images” strip, and the main requirements field. Less common fields such as packaging details or advanced branding notes can be placed in an expandable **Additional specifications** section, but they must remain easy to find and keyboard accessible.

## 2. Product-option model

Products should not be forced into a universal apparel-style form. Each product needs an explicit option configuration. Empty arrays mean that an option is not applicable and the customer selector should be hidden. A non-empty array makes that selector visible. For products that come in forms other than sizes, the administrator should be able to configure a custom option group label and values, for example **Style: Standard, Insulated, Leakproof** or **Capacity: 500 ml, 750 ml, 1 L**.

The safe customer behavior is:

1. Render only configured product option groups.
2. Add an **Other / not listed** choice to every configured group.
3. When “Other / not listed” is chosen, reveal a short text field for the customer’s value.
4. Always provide the free-form product-requirements field.
5. Never block quote submission merely because a product has no size, color, or packaging option.

This keeps the structured data useful for filtering and quotation preparation while allowing unusual wholesale requests to proceed without forcing inaccurate selections.

## 3. Proposed persistence changes

The existing quote contract currently requires `color`, `size`, `packaging`, and `customization` on every line and does not preserve all free-form line information. The new contract should make those values nullable or optional and add structured preference fields. The exact migration should be additive and applied through the project’s Supabase schema workflow.

| Data object | Proposed fields | Purpose |
|---|---|---|
| `products` | `option_config` JSON or equivalent structured fields | Stores which option groups are applicable and custom labels such as Size, Style, or Capacity |
| `quote_requests` | `requirements` or `customer_brief` text | Stores requirements applying to the whole request |
| `quote_request_items` | nullable `color`, `size`, `packaging`, `customization`; `custom_form_label`, `custom_form_value`; `requirements` text | Stores product-specific choices without requiring irrelevant fields |
| `quote_request_items` | `preferred_image_ids` UUID array or a child preference table | Stores one or more selected uploaded image records without trusting client-provided URLs |
| `quote_request_items` | `option_selections` JSON | Preserves future option groups without another schema change for every new product form |
| optional child table | `quote_item_images(quote_item_id, product_image_id, sort_order)` | Provides strong relational integrity and makes admin review/querying straightforward |

The preferred implementation is a child table for selected images if the existing schema supports it cleanly. It prevents stale or duplicated URLs and lets the server verify that every selected image belongs to the selected product. If speed is more important than relational querying, a validated UUID array can be used, but the server must still verify ownership of each image reference before creating the quote.

RLS must ensure that customers can insert and read only their own quote requests and related line/image preference records. Administrators can read all quote requests and product images through the existing administrator policies. Customers must never be able to select an image belonging to a different product by modifying the browser payload.

## 4. Admin quote-review flow

An administrator should not have to infer the request from a generic quote row. Clicking a quote should open a dedicated request-review page or drawer before the quotation composer. The review surface should show the customer brief at the top, followed by one compact section per product line.

Each line should display the selected product, quantity, MOQ comparison, selected attributes, custom form value, preferred images, and free-form requirements. Missing options should be shown as **Not specified**, not as fake defaults. The administrator should be able to acknowledge or clarify unclear requirements through the existing messaging path, then proceed to quotation creation with the full request context visible.

The quotation composer should receive the real quote request ID and load the actual line items rather than opening with a default ID or requiring the administrator to remember the request details. Pricing can remain a separate commercial step, but the request specification must stay visible while pricing is prepared.

## 5. Admin products layout redesign

The admin products page should become an operational catalogue, not a public product detail page. The primary view should use a compact table on desktop and stacked rows on mobile. Each row should contain a bounded thumbnail, name, category, MOQ, option summary, image count, active status, last updated date, and a concise action group.

| Current problem | Redesign decision |
|---|---|
| Full-size image dominates the page | Use a fixed 72–96 px thumbnail with `object-fit: contain` |
| Full description creates excessive height | Show a two-line truncated summary with an expand/details action |
| Edit form appears below the product card | Open a bounded modal or right-side drawer anchored to the selected product |
| All fields appear at once with weak grouping | Group fields into Product identity, Buying rules, Product options, Description, and Images |
| Save controls are far from the selected item | Keep sticky footer actions inside the drawer/modal |
| Image count is visible but images are not managed | Provide a compact gallery strip and primary-image indicator in the editor |
| Empty option arrays become misleading defaults | Let admin mark an option group as not applicable and configure custom form groups |

The edit drawer should have a constrained width on desktop, a full-height scrollable body, and a sticky action footer. On mobile it should become a full-screen sheet with a fixed header and footer. Long descriptions should use a textarea with a small live preview or a collapsible preview, not a large rendered block in the catalogue list.

The page header should contain one clear **Add product** action, a compact search field, and filters for active status/category. The catalogue should support a truthful empty state and a visible loading state. Destructive delete actions should stay visually secondary and require confirmation.

## 6. Implementation sequence

### Phase A: Contract and data foundation

First, replace hardcoded quote products and universal options with live Supabase product records. Add the optional product-option configuration, request-level brief, line-level requirements, custom form values, and validated preferred image references. Update the server validation and persistence helpers together so the UI cannot silently drop fields.

### Phase B: Customer quote experience

Build the quote line around the selected product’s real metadata and gallery. Add conditional selectors, “Other / not listed” handling, preferred-image selection, the prominent free-form requirements field, and a separate overall request brief. Preserve quote-prefill values from product detail pages and include all submitted values in the mutation payload.

### Phase C: Admin request review

Add a dedicated admin request-detail surface that displays every submitted requirement and selected image. Add loading, empty, error, and permission states. Link the dashboard request rows to the review surface and only then to the quotation composer.

### Phase D: Admin catalogue redesign

Replace the oversized product cards with the compact operational list and move editing into a bounded responsive drawer/modal. Add option applicability controls, custom form labels, and a small image-management area that retains primary-image selection.

### Phase E: Validation and polish

Add Vitest coverage for omitted sizes, custom product forms, “Other / not listed”, preferred image validation, line notes, request-level briefs, customer ownership, administrator visibility, and deletion behavior. Verify the customer quote page, admin catalogue, admin request review, and product detail handoff at desktop and mobile breakpoints.

## 7. Acceptance criteria

The redesign is ready when a customer can request a quote for a product with no sizes without seeing or filling a size field; select a custom form such as Style or Capacity when the administrator configured one; select one or more images from that product’s uploaded gallery; write a complete free-form request; and submit without losing any line or request-level information.

The admin experience is ready when an administrator can scan all products without oversized descriptions or images, open one compact editor for the selected product, configure which option groups apply, manage the primary image, and review an incoming quote with its exact requirements and preferred images before preparing a quotation. All of these flows must remain protected by Supabase authentication and RLS and must work on mobile.
