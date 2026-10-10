import { ClipboardList, Globe, Mail } from "lucide-react";
import { ButtonLink, ListGroup, ListRow, PageHeader } from "@/components/ios";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { siteConfig } from "@/lib/siteConfig";

export default function Contact() {
  usePageTitle("Contact us");
  return (
    <SiteLayout>
      <Container size="form" className="space-y-7 pt-4 md:pt-8">
        <PageHeader title="Contact us" subtitle="Tell us what you are sourcing. A real person replies with the next step." />

        <ListGroup>
          <ListRow href={`mailto:${siteConfig.supportEmail}`} icon={<Mail />} tone="blue" title="Email" subtitle={siteConfig.supportEmail} chevron />
          <ListRow href="/quote" icon={<ClipboardList />} tone="orange" title="Request a callback" subtitle="Leave your number in a quote request and we will call you back" chevron />
          <ListRow icon={<Globe />} tone="green" title="Coverage" subtitle={`We source from dealers in ${siteConfig.sourcingCountry}. Email us your delivery location to confirm coverage and lead time.`} />
        </ListGroup>

        <ButtonLink href="/quote" size="lg" full>
          Start a quote request
        </ButtonLink>
      </Container>
    </SiteLayout>
  );
}
