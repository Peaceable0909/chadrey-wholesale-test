import { Check, PackageSearch } from "lucide-react";
import { useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { BackLink, ButtonLink, Card, ListGroup, ListRow, Notice, PageHeader } from "@/components/ios";
import { CenteredState, PageLoading, SignInRequired } from "@/components/layout/PageState";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const steps = ["Confirmed", "Processing", "Shipped", "Delivered"];

export default function OrderTracking() {
  usePageTitle("Track an order");
  const search = useSearch();
  const orderId = new URLSearchParams(search).get("orderId");
  const { user, loading } = useAuth();
  const orders = trpc.orders.mine.useQuery(undefined, { enabled: Boolean(user) });
  const liveOrder = orders.data?.find(row => String(row.order.id) === orderId) ?? (orderId ? undefined : orders.data?.[0]);
  const effectiveStatus = liveOrder?.order.status ?? "processing";
  const current = Math.max(0, steps.findIndex(step => step.toLowerCase() === effectiveStatus));

  if (loading || (user && orders.isLoading)) return <SiteLayout><PageLoading label="Loading your order…" /></SiteLayout>;
  if (!user) return <SiteLayout><SignInRequired title="Sign in to track an order" description="Your order milestones and shipping details are available in your account." /></SiteLayout>;
  if (!liveOrder) {
    return (
      <SiteLayout>
        <CenteredState icon={PackageSearch} tone="gray" title="No order to track yet" description="Tracking appears here after your payment is confirmed and your order is created.">
          <ButtonLink href="/dashboard" size="lg">
            Back to my quotes
          </ButtonLink>
        </CenteredState>
      </SiteLayout>
    );
  }

  const { order } = liveOrder;
  const shippingNote = order.trackingNumber
    ? `${order.carrier || "Carrier"} · ${order.trackingNumber}`
    : effectiveStatus === "shipped"
      ? "Carrier details are being prepared."
      : "Tracking appears here once your order ships.";

  return (
    <SiteLayout>
      <Container size="form" className="space-y-7 pt-2 md:pt-6">
        <div>
          <BackLink href="/dashboard">My quotes</BackLink>
          <PageHeader title="Your order" subtitle={`Order #${order.id}`} className="mt-1" />
        </div>

        {orders.isError && <Notice tone="orange">We could not refresh this order. Showing the last details we have.</Notice>}

        <Card className="p-5">
          <ol>
            {steps.map((step, index) => {
              const done = index < current;
              const active = index === current;
              return (
                <li key={step} className="relative flex gap-4 pb-7 last:pb-0">
                  {index < steps.length - 1 && <span aria-hidden className={cn("absolute left-[17px] top-9 bottom-0 w-0.5", done ? "bg-tint" : "bg-separator")} />}
                  <span className={cn("z-10 grid size-9 shrink-0 place-items-center rounded-full text-subhead font-semibold", done || active ? "bg-tint text-white" : "bg-fill-3 text-label-2")}>
                    {done ? <Check className="size-[18px]" strokeWidth={3} aria-hidden /> : index + 1}
                  </span>
                  <div className="pt-1">
                    <p className={cn("text-headline", !done && !active && "text-label-2")}>{step}</p>
                    <p className="text-subhead text-label-2">{done ? "Completed" : active ? "Current status" : "Upcoming"}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <ListGroup header="Shipping">
          <ListRow title="Tracking" subtitle={shippingNote} />
        </ListGroup>

        <ListGroup header="Milestones">
          <ListRow title="Confirmed" value={order.createdAt ? formatDate(order.createdAt) : "Pending"} />
          <ListRow title="Shipped" value={order.shippedAt ? formatDate(order.shippedAt) : "Not shipped"} />
          <ListRow title="Delivered" value={order.deliveredAt ? formatDate(order.deliveredAt) : "Not delivered"} />
        </ListGroup>
      </Container>
    </SiteLayout>
  );
}
