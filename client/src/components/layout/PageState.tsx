import * as React from "react";
import { Lock, ShieldAlert, type LucideIcon } from "lucide-react";
import { useLocation } from "wouter";
import { ButtonLink, LoadingBlock } from "@/components/ios";
import { toneSoft } from "@/components/ios/tone";
import type { Tone } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Container } from "./Container";

type CenteredStateProps = {
  icon: LucideIcon;
  tone?: Tone;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

/** A calm, centered full-page message with an icon and optional actions. */
export function CenteredState({ icon: Icon, tone = "blue", title, description, children, className }: CenteredStateProps) {
  return (
    <Container size="narrow" className={cn("py-16 md:py-24", className)}>
      <div className="flex flex-col items-center text-center">
        <span className={cn("mb-5 grid size-[72px] place-items-center rounded-[22px]", toneSoft[tone])}>
          <Icon className="size-9" strokeWidth={1.6} aria-hidden />
        </span>
        <h1 className="text-title1 font-bold">{title}</h1>
        {description && <p className="mt-2 max-w-md text-body text-label-2">{description}</p>}
        {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
      </div>
    </Container>
  );
}

export function PageLoading({ label }: { label?: string }) {
  return (
    <Container size="narrow">
      <LoadingBlock label={label} />
    </Container>
  );
}

/** Shown to signed-out visitors; after signing in they come straight back to this page. */
export function SignInRequired({ title = "Sign in to continue", description }: { title?: string; description?: React.ReactNode }) {
  const [path] = useLocation();
  const next = `${path}${window.location.search}`;
  return (
    <CenteredState icon={Lock} title={title} description={description ?? "Your quotes, orders and saved details live in your account."}>
      <ButtonLink href={`/login?next=${encodeURIComponent(next)}`} size="lg">
        Sign in
      </ButtonLink>
      <ButtonLink href="/products" variant="gray" size="lg">
        Browse products
      </ButtonLink>
    </CenteredState>
  );
}

export function AdminSignInRequired() {
  return (
    <CenteredState icon={Lock} title="Admin sign-in required" description="Sign in with an administrator account to open the operations workspace.">
      <ButtonLink href="/admin/login" size="lg">
        Sign in to admin
      </ButtonLink>
      <ButtonLink href="/" variant="gray" size="lg">
        Back to store
      </ButtonLink>
    </CenteredState>
  );
}

export function AccessRestricted({ description }: { description?: React.ReactNode }) {
  return (
    <CenteredState icon={ShieldAlert} tone="orange" title="Access restricted" description={description ?? "This area is for Chadrey Wholesale administrators only."}>
      <ButtonLink href="/dashboard" size="lg">
        Go to my account
      </ButtonLink>
    </CenteredState>
  );
}
