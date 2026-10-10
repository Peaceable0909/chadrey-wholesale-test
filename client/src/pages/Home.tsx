import * as React from "react";
import { ArrowRight, BadgeCheck, ClipboardList, FileCheck2, LayoutGrid, MapPin, PackageCheck, Search, Truck, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { ButtonLink, Card, SearchField, SectionHeader, toneSolid } from "@/components/ios";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { CategoryTile } from "@/components/store/CategoryTile";
import { ProductCard, ProductGridSkeleton, ProductRail } from "@/components/store/ProductCard";
import { ProductImage } from "@/components/store/ProductImage";
import { useCatalogue, useCategoryCounts } from "@/hooks/useCatalogue";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useSavedProducts } from "@/hooks/useSavedProducts";
import type { Product } from "@/lib/catalogue";
import { siteConfig } from "@/lib/siteConfig";
import type { Tone } from "@/lib/categories";
import { cn } from "@/lib/utils";

const STEPS: Array<{ icon: LucideIcon; tone: Tone; title: string; text: string }> = [
  { icon: Search, tone: "blue", title: "Browse", text: "Find products with prices by quantity and clear minimum orders." },
  { icon: ClipboardList, tone: "orange", title: "Request a quote", text: "Tell us what you need. Prices move with import costs, so we confirm each one." },
  { icon: FileCheck2, tone: "indigo", title: "Review your quotation", text: "Accept the quotation when the numbers work for you." },
  { icon: Truck, tone: "green", title: "Pay and track", text: "Pay securely, then follow your order until it arrives." },
];

