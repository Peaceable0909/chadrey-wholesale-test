import { useQuery } from "@tanstack/react-query";
import { HelpCircle, LayoutDashboard, LogOut, MapPin, Package } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge, Card, EmptyState, ListGroup, ListRow, Notice, PageHeader } from "@/components/ios";
import { AppearanceSetting } from "@/components/layout/AppearanceSetting";
import { Avatar } from "@/components/layout/Avatar";
import { Container } from "@/components/layout/Container";
import { PageLoading, SignInRequired } from "@/components/layout/PageState";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getSupabaseClient } from "@/lib/supabase";

type Address = { id: string; label: string; recipient_name: string; company_name: string | null; line1: string; line2: string | null; city: string; state: string | null; postal_code: string | null; country: string; is_default: boolean };

async function fetchAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await getSupabaseClient()
    .from("customer_addresses")
    .select("id,label,recipient_name,company_name,line1,line2,city,state,postal_code,country,is_default")
    .eq("customer_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Address[];
}

export default function CustomerAccount() {
  usePageTitle("Account");
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const addresses = useQuery({ queryKey: ["my-addresses", user?.uid], queryFn: () => fetchAddresses(user!.uid), enabled: Boolean(user), staleTime: 60_000 });

  if (loading) return <SiteLayout><PageLoading label="Loading your account…" /></SiteLayout>;
  if (!user) {
    // The look of the site is a setting of this device, so it can be changed without signing in.
    return (
      <SiteLayout>
        <SignInRequired title="Sign in to manage your account" description="Your profile and saved delivery addresses are only available to you." />
        <Container size="form" className="-mt-6 md:-mt-12">
          <AppearanceSetting />
        </Container>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <Container size="form" className="space-y-7 pt-4 md:pt-8">
        <PageHeader title="Account" />

        <Card className="flex items-center gap-4 p-5">
          <Avatar name={user.name} email={user.email} className="size-16 text-title3" />
          <div className="min-w-0">
            <h2 className="truncate text-title3 font-bold">{user.name || "Chadrey customer"}</h2>
            <p className="truncate text-subhead text-label-2">{user.email || "Signed-in account"}</p>
            <Badge tone={user.role === "admin" ? "indigo" : "blue"} className="mt-2">
              {user.role === "admin" ? "Administrator" : "Customer"}
            </Badge>
          </div>
        </Card>

        <section id="addresses">
          {addresses.isError && <Notice tone="orange" className="mb-3">We could not load your saved addresses yet.</Notice>}
          {addresses.data && addresses.data.length === 0 ? (
            <Card>
              <EmptyState icon={MapPin} title="No saved addresses" description="Add a delivery address when you send your next quote request." />
            </Card>
          ) : (
            <ListGroup header="Delivery addresses">
              {addresses.isPending && <ListRow title="Loading…" />}
              {(addresses.data ?? []).map(address => (
                <ListRow
                  key={address.id}
                  icon={<MapPin />}
                  tone="green"
                  title={
                    <>
                      {address.label}
                      {address.is_default && <Badge tone="green" className="ml-2 align-middle">Default</Badge>}
                    </>
                  }
                  subtitle={
                    <>
                      {address.recipient_name}
                      {address.company_name ? ` · ${address.company_name}` : ""}
                      <br />
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}
                      <br />
                      {address.city}
                      {address.state ? `, ${address.state}` : ""}
                      {address.postal_code ? ` ${address.postal_code}` : ""}, {address.country}
                    </>
                  }
                />
              ))}
            </ListGroup>
          )}
        </section>

        <ListGroup header="Shortcuts">
          <ListRow href="/dashboard" icon={<LayoutDashboard />} tone="blue" title="My quotes" chevron />
          <ListRow href="/orders" icon={<Package />} tone="teal" title="Track an order" chevron />
          <ListRow href="/contact" icon={<HelpCircle />} tone="orange" title="Contact us" chevron />
          {user.role === "admin" && <ListRow href="/admin" icon={<LayoutDashboard />} tone="indigo" title="Open admin" chevron />}
        </ListGroup>

        <AppearanceSetting />

        <ListGroup>
          <ListRow
            icon={<LogOut />}
            tone="red"
            title="Sign out"
            onClick={() => {
              void logout().then(() => navigate("/"));
            }}
          />
        </ListGroup>
      </Container>
    </SiteLayout>
  );
}
