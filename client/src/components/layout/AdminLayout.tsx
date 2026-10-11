import * as React from "react";
import { ChartColumn, Ellipsis, Inbox, LayoutDashboard, LogOut, Package, PackagePlus, Store, Truck, Users, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { BackLink, Badge, ListGroup, ListRow, Logo, PageHeader, Sheet } from "@/components/ios";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { Container } from "./Container";
import { AccessRestricted, AdminSignInRequired, PageLoading } from "./PageState";

type NavItem = { href: string; label: string; icon: LucideIcon; active: (path: string) => boolean };

const OPERATIONS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, active: path => path === "/admin" },
  { href: "/admin/quotes", label: "Quote requests", icon: Inbox, active: path => path === "/admin/quotes" || path === "/admin/quote" },
  { href: "/admin/fulfilment", label: "Orders", icon: Truck, active: path => path === "/admin/fulfilment" },
  { href: "/admin/analytics", label: "Analytics", icon: ChartColumn, active: path => path === "/admin/analytics" },
];

const CATALOGUE: NavItem[] = [
  { href: "/admin/products", label: "Products", icon: Package, active: path => path === "/admin/products" },
  { href: "/admin/products/new", label: "Add product", icon: PackagePlus, active: path => path === "/admin/products/new" },
  { href: "/admin/users", label: "Users", icon: Users, active: path => path === "/admin/users" },
];

function SidebarGroup({ title, items, path }: { title: string; items: NavItem[]; path: string }) {
  return (
    <div>
      <h2 className="px-3 pb-1.5 text-caption font-semibold uppercase tracking-wider text-label-2">{title}</h2>
      <ul className="space-y-0.5">
        {items.map(item => {
          const active = item.active(path);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-10 items-center gap-3 rounded-[10px] px-3 text-body transition-colors", active ? "bg-tint-soft font-semibold text-tint-text" : "text-label hover:bg-fill-4")}>
                <item.icon className="size-5" strokeWidth={active ? 2.1 : 1.7} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Sidebar({ path }: { path: string }) {
  return (
    <aside className="material hairline-b fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-separator px-3 py-5 lg:flex">
      <Link href="/admin" className="press mb-7 flex items-center gap-2.5 px-3" aria-label="Admin overview">
        <Logo />
        <Badge tone="blue">Admin</Badge>
      </Link>
      <div className="space-y-6">
        <SidebarGroup title="Operations" items={OPERATIONS} path={path} />
        <SidebarGroup title="Catalogue" items={CATALOGUE} path={path} />
      </div>
      <Link href="/" className="mt-auto flex h-10 items-center gap-3 rounded-[10px] px-3 text-body text-label-2 transition-colors hover:bg-fill-4 hover:text-label">
        <Store className="size-5" strokeWidth={1.7} aria-hidden />
        Back to store
      </Link>
    </aside>
  );
}

function MobileTabBar({ path }: { path: string }) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [, navigate] = useLocation();
  const { logout } = useAuth();
  const tab = (href: string, label: string, Icon: LucideIcon, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("press flex h-full flex-col items-center justify-center gap-0.5 text-caption2 font-medium", active ? "text-tint-text" : "text-label-2")}>
      <Icon className="size-6" strokeWidth={active ? 2.2 : 1.7} aria-hidden />
      {label}
    </Link>
  );
  const moreActive = ["/admin/fulfilment", "/admin/analytics", "/admin/users"].includes(path);

  return (
    <>
      <nav aria-label="Admin" className="material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="grid h-[var(--tab-h)] grid-cols-5">
          {tab("/admin", "Overview", LayoutDashboard, path === "/admin")}
          {tab("/admin/products", "Products", Package, path === "/admin/products")}
          <Link href="/admin/products/new" aria-label="Add product" className="flex h-full items-center justify-center">
            <span className="press grid size-12 -translate-y-1.5 place-items-center rounded-full bg-tint text-on-tint shadow-float">
              <PackagePlus className="size-6" strokeWidth={2} />
            </span>
          </Link>
          {tab("/admin/quotes", "Quotes", Inbox, path === "/admin/quotes" || path === "/admin/quote")}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn("press flex h-full flex-col items-center justify-center gap-0.5 text-caption2 font-medium", moreActive ? "text-tint-text" : "text-label-2")}>
            <Ellipsis className="size-6" strokeWidth={moreActive ? 2.2 : 1.7} aria-hidden />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="More">
        <div className="space-y-5 pb-4">
          <ListGroup>
            <ListRow href="/admin/fulfilment" icon={<Truck />} tone="teal" title="Orders" chevron onClick={() => setMoreOpen(false)} />
            <ListRow href="/admin/analytics" icon={<ChartColumn />} tone="indigo" title="Analytics" chevron onClick={() => setMoreOpen(false)} />
            <ListRow href="/admin/users" icon={<Users />} tone="purple" title="Users" chevron onClick={() => setMoreOpen(false)} />
          </ListGroup>
          <ListGroup>
            <ListRow href="/" icon={<Store />} tone="blue" title="Back to store" chevron onClick={() => setMoreOpen(false)} />
            <ListRow
              icon={<LogOut />}
              tone="red"
              title="Sign out"
              onClick={() => {
                setMoreOpen(false);
                void logout().then(() => navigate("/"));
              }}
            />
          </ListGroup>
        </div>
      </Sheet>
    </>
  );
}

type AdminLayoutProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  width?: "wide" | "form";
  /** Extra classes for the large title, e.g. `hidden lg:flex` to show it on desktop only. */
  headerClassName?: string;
  /** Pass `false` on form screens that bring their own fixed action bar, so the two never stack on a phone. */
  tabBar?: boolean;
  children: React.ReactNode;
};

/**
 * Shell for every operations page: sidebar on desktop, tab bar on phones, and the sign-in /
 * administrator check, so individual pages only render their own content.
 */
export function AdminLayout({ title, subtitle, actions, back, width = "wide", headerClassName, tabBar = true, children }: AdminLayoutProps) {
  const { user, loading } = useAuth();
  const [path] = useLocation();

  let body: React.ReactNode;
  if (loading) body = <PageLoading label="Loading…" />;
  else if (!user) body = <AdminSignInRequired />;
  else if (user.role !== "admin") body = <AccessRestricted />;
  else {
    body = (
      <Container size={width === "form" ? "form" : "wide"} className="py-6 md:py-10 lg:max-w-[1040px]">
        {back && <BackLink href={back.href}>{back.label}</BackLink>}
        <PageHeader title={title} subtitle={subtitle} actions={actions} className={cn("mb-6 md:mb-8", back && "mt-1", headerClassName)} />
        <div>{children}</div>
      </Container>
    );
  }

  return (
    <div className={cn("min-h-dvh lg:pb-0 lg:pl-64", tabBar && "pb-[calc(var(--tab-h)+env(safe-area-inset-bottom)+8px)]")}>
      <Sidebar path={path} />
      <header className="material hairline-b pt-safe sticky top-0 z-40 lg:hidden">
        <div className="gutter flex h-[var(--nav-h)] items-center justify-between">
          <Link href="/admin" className="press flex items-center gap-2" aria-label="Admin overview">
            <Logo />
            <Badge tone="blue">Admin</Badge>
          </Link>
          {user && <Avatar name={user.name} email={user.email} />}
        </div>
      </header>
      <main id="main" className="page-enter">
        {body}
      </main>
      {tabBar && <MobileTabBar path={path} />}
    </div>
  );
}
