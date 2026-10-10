import { useState } from "react";
import { CreditCard, FileSearch, ShieldCheck } from "lucide-react";
import { useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { BackLink, Button, ButtonLink, Card, Notice } from "@/components/ios";
import { CenteredState, PageLoading, SignInRequired } from "@/components/layout/PageState";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatMoney } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function InvoicePayment() {
  usePageTitle("Pay invoice");
  const search = useSearch();
  const invoiceId = Number(new URLSearchParams(search).get("invoiceId") || 0);
  const { user, loading } = useAuth();
  const invoice = trpc.billing.invoice.useQuery({ invoiceId }, { enabled: Boolean(user && invoiceId) });
  const checkout = trpc.payments.createFlutterwaveCheckout.useMutation();
  const [error, setError] = useState("");

  if (loading || (user && invoiceId && invoice.isLoading)) return <SiteLayout><PageLoading label="Loading your invoice…" /></SiteLayout>;
  if (!user) return <SiteLayout><SignInRequired title="Sign in to pay an invoice" /></SiteLayout>;
  if (!invoice.data) {
    return (
      <SiteLayout>
        <CenteredState icon={FileSearch} tone="gray" title="Invoice not found" description="This invoice is not available for the signed-in account.">
          <ButtonLink href="/dashboard" size="lg">
            Back to my quotes
          </ButtonLink>
        </CenteredState>
      </SiteLayout>
    );
  }

  const record = invoice.data;
  const pay = async () => {
    try {
      setError("");
      const result = await checkout.mutateAsync({ invoiceId, amount: Number(record.total), currency: "NGN", redirectUrl: `${window.location.origin}/dashboard` });
      window.location.assign(result.link);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start payment");
    }
  };

  return (
    <SiteLayout>
      <Container size="narrow" className="pt-2 md:pt-6">
        <BackLink href="/dashboard">My quotes</BackLink>
        <Card className="mt-3 p-7 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-[18px] bg-tint-soft text-tint-text">
            <CreditCard className="size-7" aria-hidden />
          </span>
          <p className="text-footnote font-medium uppercase tracking-wide text-label-2">Invoice {invoiceId}</p>
          <p className="mt-1 text-subhead text-label-2">Total due</p>
          <p className="text-[2.5rem] font-bold leading-tight tabular-nums">{formatMoney(Number(record.total), "NGN")}</p>
          {error && <Notice tone="red" className="mt-5 text-left">{error}</Notice>}
          <Button size="lg" full className="mt-6" loading={checkout.isPending} onClick={pay}>
            Continue to Flutterwave
          </Button>
          <p className="mt-4 flex items-start justify-center gap-1.5 text-footnote text-label-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            You will be redirected to Flutterwave's secure checkout. Payment is confirmed only after server-side verification.
          </p>
        </Card>
      </Container>
    </SiteLayout>
  );
}
