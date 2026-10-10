import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileText, PackagePlus, Truck, Users } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, EmptyState, ListGroup, ListRow, Notice, StatusBadge } from "@/components/ios";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { fetchAdminCounts, fetchOrdersToWatch, fetchRecentRequests } from "@/lib/accountApi";
import { formatDate } from "@/lib/format";
import { statusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

function greeting(date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

type StatProps = { href: string; label: string; value: number | undefined; hint: string; highlight?: boolean };

function Stat({ href, label, value, hint, highlight }: StatProps) {
  return (
    <Link href={href} className="press block">
      <Card className={cn("h-full p-4", highlight && "bg-tint text-white")}>
        <p className={cn("text-footnote font-medium", highlight ? "text-white/80" : "text-label-2")}>{label}</p>
        <p className="mt-1 text-largetitle font-bold tabular-nums">{value ?? "–"}</p>
        <p className={cn("mt-0.5 text-footnote", highlight ? "text-white/80" : "text-label-2")}>{hint}</p>
      </Card>
    </Link>
  );
}

export default function AdminDashboard() {
  usePageTitle("Admin");
  const { user } = useAuth();
  const enabled = user?.role === "admin";
  const counts = useQuery({ queryKey: ["admin-counts"], queryFn: fetchAdminCounts, enabled, staleTime: 30_000 });
  const recent = useQuery({ queryKey: ["admin-recent-requests"], queryFn: () => fetchRecentRequests(6), enabled, staleTime: 30_000 });
  const orders = useQuery({ queryKey: ["admin-orders-watch"], queryFn: () => fetchOrdersToWatch(5), enabled, staleTime: 30_000 });
  const firstName = user?.name?.split(" ")[0] || "team";
  const pending = counts.data?.pendingRequests ?? 0;

  return (
    <AdminLayout title={`${greeting()}, ${firstName}`} subtitle={pending > 0 ? `${pending} quote ${pending === 1 ? "request needs" : "requests need"} your attention.` : "Nothing is waiting on you right now."}>
      <div className="space-y-7">
        {counts.isError && <Notice tone="red">We could not load the live numbers. Pull to refresh or try again in a moment.</Notice>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat href="/admin/quotes" label="Awaiting review" value={counts.data?.pendingRequests} hint="New quote requests" highlight={pending > 0} />
          <Stat href="/admin/quotes" label="Quote requests" value={counts.data?.quoteRequests} hint="All time" />
          <Stat href="/admin/quotes" label="Quotations" value={counts.data?.quotations} hint="Sent to customers" />
          <Stat href="/admin/fulfilment" label="Orders" value={counts.data?.orders} hint="Paid and in progress" />
        </div>

        <ListGroup header="Quick actions">
          <ListRow href="/admin/products/new" icon={<PackagePlus />} tone="blue" title="Add a product" subtitle="Photos, price and details" chevron />
          <ListRow href="/admin/quotes" icon={<ClipboardList />} tone="orange" title="Review quote requests" chevron />
          <ListRow href="/admin/users" icon={<Users />} tone="purple" title="Manage users" chevron />
        </ListGroup>

        <section>
          {recent.data && recent.data.length === 0 ? (
            <Card>
              <EmptyState icon={FileText} title="No quote requests yet" description="Requests from customers will appear here as soon as they are sent." />
            </Card>
          ) : (
            <ListGroup header="Recent quote requests">
              {recent.isPending && <ListRow title="Loading…" />}
              {(recent.data ?? []).map(request => (
                <ListRow
                  key={request.id}
                  icon={<FileText />}
                  tone={statusTone(request.status)}
                  title={request.ref}
                  subtitle={
                    <>
                      {request.company_name || request.contact_email || "Customer"} · <span className="whitespace-nowrap">{formatDate(request.created_at)}</span>
                    </>
                  }
                  titleTrailing={<StatusBadge status={request.status} />}
                  href={`/admin/quotes?id=${request.id}`}
                  chevron
                />
              ))}
            </ListGroup>
          )}
        </section>

        {(orders.data?.length ?? 0) > 0 && (
          <ListGroup header="Orders to watch">
            {orders.data!.map(order => (
              <ListRow
                key={order.id}
                icon={<Truck />}
                tone="teal"
                title={`Order ${order.id.slice(0, 8)}`}
                subtitle={`${order.carrier || "Carrier pending"}${order.tracking_number ? ` · ${order.tracking_number}` : ""}`}
                titleTrailing={<StatusBadge status={order.status} />}
                href="/admin/fulfilment"
                chevron
              />
            ))}
          </ListGroup>
        )}
      </div>
    </AdminLayout>
  );
}
