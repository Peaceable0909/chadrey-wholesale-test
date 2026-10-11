import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Inbox, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import { useSearchParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { BackLink, Badge, ButtonLink, Card, EmptyState, ListGroup, ListRow, Notice, StatusBadge } from "@/components/ios";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ProductImage } from "@/components/store/ProductImage";
import { photoSrc } from "@/lib/photos";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDate, formatDateTime, formatMoney, formatQty } from "@/lib/format";
import { lineTotal, unitPriceFor } from "@/lib/pricing";
import { OTHER } from "@/lib/quote";
import { fetchQuoteInbox, type InboxItem, type InboxRequest } from "@/lib/quoteInboxApi";
import { errorMessage } from "@/lib/supabaseCompat";
import { cn } from "@/lib/utils";

const meaningful = (value: string | null | undefined): value is string => Boolean(value && value.trim());

function LineCard({ item, index }: { item: InboxItem; index: number }) {
  const product = item.product;
  const preferred = new Set(item.preferred_image_ids ?? []);
  const photos = product?.images.filter(image => preferred.has(image.id)) ?? [];
  const labelFor = (key: string) => product?.optionGroups.find(group => group.key === key)?.label ?? key.replace(/-/g, " ");
  const chosen = Object.entries(item.option_selections ?? {}).filter(([, value]) => meaningful(value) && value !== OTHER);
  const unit = product ? unitPriceFor(product.pricing, item.quantity) : null;
  const total = product ? lineTotal(product.pricing, item.quantity) : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        {product ? (
          <span className="size-14 shrink-0 overflow-hidden rounded-[12px] bg-fill-4">
            <ProductImage product={product} variant="thumb" />
          </span>
        ) : (
          <span className="size-14 shrink-0 rounded-[12px] bg-fill-4" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold uppercase tracking-wider text-label-2">Item {index + 1}</p>
          <h3 className="text-headline font-semibold">{product?.name ?? "Product no longer available"}</h3>
          <p className="text-subhead text-label-2">
            {product?.category ? `${product.category} · ` : ""}Quantity {formatQty(item.quantity, product?.pricing.unit)}
            {product ? ` · MOQ ${product.moq}` : ""}
          </p>
        </div>
      </div>

      <div className="space-y-3.5 border-t border-separator p-4">
        {unit !== null && total !== null && product && (
          <p className="rounded-control bg-tint-soft px-3.5 py-2.5 text-subhead text-tint-text">
            Price list: <span className="font-semibold">{formatMoney(unit, product.pricing.currency)}</span> / {product.pricing.unit} · <span className="font-semibold">{formatMoney(total, product.pricing.currency)}</span> for {formatQty(item.quantity, product.pricing.unit)}
          </p>
        )}

        {photos.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto p-1">
            {photos.map(image => (
              <img key={image.id} src={photoSrc(image.url, 160)} alt={image.label || `${product?.name} preferred view`} className="size-16 shrink-0 rounded-[12px] bg-fill-4 object-cover" />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {chosen.map(([key, value]) => (
            <Badge key={key} tone="gray" className="h-7 px-3 text-footnote">
              {labelFor(key)}: {value}
            </Badge>
          ))}
          {meaningful(item.custom_form_value) && (
            <Badge tone="orange" className="h-7 px-3 text-footnote">
              Other: {item.custom_form_value}
            </Badge>
          )}
          {!chosen.length && !meaningful(item.custom_form_value) && <span className="text-subhead text-label-2">No options specified</span>}
        </div>

        <p className={cn("whitespace-pre-wrap text-body", !meaningful(item.requirements) && "text-label-2")}>{meaningful(item.requirements) ? item.requirements : "No product-specific notes."}</p>
      </div>
    </Card>
  );
}

function RequestDetail({ request }: { request: InboxRequest }) {
  const whatsappDigits = request.whatsapp?.replace(/[^0-9]/g, "");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-footnote font-semibold uppercase tracking-wider text-label-2">Request</p>
          <h2 className="text-title2 font-bold tabular-nums">{request.ref}</h2>
          <p className="text-subhead text-label-2">Received {formatDateTime(request.created_at)}</p>
        </div>
        <StatusBadge status={request.status} className="h-7 px-3 text-footnote" />
      </div>

      <ListGroup header="Customer">
        <ListRow icon={<ClipboardList />} tone="blue" title={request.company_name || "No company given"} subtitle="Company" />
        {meaningful(request.contact_email) && <ListRow href={`mailto:${request.contact_email}`} icon={<Mail />} tone="indigo" title={request.contact_email} subtitle="Email" chevron />}
        {meaningful(request.contact_phone) && <ListRow href={`tel:${request.contact_phone}`} icon={<Phone />} tone="green" title={request.contact_phone} subtitle="Phone" chevron />}
        {whatsappDigits && <ListRow href={`https://wa.me/${whatsappDigits}`} icon={<MessageSquare />} tone="teal" title={request.whatsapp!} subtitle="WhatsApp" chevron />}
        <ListRow icon={<MapPin />} tone="orange" wrap title={request.delivery_address || "No delivery address given"} subtitle="Delivery address" />
      </ListGroup>

      <section>
        <h3 className="px-4 pb-2 text-footnote font-medium uppercase tracking-wide text-label-2">Customer brief</h3>
        <Card className="p-4">
          <p className={cn("whitespace-pre-wrap text-body", !meaningful(request.requirements) && "text-label-2")}>{request.requirements || "No overall brief was provided."}</p>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="px-4 text-footnote font-medium uppercase tracking-wide text-label-2">Products requested</h3>
        {request.items.length === 0 ? <Card className="p-4 text-subhead text-label-2">This request has no product lines.</Card> : request.items.map((item, index) => <LineCard key={item.id} item={item} index={index} />)}
      </section>

      <ButtonLink href={`/admin/quote?quoteId=${request.id}`} size="lg" full>
        Prepare quotation
      </ButtonLink>
    </div>
  );
}

export default function AdminQuoteRequests() {
  usePageTitle("Quote requests");
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const inbox = useQuery({ queryKey: ["quote-inbox"], queryFn: fetchQuoteInbox, enabled: user?.role === "admin", staleTime: 20_000 });
  const requests = inbox.data ?? [];
  const selectedId = params.get("id");
  const selected = requests.find(request => request.id === selectedId) ?? null;

  // On wide screens the detail pane is always visible, so open the newest request by default.
  React.useEffect(() => {
    if (!selected && requests.length && window.matchMedia("(min-width: 1024px)").matches) {
      setParams(new URLSearchParams({ id: requests[0].id }), { replace: true });
    }
  }, [requests, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id: string) => setParams(new URLSearchParams({ id }));

  return (
    <AdminLayout
      title="Quote requests"
      subtitle={inbox.isPending ? "Loading…" : `${requests.length} ${requests.length === 1 ? "request" : "requests"}, newest first`}
      headerClassName={selected ? "hidden lg:flex" : undefined}>
      {inbox.isError && <Notice tone="red">{errorMessage(inbox.error, "We could not load the quote requests.")}</Notice>}

      {!inbox.isPending && requests.length === 0 && !inbox.isError ? (
        <Card>
          <EmptyState icon={Inbox} title="No quote requests yet" description="New requests from customers will appear here once they are submitted." />
        </Card>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className={cn(selected && "hidden lg:block")}>
            {inbox.isPending ? (
              <Card>
                <p className="p-6 text-center text-subhead text-label-2">Loading requests…</p>
              </Card>
            ) : (
              <ListGroup>
                {requests.map(request => (
                  <ListRow
                    key={request.id}
                    title={request.ref}
                    titleTrailing={<StatusBadge status={request.status} />}
                    subtitle={
                      <>
                        <span className="block truncate">{request.company_name || request.contact_email || "Customer"}</span>
                        <span className="block text-footnote">
                          {formatDate(request.created_at)} · {request.items.length} {request.items.length === 1 ? "line" : "lines"}
                        </span>
                      </>
                    }
                    selected={request.id === selectedId}
                    onClick={() => open(request.id)}
                    chevron
                  />
                ))}
              </ListGroup>
            )}
          </div>

          <div className={cn(!selected && "hidden lg:block")}>
            {selected ? (
              <>
                <BackLink href="/admin/quotes" className="lg:hidden">
                  Requests
                </BackLink>
                <RequestDetail request={selected} />
              </>
            ) : (
              <Card className="hidden lg:block">
                <EmptyState icon={ClipboardList} title="Select a request" description="Choose a request on the left to read the customer's brief." />
              </Card>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
