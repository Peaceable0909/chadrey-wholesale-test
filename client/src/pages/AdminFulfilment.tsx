import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import type { AppRouter } from "../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Card, EmptyState, Field, SelectInput, StatusBadge, TextInput } from "@/components/ios";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { trpc } from "@/lib/trpc";

type OrderRow = inferRouterOutputs<AppRouter>["orders"]["adminList"][number];
type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled";

function OrderCard({ row, onSave, saving }: { row: OrderRow; onSave: (input: { orderId: number; status: OrderStatus; carrier: string; trackingNumber: string }) => void; saving: boolean }) {
  const [status, setStatus] = useState<OrderStatus>(row.order.status as OrderStatus);
  const [carrier, setCarrier] = useState(row.order.carrier || "");
  const [trackingNumber, setTrackingNumber] = useState(row.order.trackingNumber || "");

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-footnote font-semibold uppercase tracking-wider text-label-2">Order #{row.order.id}</p>
          <h2 className="text-headline font-semibold">Invoice #{row.invoice.id}</h2>
        </div>
        <StatusBadge status={row.order.status} />
      </div>
      <Field label="Status">
        <SelectInput value={status} onChange={event => setStatus(event.target.value as OrderStatus)}>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </SelectInput>
      </Field>
      <Field label="Carrier" optional>
        <TextInput value={carrier} onChange={event => setCarrier(event.target.value)} placeholder="DHL, FedEx, local carrier" />
      </Field>
      <Field label="Tracking number" optional>
        <TextInput value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} placeholder="Shipment tracking reference" />
      </Field>
      <Button size="lg" full loading={saving} onClick={() => onSave({ orderId: row.order.id, status, carrier, trackingNumber })}>
        Save details
      </Button>
    </Card>
  );
}

export default function AdminFulfilment() {
  usePageTitle("Orders");
  const { user } = useAuth();
  const orders = trpc.orders.adminList.useQuery(undefined, { enabled: user?.role === "admin" });
  const update = trpc.quotes.updateOrder.useMutation({
    onSuccess: () => {
      void orders.refetch();
      toast.success("Order updated");
    },
    onError: () => toast.error("Could not update the order. Please try again."),
  });

  return (
    <AdminLayout title="Orders" subtitle="Update shipment status and delivery details." width="form">
      {orders.data?.length ? (
        <div className="space-y-4">
          {orders.data.map(row => (
            <OrderCard key={row.order.id} row={row} saving={update.isPending} onSave={input => update.mutate(input)} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Truck} title={orders.isLoading ? "Loading orders…" : "No orders yet"} description="Paid orders appear here after a payment is verified." />
        </Card>
      )}
    </AdminLayout>
  );
}
