import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList } from "lucide-react";
import { useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button, ButtonLink, Field, FormSection, ListGroup, ListRow, Notice, TextArea, TextInput } from "@/components/ios";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { CenteredState } from "@/components/layout/PageState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useScrollTopWhen } from "@/hooks/useScrollTopWhen";
import { mapProductRow, type Product } from "@/lib/catalogue";
import { formatMoney, formatQty } from "@/lib/format";
import { lineTotal } from "@/lib/pricing";
import { getSupabaseClient } from "@/lib/supabase";
import { errorMessage } from "@/lib/supabaseCompat";

type RequestSummary = { id: string; ref: string; status: string; company_name: string | null; contact_email: string | null; requirements: string | null };
type Line = { quantity: number; product: Product | null };

async function fetchComposerData(quoteRequestId: string): Promise<{ request: RequestSummary; lines: Line[] }> {
  const client = getSupabaseClient();
  const [requestResult, itemResult] = await Promise.all([
    client.from("quote_requests").select("id,ref,status,company_name,contact_email,requirements").eq("id", quoteRequestId).single(),
    client.from("quote_request_items").select("quantity,products(*)").eq("quote_request_id", quoteRequestId),
  ]);
  if (requestResult.error) throw requestResult.error;
  const lines = ((itemResult.data ?? []) as any[]).map(item => {
    const row = Array.isArray(item.products) ? item.products[0] : item.products;
    return { quantity: item.quantity as number, product: row ? mapProductRow(row) : null };
  });
  return { request: requestResult.data as RequestSummary, lines };
}

const CURRENCY = "NGN";

export default function AdminQuoteComposer() {
  usePageTitle("Prepare quotation");
  const search = useSearch();
  const quoteRequestId = new URLSearchParams(search).get("quoteId") ?? "";
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["composer", quoteRequestId], queryFn: () => fetchComposerData(quoteRequestId), enabled: user?.role === "admin" && Boolean(quoteRequestId) });
  const [subtotal, setSubtotal] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [created, setCreated] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  useScrollTopWhen(created);

  const request = data.data?.request;
  const lines = data.data?.lines ?? [];
  // A price-list total is only suggested when every line has a price in the quotation's currency.
  const priced = lines.map(line => (line.product && line.product.pricing.currency === CURRENCY ? lineTotal(line.product.pricing, line.quantity) : null));
  const suggestion = lines.length > 0 && priced.every(value => value !== null) ? priced.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !request) return;
    setSaving(true);
    setError("");
    try {
      const client = getSupabaseClient();
      const { error: quotationError } = await client.from("quotations").insert({
        quote_request_id: request.id,
        currency: CURRENCY,
        subtotal: Number(subtotal),
        notes: notes.trim() || null,
        issued_by: user.uid,
        status: "sent",
        expires_at: dueDate ? `${dueDate}T23:59:59Z` : null,
      });
      if (quotationError) throw quotationError;
      const { error: requestError } = await client.from("quote_requests").update({ status: "quoted" }).eq("id", request.id);
      if (requestError) throw requestError;
      // The inbox and the overview counts show this request as quoted straight away.
      for (const key of ["quote-inbox", "admin-counts", "admin-recent-requests"]) void queryClient.invalidateQueries({ queryKey: [key] });
      setCreated(true);
    } catch (caught) {
      setError(errorMessage(caught, "Unable to issue the quotation."));
    } finally {
      setSaving(false);
    }
  }

  if (created && request) {
    return (
      <AdminLayout title="Quotation issued">
        <CenteredState icon={Check} tone="green" title="The quotation is ready" description={`The customer can now review the quotation for request ${request.ref}.`}>
          <ButtonLink href="/admin/quotes" size="lg">
            Back to quote requests
          </ButtonLink>
        </CenteredState>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Prepare quotation" subtitle={request ? `For request ${request.ref}` : undefined} back={{ href: quoteRequestId ? `/admin/quotes?id=${quoteRequestId}` : "/admin/quotes", label: "Request" }} width="form" tabBar={false}>
      {!quoteRequestId || data.isError ? (
        <CenteredState icon={ClipboardList} tone="gray" title="Request not found" description="Open a request from the quote inbox before preparing a quotation.">
          <ButtonLink href="/admin/quotes" size="lg">
            Open quote requests
          </ButtonLink>
        </CenteredState>
      ) : data.isPending || !request ? (
        <p className="py-16 text-center text-subhead text-label-2">Loading request…</p>
      ) : (
        <form onSubmit={submit} className="space-y-6 pb-28">
          <ListGroup header="Request">
            <ListRow title={request.company_name || request.contact_email || "Customer"} subtitle={`${lines.length} ${lines.length === 1 ? "line" : "lines"} · ${lines.reduce((total, line) => total + line.quantity, 0).toLocaleString("en-US")} units`} />
            {request.requirements && <ListRow title={<span className="whitespace-pre-wrap">{request.requirements}</span>} subtitle="Customer brief" />}
          </ListGroup>

          {lines.length > 0 && (
            <ListGroup header="Price list" footer="From the prices you set on each product. They are a guide, not the quotation.">
              {lines.map((line, index) => {
                const total = line.product ? lineTotal(line.product.pricing, line.quantity) : null;
                return (
                  <ListRow
                    key={index}
                    title={line.product?.name ?? "Product no longer available"}
                    subtitle={formatQty(line.quantity, line.product?.pricing.unit)}
                    value={total !== null && line.product ? formatMoney(total, line.product.pricing.currency) : "No price"}
                  />
                );
              })}
            </ListGroup>
          )}

          <FormSection title="Commercial terms">
            <Field label={`Total (${CURRENCY})`}>
              <TextInput required type="number" min="0" step="0.01" inputMode="decimal" value={subtotal} onChange={event => setSubtotal(event.target.value)} placeholder="e.g. 428000" />
            </Field>
            {suggestion !== null && (
              <Button variant="tinted" size="sm" onClick={() => setSubtotal(String(suggestion))}>
                Use price list total · {formatMoney(suggestion, CURRENCY)}
              </Button>
            )}
            <Field label="Valid until">
              <TextInput required type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
            </Field>
            <Field label="Notes for the customer" optional hint="Lead time, validity, or payment terms.">
              <TextArea rows={5} value={notes} onChange={event => setNotes(event.target.value)} placeholder="e.g. Production takes 3 weeks after payment." />
            </Field>
          </FormSection>

          {error && <Notice tone="red">{error}</Notice>}

          <div className="material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40 lg:left-64">
            <div className="gutter mx-auto max-w-[760px] py-3">
              <Button type="submit" size="lg" full loading={saving}>
                Send quotation
              </Button>
            </div>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
