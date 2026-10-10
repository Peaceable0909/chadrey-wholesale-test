import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Button, Chip, Field, FormSection, ListGroup, ListRow, Switch, TextArea, TextInput } from "@/components/ios";
import { PriceTiersEditor } from "./PriceTiersEditor";
import FormattedDescription from "@/components/FormattedDescription";
import { applyFormat, type FormatKind } from "@/lib/descriptionFormat";
import { pluralUnit } from "@/lib/format";
import type { ProductDraft } from "@/lib/productDraft";
import { STARTER_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

type ProductFormSectionsProps = {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
  /** Categories already used in the catalogue, offered as one-tap suggestions. */
  knownCategories: string[];
  showVisibility?: boolean;
  disabled?: boolean;
};

function CategoryField({ value, onChange, known }: { value: string; onChange: (value: string) => void; known: string[] }) {
  const suggestions = Array.from(new Set([...known, ...STARTER_CATEGORIES])).slice(0, 14);
  return (
    <Field label="Category" as="div">
      <TextInput value={value} onChange={event => onChange(event.target.value)} placeholder="e.g. Bags" aria-label="Category" autoComplete="off" />
      <div className="no-scrollbar -mx-1 mt-2.5 flex gap-2 overflow-x-auto p-1" role="group" aria-label="Suggested categories">
        {suggestions.map(name => (
          <Chip key={name} selected={value.trim().toLowerCase() === name.toLowerCase()} onClick={() => onChange(name)} className="h-8 px-3 text-footnote">
            {name}
          </Chip>
        ))}
      </div>
    </Field>
  );
}

function DescriptionField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const apply = (kind: FormatKind) => {
    const input = ref.current;
    if (!input) return;
    const result = applyFormat(value, input.selectionStart, input.selectionEnd, kind);
    onChange(result.text);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor="product-description" className="text-subhead font-medium">
          Full description <span className="ml-1 font-normal text-label-2">Optional</span>
        </label>
        <div className="flex gap-1.5">
          <Button variant="gray" size="sm" aria-label="Make selected text bold" onClick={() => apply("bold")}>
            <strong>B</strong>
          </Button>
          <Button variant="gray" size="sm" aria-label="Turn selected lines into bullets" onClick={() => apply("bullet")}>
            • List
          </Button>
        </div>
      </div>
      <TextArea
        id="product-description"
        ref={ref}
        rows={6}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="Material, sizes, what it is good for… Use bullet points for the key details."
      />
      {value.trim() && (
        <details className="mt-2.5 rounded-control bg-fill-4 px-4 py-3">
          <summary className="cursor-pointer text-subhead font-medium text-label-2">Preview</summary>
          <FormattedDescription text={value} className="mt-3 text-subhead" />
        </details>
      )}
    </div>
  );
}

/** The product fields shared by "Add product" and the product editor. */
export function ProductFormSections({ draft, onChange, knownCategories, showVisibility = false, disabled = false }: ProductFormSectionsProps) {
  const hasOptions = Boolean(draft.colors || draft.sizes || draft.packaging || draft.customization || draft.customLabel);
  const [optionsOpen, setOptionsOpen] = React.useState(hasOptions);
  const moq = Number(draft.moq) || 0;

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <FormSection title="Details">
        <Field label="Product name">
          <TextInput value={draft.name} onChange={event => onChange({ name: event.target.value })} placeholder="e.g. Hand-woven rattan bag" autoComplete="off" />
        </Field>
        <CategoryField value={draft.category} onChange={category => onChange({ category })} known={knownCategories} />
        <Field label="Minimum order (MOQ)" hint="The smallest quantity a buyer can order.">
          <div className="relative">
            <TextInput inputMode="numeric" value={draft.moq} onChange={event => onChange({ moq: event.target.value.replace(/[^0-9]/g, "") })} className="pr-16" aria-label="Minimum order quantity" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-body text-label-2" aria-hidden>
              {pluralUnit(draft.price.unit)}
            </span>
          </div>
        </Field>
      </FormSection>

      <FormSection title="Price">
        <PriceTiersEditor value={draft.price} onChange={price => onChange({ price })} moq={moq} />
      </FormSection>

      <FormSection title="Description">
        <Field label="Short summary" optional hint="One line shown under the product name. Up to 180 characters.">
          <TextInput value={draft.shortDescription} maxLength={180} onChange={event => onChange({ shortDescription: event.target.value })} placeholder="e.g. Hand-woven in Chiang Mai with a leather strap" />
        </Field>
        <DescriptionField value={draft.description} onChange={description => onChange({ description })} />
      </FormSection>

      <section>
        <ListGroup>
          <ListRow
            title="More options"
            subtitle="Colours, sizes, packaging and more"
            onClick={() => setOptionsOpen(open => !open)}
            trailing={<ChevronDown className={cn("size-5 text-label-3 transition-transform", optionsOpen && "rotate-180")} aria-hidden />}
          />
        </ListGroup>
        {optionsOpen && (
          <div className="mt-3 space-y-4 rounded-group bg-surface p-4">
            <p className="text-footnote text-label-2">Separate choices with commas. Buyers only see the groups you fill in.</p>
            <Field label="Colours" optional>
              <TextInput value={draft.colors} onChange={event => onChange({ colors: event.target.value })} placeholder="Black, Sage, Sand" />
            </Field>
            <Field label="Sizes" optional>
              <TextInput value={draft.sizes} onChange={event => onChange({ sizes: event.target.value })} placeholder="S, M, L, XL" />
            </Field>
            <Field label="Packaging" optional>
              <TextInput value={draft.packaging} onChange={event => onChange({ packaging: event.target.value })} placeholder="Individual bag, Bulk carton" />
            </Field>
            <Field label="Customisation" optional>
              <TextInput value={draft.customization} onChange={event => onChange({ customization: event.target.value })} placeholder="Plain, Logo print" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Other option name" optional>
                <TextInput value={draft.customLabel} onChange={event => onChange({ customLabel: event.target.value })} placeholder="e.g. Capacity" />
              </Field>
              <Field label="Its choices" optional>
                <TextInput value={draft.customValues} onChange={event => onChange({ customValues: event.target.value })} placeholder="500 ml, 750 ml, 1 L" />
              </Field>
            </div>
          </div>
        )}
      </section>

      {showVisibility && (
        <ListGroup footer="Hidden products stay here in admin but do not appear in the store.">
          <ListRow title="Visible in store" trailing={<Switch checked={draft.isActive} onCheckedChange={isActive => onChange({ isActive })} aria-label="Visible in store" />} />
        </ListGroup>
      )}
    </fieldset>
  );
}