function HeroMosaic({ products, categories }: { products: Product[]; categories: string[] }) {
  // Real product photos when we have them, otherwise soft category tiles.
  const tiles: Array<Pick<Product, "name" | "category" | "images">> = products.length
    ? products.slice(0, 4)
    : categories.slice(0, 4).map(category => ({ name: category, category, images: [] }));
  if (!tiles.length) return null;
  return (
    <div className="relative hidden w-full max-w-[400px] justify-self-end md:block" aria-hidden>
      <div className="grid grid-cols-2 gap-3.5">
        {tiles.map((tile, index) => (
          <div
            key={`${tile.name}-${index}`}
            className={cn("aspect-square overflow-hidden rounded-[26px] bg-white/15 shadow-float ring-1 ring-white/25", index % 2 === 1 && "translate-y-8")}>
            <ProductImage product={tile} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero({ products, categories }: { products: Product[]; categories: string[] }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0071e3_0%,#3b4fd6_55%,#5b3fc4_100%)] p-6 text-white md:p-12 lg:p-14">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-[#6ec1ff]/20 blur-3xl" aria-hidden />

      <div className="relative grid items-center gap-8 md:grid-cols-[1.15fr_1fr]">
        <div>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/18 px-3 text-footnote font-semibold backdrop-blur">
            <MapPin className="size-3.5" aria-hidden />
            Direct from {siteConfig.sourcingCountry}
          </span>
          <h1 className="mt-4 text-[2.125rem] font-bold leading-[1.08] tracking-tight md:text-[3.25rem]">Wholesale goods from Thai dealers.</h1>
          <p className="mt-3 max-w-md text-body text-white/85 md:text-[1.1875rem]">Browse the range, request a quote and we handle the import and delivery.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/products" variant="light" size="lg" full className="sm:w-auto sm:px-8">
              Browse products
            </ButtonLink>
            <ButtonLink href="/quote" variant="glass" size="lg" full className="sm:w-auto sm:px-8">
              Request a quote
            </ButtonLink>
          </div>
          <ul className="mt-7 hidden gap-x-6 gap-y-2 text-subhead text-white/85 md:flex md:flex-wrap">
            {["Sourced from dealers in Thailand", "Prices that drop with quantity", "Order tracking included"].map(item => (
              <li key={item} className="flex items-center gap-1.5">
                <BadgeCheck className="size-4" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <HeroMosaic products={products} categories={categories} />
      </div>
    </section>
  );
}

function HomeSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = React.useState("");
  return (
    <form
      role="search"
      onSubmit={event => {
        event.preventDefault();
        navigate(query.trim() ? `/products?q=${encodeURIComponent(query.trim())}` : "/products");
      }}>
      <SearchField value={query} onValueChange={setQuery} placeholder={`Search products from ${siteConfig.sourcingCountry}`} className="h-12 bg-surface text-body shadow-card focus:bg-surface" />
    </form>
  );
}

export default function Home() {
  usePageTitle();
  const { categories } = useCategoryCounts();
  const latest = useCatalogue({ q: "", category: "All", sort: "newest" });
  const saved = useSavedProducts();
  const arrivals = latest.items.slice(0, 8);
  const shownCategories = categories.slice(0, 7);

  return (
    <SiteLayout>
      <Container className="space-y-9 pb-4 pt-4 md:space-y-16 md:pt-8">
        <div className="md:mx-auto md:max-w-xl">
          <HomeSearch />
        </div>

        <Hero products={arrivals.filter(product => product.images.length)} categories={categories.map(item => item.category)} />

        {categories.length > 0 && (
          <section aria-labelledby="categories-heading">
            <SectionHeader
              title={<span id="categories-heading">Shop by category</span>}
              action={
                <Link href="/products" className="text-subhead text-tint-text">
                  See all
                </Link>
              }
            />
            <div className="mt-5 grid grid-cols-4 gap-x-2 gap-y-6 md:grid-cols-8">
              {shownCategories.map(item => (
                <CategoryTile key={item.category} name={item.category} />
              ))}
              <Link href="/products" className="press group flex flex-col items-center gap-2 text-center">
                <span className={cn("grid size-[60px] place-items-center rounded-[19px] shadow-card transition-transform group-hover:scale-105", toneSolid.gray)}>
                  <LayoutGrid className="size-[28px]" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="text-caption font-medium">All products</span>
              </Link>
            </div>
          </section>
        )}

        <section aria-labelledby="arrivals-heading">
          <SectionHeader
            title={<span id="arrivals-heading">New arrivals</span>}
            action={
              <Link href="/products" className="inline-flex items-center gap-0.5 text-subhead text-tint-text">
                See all <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          <div className="mt-4">
            {latest.isLoading ? (
              <ProductGridSkeleton count={4} wide />
            ) : (
              <ProductRail>
                {arrivals.map((product, index) => (
                  <ProductCard key={product.id} product={product} priority={index < 2} saved={saved.isSaved(product.slug)} onToggleSave={() => saved.toggle(product.slug)} />
                ))}
              </ProductRail>
            )}
          </div>
        </section>

        <section aria-labelledby="how-heading">
          <SectionHeader title={<span id="how-heading">How it works</span>} action={<Link href="/how-it-works" className="text-subhead text-tint-text">Learn more</Link>} />
          <ol className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full p-4 md:p-5">
                  <span className={cn("grid size-10 place-items-center rounded-[12px]", toneSolid[step.tone])}>
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <p className="mt-3 text-footnote font-semibold uppercase tracking-wider text-label-2">Step {index + 1}</p>
                  <h3 className="mt-0.5 text-headline font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-subhead text-label-2">{step.text}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <Card className="flex flex-col items-start gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-9">
            <div className="max-w-xl">
              <span className={cn("mb-3 grid size-11 place-items-center rounded-[13px]", toneSolid.blue)}>
                <PackageCheck className="size-6" aria-hidden />
              </span>
              <h2 className="text-title2 font-bold md:text-title1">Can't find what you need?</h2>
              <p className="mt-1.5 text-body text-label-2">Tell us the product and quantity. We will source it from our dealers in {siteConfig.sourcingCountry} and send you a quotation.</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink href="/quote" size="lg">
                Request a quote
              </ButtonLink>
              <ButtonLink href="/contact" variant="gray" size="lg">
                Talk to us
              </ButtonLink>
            </div>
          </Card>
        </section>
      </Container>
    </SiteLayout>
  );
}
