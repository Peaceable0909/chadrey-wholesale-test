import * as React from "react";
import { FileUp, PackageSearch, Plus, X } from "lucide-react";
import { useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { BackLink, Button, ButtonLink, Card, EmptyState, Field, FormSection, ListGroup, ListRow, Notice, PageHeader, SectionHeader, TextArea, TextInput } from "@/components/ios";
import { Container } from "@/components/layout/Container";
import { PageLoading, SignInRequired } from "@/components/layout/PageState";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductPicker } from "@/components/store/ProductPicker";
import { QuoteLineCard } from "@/components/store/QuoteLineCard";
import { useProduct } from "@/hooks/useCatalogue";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useScrollTopWhen } from "@/hooks/useScrollTopWhen";
import type { Product } from "@/lib/catalogue";
import { formatMoney, formatQty } from "@/lib/format";
import { lineTotal } from "@/lib/pricing";
import { indicativeTotals, MIN_BRIEF_LENGTH, newLine, readPrefill, referenceFileProblem, validateQuote, type ContactDetails, type QuoteLine } from "@/lib/quote";
import { submitQuoteRequest } from "@/lib/quoteApi";
import { errorMessage } from "@/lib/supabaseCompat";

function SuccessScreen({ reference }: { reference: string }) {
  return (
    <SiteLayout>
      <Container size="narrow" className="py-14 md:py-24">
        <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
          <span className="mb-6 grid size-24 place-items-center rounded-full bg-ios-green/15" style={{ animation: "pop-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both" }}>
            <svg viewBox="0 0 24 24" className="size-12 text-ios-green" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7" strokeDasharray="24" style={{ animation: "draw-check 450ms 250ms ease-out both" }} />
            </svg>
          </span>
          <h1 className="text-title1 font-bold">Request sent</h1>
          <p className="mt-2 max-w-md text-body text-label-2">Thank you. We have your products, preferences and requirements. Our team will review everything and send your quotation.</p>
          <Card className="mt-7 w-full max-w-sm p-5">
            <p className="text-footnote font-medium uppercase tracking-wide text-label-2">Request reference</p>
            <p className="mt-1 text-title2 font-bold tabular-nums">{reference}</p>
            <p className="mt-1 text-subhead text-label-2">Track its status under My quotes.</p>
          </Card>
          <div className="mt-7 flex w-full max-w-sm flex-col gap-3">
            <ButtonLink href="/dashboard" size="lg" full>
              View my quotes
            </ButtonLink>
            <ButtonLink href="/products" variant="gray" size="lg" full>
              Browse more products
            </ButtonLink>
          </div>
        </div>
      </Container>
    </SiteLayout>
  );
}

