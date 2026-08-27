# Quote Request and Admin UX Audit

## Observed customer quote-flow gaps

The current customer quote page uses hardcoded product names and shared option lists. It requires a size even when a product may not have sizes, does not load the selected product's real image set, and submits only a top-level empty notes value while dropping each line's notes and contact fields. The quote request therefore cannot reliably capture the customer's complete requirements.

## Observed admin catalogue problems

The supplied admin screenshots show a product detail preview consuming most of the viewport, with a large image area and full long-form description shown inline. The edit form is appended below the product preview rather than contained in a focused editor, so the administrator must scroll through the entire description and image area before reaching fields and save controls. The result is poor scanning, weak grouping, excessive vertical height, and a high risk of editing the wrong product.

The compact redesign should use a table/list or two-column catalogue with bounded image thumbnails, concise metadata, and one clear action group. Editing should happen in a modal or right-side drawer with grouped sections: identity, buying rules, optional attributes, description, and image management. Long descriptions should be collapsed or previewed, never used as the primary card height driver.

## Product-option model to support

Each product should explicitly define which selectors are applicable: colors, sizes, packaging, customization, and form/variant labels. Empty arrays should mean the selector is not shown. A product such as a lunch box may use a form selector such as "Style" or "Capacity" instead of size. Customers should always have an "Other / not listed" choice and a free-form requirements field for anything unusual.

## Image preference model to support

The quote line should store preferred product image identifiers, not only URLs. Customers should be able to select one or more uploaded images from the product's gallery, with a clear selected state and an optional note explaining the preference. Admins should see those preferred images alongside the line requirements when reviewing the request.

## Proposed implementation sequence

1. Replace hardcoded quote catalogue/options with live Supabase product records and product-specific image metadata.
2. Add nullable option fields and structured per-line requirements to quote persistence, preserving backward compatibility.
3. Add customer controls for optional selectors, custom form values, image preferences, and an overall request brief.
4. Add an admin quote detail/review view showing each line, selected images, requirements, and missing/optional attributes before quotation creation.
5. Reorganize AdminProducts into a compact list/grid and move editing into a bounded drawer or modal with responsive behavior.
6. Add tests for omitted sizes, custom forms, selected images, line notes, RLS ownership, and responsive empty/error states.
