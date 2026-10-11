import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, FileText, MapPin, Package, Plus, Settings } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { ButtonLink, Card, EmptyState, ListGroup, ListRow, PageHeader, StatusBadge } from "@/components/ios";
import { Container } from "@/components/layout/Container";
import { PageLoading, SignInRequired } from "@/components/layout/PageState";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { fetchNotifications } from "@/lib/accountApi";
import { fetchProductNames } from "@/lib/catalogueApi";
import { formatDate, formatRelative } from "@/lib/format";
import { getSupabaseClient } from "@/lib/supabase";
import { statusTone } from "@/lib/status";

type LiveQuote = { id: string; ref: string; status: string; createdAt: string; product: string; fileCount: number };

async function fetchMyQuotes(userId: string): Promise<LiveQuote[]> {
  const client = getSupabaseClient();
  const [requestResult, itemResult, fileResult] = await Promise.all([
    client.from("quote_requests").select("id,ref,status,created_at,requirements").eq("customer_id", userId).order("created_at", { ascending: false }),
    client.from("quote_request_items").select("quote_request_id,product_id"),
    client.from("quote_request_files").select("quote_request_id"),
  ]);
  if (requestResult.error) throw requestResult.error;
  // Product names come from the shop's own database. A product that is hidden or gone just shows the generic title.
  const items = (itemResult.data || []) as Array<{ quote_request_id: string; product_id: string }>;
  const productNames = await fetchProductNames(items.map(item => item.product_id)).catch(() => new Map<string, string>());
  const names = new Map<string, string>();
  for (const item of items) {
    const name = productNames.get(item.product_id);
    if (name && !names.has(item.quote_request_id)) names.set(item.quote_request_id, name);
  }
  const files = new Map<string, number>();
  for (const file of (fileResult.data || []) as Array<{ quote_request_id: string }>) files.set(file.quote_request_id, (files.get(file.quote_request_id) || 0) + 1);
  return ((requestResult.data || []) as any[]).map(request => ({
    id: request.id,
    ref: request.ref,
    status: request.status,
    createdAt: request.created_at,
    product: names.get(request.id) || "Quote request",
    fileCount: files.get(request.id) || 0,
  }));
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-title1 font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-footnote font-medium text-label-2">{label}</p>
    </Card>
  );
}

export default function CustomerDashboard() {
  usePageTitle("My quotes");
  const { user, loading } = useAuth();
  const quotes = useQuery({ queryKey: ["my-quotes", user?.uid], queryFn: () => fetchMyQuotes(user!.uid), enabled: Boolean(user), staleTime: 30_000 });
  const notifications = useQuery({ queryKey: ["my-notifications", user?.uid], queryFn: () => fetchNotifications(user!.uid), enabled: Boolean(user), staleTime: 30_000 });

  if (loading) return <SiteLayout><PageLoading label="Loading your quotes…" /></SiteLayout>;
  if (!user) return <SiteLayout><SignInRequired title="Sign in to see your quotes" description="Your quote requests, quotations and orders are attached to your account." /></SiteLayout>;

  const list = quotes.data ?? [];
  const firstName = user.name?.split(" ")[0] || "there";

  return (
    <SiteLayout>
      <Container size="form" className="space-y-7 pt-4 md:pt-8">
        <PageHeader
          title="My quotes"
          subtitle={`Hello, ${firstName}. Here is the latest on your requests.`}
          actions={
            <ButtonLink href="/quote" size="sm">
              <Plus className="size-4" aria-hidden /> New request
            </ButtonLink>
          }
        />

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Requests" value={list.length} />
          <Stat label="Awaiting quote" value={list.filter(quote => quote.status === "pending").length} />
          <Stat label="Ready to review" value={list.filter(quote => quote.status === "quoted").length} />
        </div>

        <section aria-labelledby="recent-heading">
          {list.length === 0 && !quotes.isPending ? (
            <Card>
              <EmptyState
                icon={ClipboardList}
                title="No quote requests yet"
                description="Pick the products you need and we will send you a quotation."
                action={
                  <ButtonLink href="/products" size="lg">
                    Browse products
                  </ButtonLink>
                }
              />
            </Card>
          ) : (
            <ListGroup header={<span id="recent-heading">Recent requests</span>}>
              {quotes.isPending && <ListRow title="Loading…" />}
              {list.map(quote => (
                <ListRow
                  key={quote.id}
                  icon={<FileText />}
                  tone={statusTone(quote.status)}
                  title={quote.ref}
                  subtitle={
                    <>
                      {quote.product}
                      {quote.fileCount ? ` · ${quote.fileCount} file${quote.fileCount === 1 ? "" : "s"}` : ""} · <span className="whitespace-nowrap">{formatDate(quote.createdAt)}</span>
                    </>
                  }
                  titleTrailing={<StatusBadge status={quote.status} />}
                  chevron={quote.status === "quoted"}
                  href={quote.status === "quoted" ? `/quotation?quoteId=${quote.id}` : undefined}
                />
              ))}
            </ListGroup>
          )}
        </section>

        {(notifications.data?.length ?? 0) > 0 && (
          <ListGroup header="Notifications">
            {notifications.data!.map(item => (
              <ListRow
                key={item.id}
                icon={<Bell />}
                tone="orange"
                title={item.title}
                subtitle={item.body ? `${item.body} · ${formatRelative(item.created_at)}` : formatRelative(item.created_at)}
              />
            ))}
          </ListGroup>
        )}

        <ListGroup header="Shortcuts">
          <ListRow href="/orders" icon={<Package />} tone="teal" title="Track an order" chevron />
          <ListRow href="/addresses" icon={<MapPin />} tone="green" title="Delivery addresses" chevron />
          <ListRow href="/account" icon={<Settings />} tone="gray" title="Account settings" chevron />
        </ListGroup>
      </Container>
    </SiteLayout>
  );
}
