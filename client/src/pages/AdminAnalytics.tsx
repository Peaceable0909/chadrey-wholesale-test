import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FileCheck2, FileText, PackageCheck, Users } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, ListGroup, ListRow, Notice } from "@/components/ios";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { fetchAdminCounts } from "@/lib/accountApi";

export default function AdminAnalytics() {
  usePageTitle("Analytics");
  const { user } = useAuth();
  const counts = useQuery({ queryKey: ["admin-counts"], queryFn: fetchAdminCounts, enabled: user?.role === "admin", staleTime: 30_000 });
  const data = counts.data;

  const tiles = [
    { label: "Quote requests", value: data?.quoteRequests, icon: ClipboardList },
    { label: "Quotations", value: data?.quotations, icon: FileCheck2 },
    { label: "Invoices", value: data?.invoices, icon: FileText },
    { label: "Orders", value: data?.orders, icon: PackageCheck },
  ];

  return (
    <AdminLayout title="Analytics" subtitle="Live counts from your database. Nothing here is sample data.">
      <div className="space-y-7">
        {counts.isError && <Notice tone="red">We could not load the counts. Try again in a moment.</Notice>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map(tile => (
            <Card key={tile.label} className="p-4">
              <tile.icon className="size-5 text-tint-text" aria-hidden />
              <p className="mt-3 text-largetitle font-bold tabular-nums">{tile.value ?? "–"}</p>
              <p className="text-footnote font-medium text-label-2">{tile.label}</p>
            </Card>
          ))}
        </div>

        <Card className="flex items-baseline justify-between gap-4 p-5">
          <div>
            <p className="text-footnote font-medium uppercase tracking-wide text-label-2">Awaiting your review</p>
            <p className="mt-1 text-subhead text-label-2">Quote requests that have not been quoted yet</p>
          </div>
          <p className="text-largetitle font-bold tabular-nums">{data?.pendingRequests ?? "–"}</p>
        </Card>

        <ListGroup>
          <ListRow href="/admin/quotes" icon={<ClipboardList />} tone="orange" title="Review quote requests" chevron />
          <ListRow href="/admin/users" icon={<Users />} tone="purple" title="Manage who has admin access" chevron />
        </ListGroup>
      </div>
    </AdminLayout>
  );
}
