import { ClipboardList, CreditCard, FileCheck2, Search, Truck, type LucideIcon } from "lucide-react";
import { ButtonLink, Card, PageHeader, toneSolid } from "@/components/ios";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Tone } from "@/lib/categories";
import { siteConfig } from "@/lib/siteConfig";
import { cn } from "@/lib/utils";

const STEPS: Array<{ icon: LucideIcon; tone: Tone; title: string; text: string }> = [
  { icon: Search, tone: "blue", title: "Browse products", text: `Explore goods from dealers in ${siteConfig.sourcingCountry}, with minimum orders, prices by quantity and options.` },
  { icon: ClipboardList, tone: "orange", title: "Request a quote", text: "Pick your products and quantities, then tell us anything specific about sizes, branding or timing." },
  { icon: FileCheck2, tone: "indigo", title: "Review your quotation", text: "Import prices move with exchange rates and freight, so we confirm each price and send a clear quotation." },
  { icon: CreditCard, tone: "purple", title: "Confirm and pay", text: "Accept the quotation and pay securely. Your quote, invoice and payment stay together in your account." },
  { icon: Truck, tone: "teal", title: "Track delivery", text: "Follow your order from production and shipping through to delivery." },
];

export default function HowItWorks() {
  usePageTitle("How it works");
  return (
    <SiteLayout>
      <Container size="form" className="space-y-7 pt-4 md:pt-8">
        <PageHeader title="How it works" subtitle="A simple path from browsing to delivery, all in one account." />

        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="flex items-start gap-4 p-4 md:p-5">
                <span className={cn("grid size-12 shrink-0 place-items-center rounded-[14px]", toneSolid[step.tone])}>
                  <step.icon className="size-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-footnote font-semibold uppercase tracking-wider text-label-2">Step {index + 1}</p>
                  <h2 className="text-headline font-semibold">{step.title}</h2>
                  <p className="mt-1 text-subhead text-label-2">{step.text}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>

        <Card className="p-6 text-center md:p-8">
          <h2 className="text-title2 font-bold">Ready to start?</h2>
          <p className="mt-1.5 text-body text-label-2">Browse the range or send us a quote request.</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/products" size="lg">
              Browse products
            </ButtonLink>
            <ButtonLink href="/quote" variant="gray" size="lg">
              Request a quote
            </ButtonLink>
          </div>
        </Card>
      </Container>
    </SiteLayout>
  );
}
