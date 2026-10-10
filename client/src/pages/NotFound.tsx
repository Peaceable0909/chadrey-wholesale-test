import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ios";
import { CenteredState } from "@/components/layout/PageState";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <SiteLayout>
      <CenteredState icon={Compass} tone="gray" title="Page not found" description="This page may have moved, or the link is out of date.">
        <ButtonLink href="/" size="lg">
          Back to home
        </ButtonLink>
        <ButtonLink href="/products" variant="gray" size="lg">
          Browse products
        </ButtonLink>
      </CenteredState>
    </SiteLayout>
  );
}
