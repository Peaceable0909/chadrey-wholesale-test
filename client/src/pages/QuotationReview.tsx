import { useState } from "react";
import { Check, FileSearch } from "lucide-react";
import { useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { BackLink, Button, ButtonLink, Card, ListGroup, ListRow, Notice, PageHeader } from "@/components/ios";
import { CenteredState, PageLoading, SignInRequired } from "@/components/layout/PageState";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useScrollTopWhen } from "@/hooks/useScrollTopWhen";
import { formatDate, formatMoney } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export default function QuotationReview() {
  usePageTitle("Your quotation");
  const search = useSearch();
  const { user, loading } = useAuth();
  const quoteRequestId = Number(new URLSearchParams(search).get("quoteId"));
  const validId = Number.isInteger(quoteRequestId) && quoteRequestId > 0;
  const quote = trpc.quotes.quotation.useQuery({ quoteRequestId }, { enabled: Boolean(user) && validId });
  const review = trpc.quotes.reviewQuotation.useMutation();
  const [decision, setDecision] = useState<"accepted" | "declined" | null>(null);
  useScrollTopWhen(decision);

  if (loading || (user && validId && quote.isLoading)) return <SiteLayout><PageLoading label="Loading your quotation…" /></SiteLayout>;
  if (!user) return <SiteLayout><SignInRequired title="Sign in to review your quotation" /></SiteLayout>;

  if (!quote.data) {
    return (
      <SiteLayout>
        <CenteredState icon={FileSearch} tone="gray" title="Quotation not available" description="We could not load this quotation. If you were told it is ready, please contact us and we will help straight away.">
          <ButtonLink href="/contact" size="lg">
            Contact us
          </ButtonLink>
          <ButtonLink href="/dashboard" variant="gray" size="lg">
            Back to my quotes
          </ButtonLink>
        </CenteredState>
      </SiteLayout>
    );
  }

  if (decision) {
    const accepted = decision === "accepted";
    return (
      <SiteLayout>
        <CenteredState
          icon={Check}
          tone={accepted ? "green" : "gray"}
          title={accepted ? "Quotation accepted" : "Response recorded"}
          description={accepted ? "We will prepare your invoice and payment instructions next." : "Our team will follow up if anything needs clarifying."}>
          <ButtonLink href="/dashboard" size="lg">
            Back to my quotes
          </ButtonLink>
        </CenteredState>
      </SiteLayout>
    );
  }

  const data = quote.data;
  const respond = (value: "accepted" | "declined") => review.mutate({ quotationId: data.id, decision: value }, { onSuccess: () => setDecision(value) });

  return (
    <SiteLayout tabBar={false} className="pb-32">
      <Container size="form" className="space-y-7 pt-2 md:pt-6">
        <div>
          <BackLink href="/dashboard">My quotes</BackLink>
          <PageHeader title="Your quotation" subtitle={`Request WR-${quoteRequestId}`} className="mt-1" />
        </div>

        <Card className="p-6 text-center">
          <p className="text-footnote font-medium uppercase tracking-wide text-label-2">Quotation total</p>
          <p className="mt-1 text-[2.5rem] font-bold leading-tight tabular-nums">{formatMoney(Number(data.subtotal), data.currency)}</p>
        </Card>

        <ListGroup>
          <ListRow title="Issued" value={formatDate(data.issuedAt)} />
          <ListRow title="Valid until" value={data.expiresAt ? formatDate(data.expiresAt) : "Until further notice"} />
        </ListGroup>

        {data.notes && (
          <ListGroup header="Note from our team">
            <ListRow title={<span className="whitespace-pre-wrap">{data.notes}</span>} />
          </ListGroup>
        )}

        {review.isError && <Notice tone="red">We could not record your response. Please try again.</Notice>}
      </Container>

      <div className="material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40">
        <div className="gutter mx-auto flex max-w-[760px] gap-3 pb-3 pt-3">
          <Button variant="gray" size="lg" full disabled={review.isPending} onClick={() => respond("declined")}>
            Decline
          </Button>
          <Button size="lg" full loading={review.isPending} onClick={() => respond("accepted")}>
            Accept quotation
          </Button>
        </div>
      </div>
    </SiteLayout>
  );
}