export default function QuoteRequest() {
  usePageTitle("Request a quote");
  const { user, loading: authLoading } = useAuth();
  const search = useSearch();
  // Product pages link here with ?product=<slug>; ?id= is accepted too, as on product URLs.
  const urlParams = new URLSearchParams(search);
  const productParam = urlParams.get("product") || urlParams.get("id") || "";

  const [lines, setLines] = React.useState<QuoteLine[]>([]);
  const [pickerTarget, setPickerTarget] = React.useState<"new" | string | null>(null);
  const [brief, setBrief] = React.useState("");
  const [contact, setContact] = React.useState<ContactDetails>({ name: "", company: "", email: "", phone: "", whatsapp: "", address: "" });
  const [referenceFile, setReferenceFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submittedRef, setSubmittedRef] = React.useState("");
  const errorRef = React.useRef<HTMLDivElement>(null);
  const seeded = React.useRef(false);

  // Arriving from a product page: start the request with that product, quantity and chosen specs.
  const prefill = useProduct(productParam);
  React.useEffect(() => {
    if (seeded.current || !prefill.product || prefill.product.isSample) return;
    seeded.current = true;
    setLines(current => (current.length ? current : [newLine(prefill.product, readPrefill(`?${search}`, prefill.product!))]));
  }, [prefill.product]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!user) return;
    setContact(current => ({ ...current, name: current.name || user.name, email: current.email || user.email || "" }));
  }, [user]);

  React.useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  // The confirmation replaces a long form, so bring the person back to the top to read it.
  useScrollTopWhen(submittedRef);

  const updateLine = (id: string, patch: Partial<QuoteLine>) => setLines(current => current.map(line => (line.id === id ? { ...line, ...patch } : line)));
  const setContactField = (key: keyof ContactDetails) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContact(current => ({ ...current, [key]: event.target.value }));

  function pickProduct(product: Product) {
    if (pickerTarget === "new") setLines(current => [...current, newLine(product)]);
    else if (pickerTarget) setLines(current => current.map(line => (line.id === pickerTarget ? newLine(product, { id: line.id }) : line)));
    setPickerTarget(null);
  }

  function selectReferenceFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = referenceFileProblem(file);
    if (problem) return setError(problem);
    setError("");
    setReferenceFile(file);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!user) return setError("Please sign in before submitting a quote request.");
    const problem = validateQuote(lines, brief);
    if (problem) return setError(problem);
    setSubmitting(true);
    try {
      const created = await submitQuoteRequest({ userId: user.uid, userEmail: user.email, lines, brief, contact, referenceFile });
      setSubmittedRef(created.ref);
    } catch (caught) {
      setError(errorMessage(caught, "Unable to submit the quote request. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <SiteLayout tabBar={false}><PageLoading label="Preparing your request…" /></SiteLayout>;
  if (!user) return <SiteLayout><SignInRequired title="Sign in to request a quote" description="Sign in so we can save your requirements and send the quotation to your account." /></SiteLayout>;
  if (submittedRef) return <SuccessScreen reference={submittedRef} />;

  const totals = indicativeTotals(lines);
  const seedingFromProduct = Boolean(productParam) && prefill.isLoading && lines.length === 0;

  return (
    <SiteLayout tabBar={false} footer={false} className="pb-40">
      <Container size="form" className="pt-2 md:pt-6">
        <BackLink href="/products">Products</BackLink>
        <PageHeader title="Request a quote" subtitle="Tell us what you need and we will send a quotation. Prices shown here are a guide." className="mt-1" />

        <form onSubmit={submit} className="mt-7 space-y-7">
          <section aria-labelledby="products-heading" className="space-y-3">
            <SectionHeader as="h2" title={<span id="products-heading">Products</span>} />
            {seedingFromProduct ? (
              <PageLoading label="Loading your product…" />
            ) : lines.length === 0 ? (
              <Card>
                <EmptyState
                  icon={PackageSearch}
                  title="Add your first product"
                  description="Choose from the catalogue. You can add as many products as you need to one request."
                  action={
                    <Button size="lg" onClick={() => setPickerTarget("new")}>
                      <Plus className="size-5" aria-hidden /> Choose a product
                    </Button>
                  }
                />
              </Card>
            ) : (
              <>
                {lines.map((line, index) => (
                  <QuoteLineCard
                    key={line.id}
                    line={line}
                    index={index}
                    canRemove={lines.length > 1}
                    onChange={patch => updateLine(line.id, patch)}
                    onRemove={() => setLines(current => current.filter(item => item.id !== line.id))}
                    onChangeProduct={() => setPickerTarget(line.id)}
                  />
                ))}
                <Button variant="tinted" size="lg" full onClick={() => setPickerTarget("new")}>
                  <Plus className="size-5" aria-hidden /> Add another product
                </Button>
              </>
            )}
          </section>

          <FormSection title="Your request" description="This is the first thing our team reads. The more detail you give, the more accurate your quotation.">
            <Field label="Tell us exactly what you need" hint="Intended use, delivery timing, target budget, and anything that applies to the whole order.">
              <TextArea required minLength={MIN_BRIEF_LENGTH} rows={5} value={brief} onChange={event => setBrief(event.target.value)} placeholder="e.g. A mixed order for our school campaign, needed before June." />
            </Field>
          </FormSection>

          <section>
            <h2 className="px-4 pb-2 text-footnote font-medium uppercase tracking-wide text-label-2">Reference (optional)</h2>
            <ListGroup footer="An image, PDF, DOC, DOCX or TXT file up to 10 MB. Handy for logos or sample designs.">
              {referenceFile ? (
                <ListRow
                  icon={<FileUp />}
                  tone="blue"
                  title={referenceFile.name}
                  subtitle={`${(referenceFile.size / 1024).toFixed(0)} KB`}
                  trailing={
                    <Button variant="plain" size="icon-sm" aria-label="Remove reference file" onClick={() => setReferenceFile(null)}>
                      <X className="size-5" />
                    </Button>
                  }
                />
              ) : (
                <label className="row-separator flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-fill-4/60 active:bg-fill-4 [--sep-inset:60px]">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-ios-blue text-white">
                    <FileUp className="size-[18px]" />
                  </span>
                  <span className="flex-1 text-body text-tint-text">Add a photo or file</span>
                  <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" onChange={selectReferenceFile} className="sr-only" />
                </label>
              )}
            </ListGroup>
          </section>

          <FormSection title="Contact and delivery">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <TextInput required autoComplete="name" value={contact.name} onChange={setContactField("name")} placeholder="Your name" />
              </Field>
              <Field label="Company" optional>
                <TextInput autoComplete="organization" value={contact.company} onChange={setContactField("company")} placeholder="Company or store name" />
              </Field>
              <Field label="Email">
                <TextInput required type="email" autoComplete="email" value={contact.email} onChange={setContactField("email")} placeholder="you@company.com" />
              </Field>
              <Field label="Phone">
                <TextInput required type="tel" autoComplete="tel" value={contact.phone} onChange={setContactField("phone")} placeholder="+234 …" />
              </Field>
              <Field label="WhatsApp" optional className="sm:col-span-2">
                <TextInput type="tel" value={contact.whatsapp} onChange={setContactField("whatsapp")} placeholder="If different from your phone" />
              </Field>
              <Field label="Delivery address" className="sm:col-span-2">
                <TextArea required rows={3} autoComplete="street-address" value={contact.address} onChange={setContactField("address")} placeholder="Street, city, state, country" />
              </Field>
            </div>
          </FormSection>

          {lines.length > 0 && (
            <ListGroup header="Summary" footer="Totals are indicative. Import costs and exchange rates change, so your quotation confirms the final price.">
              {lines.map(line => {
                const total = line.product ? lineTotal(line.product.pricing, line.quantity) : null;
                return (
                  <ListRow
                    key={line.id}
                    title={line.product?.name ?? "Product"}
                    subtitle={`${formatQty(line.quantity, line.product?.pricing.unit)}`}
                    value={total !== null && line.product ? formatMoney(total, line.product.pricing.currency) : "On request"}
                  />
                );
              })}
              {totals.map(item => (
                <ListRow key={item.currency} title={<span className="font-semibold">Indicative total{totals.length > 1 ? ` (${item.currency})` : ""}</span>} value={<span className="font-bold text-label">{formatMoney(item.total, item.currency)}</span>} />
              ))}
            </ListGroup>
          )}

          <div ref={errorRef}>{error && <Notice tone="red">{error}</Notice>}</div>

          <div className="material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40">
            <div className="gutter mx-auto flex max-w-[760px] items-center gap-3 pb-3 pt-3">
              <div className="min-w-0 flex-1">
                <p className="text-caption text-label-2">{lines.length === 0 ? "No products yet" : `${lines.length} ${lines.length === 1 ? "product" : "products"}`}</p>
                <p className="truncate text-headline font-bold tabular-nums">{totals.length === 1 ? formatMoney(totals[0].total, totals[0].currency) : totals.length > 1 ? "Multiple currencies" : "Price on request"}</p>
              </div>
              <Button type="submit" size="lg" className="px-8" loading={submitting} disabled={lines.length === 0}>
                Send request
              </Button>
            </div>
          </div>
        </form>
      </Container>

      <ProductPicker
        open={pickerTarget !== null}
        onOpenChange={open => {
          if (!open) setPickerTarget(null);
        }}
        onPick={pickProduct}
        title={pickerTarget === "new" ? "Add a product" : "Change product"}
      />
    </SiteLayout>
  );
}
