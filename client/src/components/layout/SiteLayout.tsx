import * as React from "react";
import { ClipboardList, FilePlus2, House, LayoutGrid, Search, User, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { ButtonLink, Logo } from "@/components/ios";
import { siteConfig } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { Container } from "./Container";

const isProducts = (path: string) => path === "/products" || path === "/product";

type TabItem = { href: string; label: string; icon: LucideIcon; active: (path: string) => boolean };

function useTabs(): TabItem[] {
  const { user } = useAuth();
  return [
    { href: "/", label: "Home", icon: House, active: path => path === "/" },
    { href: "/products", label: "Products", icon: LayoutGrid, active: isProducts },
    { href: "/quote", label: "New quote", icon: FilePlus2, active: path => path === "/quote" },
    { href: "/dashboard", label: "My quotes", icon: ClipboardList, active: path => ["/dashboard", "/quotation", "/messages", "/orders", "/pay"].includes(path) },
    { href: user ? "/account" : "/login", label: "Account", icon: User, active: path => ["/account", "/addresses", "/login"].includes(path) },
  ];
}

function TopBar() {
  const { user } = useAuth();
  const [path] = useLocation();
  const accountHref = user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/login";
  const links = [
    { href: "/products", label: "Products", active: isProducts(path) },
    { href: "/how-it-works", label: "How it works", active: path === "/how-it-works" },
    { href: "/contact", label: "Contact", active: path === "/contact" },
    ...(user ? [{ href: "/dashboard", label: "My quotes", active: path === "/dashboard" }] : []),
  ];

  return (
    <header className="material hairline-b pt-safe sticky top-0 z-40">
      <Container className="flex h-[var(--nav-h)] items-center justify-between gap-4">
        <Link href="/" aria-label={`${siteConfig.name} home`} className="press -ml-1 rounded-lg">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn("rounded-full px-3.5 py-1.5 text-subhead transition-colors", link.active ? "bg-fill-3 font-semibold text-label" : "text-label-2 hover:text-label")}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link href="/products?focus=1" aria-label="Search products" className="press grid size-10 place-items-center rounded-full text-label hover:bg-fill-3">
            <Search className="size-5" />
          </Link>
          <ButtonLink href="/quote" size="sm" className="hidden md:inline-flex">
            Request a quote
          </ButtonLink>
          {user ? (
            <Link href={accountHref} aria-label="My account" className="press ml-0.5 rounded-full">
              <Avatar name={user.name} email={user.email} />
            </Link>
          ) : (
            <ButtonLink href="/login" variant="gray" size="sm">
              Sign in
            </ButtonLink>
          )}
        </div>
      </Container>
    </header>
  );
}

function TabBar() {
  const [path] = useLocation();
  const tabs = useTabs();
  return (
    <nav aria-label="Main" className="material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40 md:hidden">
      <ul className="grid h-[var(--tab-h)] grid-cols-5">
        {tabs.map(tab => {
          const active = tab.active(path);
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn("press flex h-full flex-col items-center justify-center gap-0.5 text-caption2 font-medium", active ? "text-tint-text" : "text-label-2")}>
                <tab.icon className="size-6" strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <h2 className="text-footnote font-semibold uppercase tracking-wider text-label-2">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {links.map(link => (
          <li key={link.href + link.label}>
            <Link href={link.href} className="text-subhead text-label hover:text-tint-text">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-14 border-t border-separator bg-surface md:mt-20">
      <Container className="grid grid-cols-2 gap-x-6 gap-y-9 py-10 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:py-12">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-subhead text-label-2">
            {siteConfig.tagline}. Browse the range, request a quote, and we handle the import.
          </p>
        </div>
        <FooterColumn
          title="Shop"
          links={[
            { href: "/products", label: "All products" },
            { href: "/quote", label: "Request a quote" },
            { href: "/how-it-works", label: "How it works" },
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            { href: "/dashboard", label: "My quotes" },
            { href: "/orders", label: "Track an order" },
            { href: "/account", label: "Settings" },
          ]}
        />
        <FooterColumn
          title="Support"
          links={[
            { href: "/contact", label: "Contact us" },
            { href: `mailto:${siteConfig.supportEmail}`, label: siteConfig.supportEmail },
          ]}
        />
      </Container>
      <div className="border-t border-separator py-4 text-center text-footnote text-label-2">
        © {new Date().getFullYear()} {siteConfig.name} · Sourced in {siteConfig.sourcingCountry}
      </div>
    </footer>
  );
}

type SiteLayoutProps = {
  children: React.ReactNode;
  /** Bottom tab bar on phones. Turn off on screens that have their own sticky action bar. */
  tabBar?: boolean;
  footer?: boolean;
  className?: string;
};

/** The shared public shell: translucent top bar, bottom tab bar on phones, footer. */
export function SiteLayout({ children, tabBar = true, footer = true, className }: SiteLayoutProps) {
  return (
    <div className={cn("min-h-dvh", tabBar && "pb-[calc(var(--tab-h)+env(safe-area-inset-bottom))] md:pb-0")}>
      <a href="#main" className="sr-only z-50 rounded-full bg-surface px-4 py-2 text-subhead font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <TopBar />
      <main id="main" className={cn("page-enter", className)}>
        {children}
      </main>
      {footer && <Footer />}
      {tabBar && <TabBar />}
    </div>
  );
}
