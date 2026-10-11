import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { BackLink } from "@/components/ios";
import { PageLoading, SignInRequired } from "@/components/layout/PageState";
import { Container } from "@/components/layout/Container";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { trpc } from "@/lib/trpc";

type Sent = { id: number; body: string };

export default function QuoteMessages() {
  usePageTitle("Messages");
  const search = useSearch();
  const { user, loading } = useAuth();
  const quoteRequestId = Number(new URLSearchParams(search).get("quoteId"));
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<Sent[]>([]);
  const createMessage = trpc.messages.create.useMutation();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sent.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    try {
      await createMessage.mutateAsync({ quoteRequestId, body: text });
      setSent(current => [...current, { id: Date.now(), body: text }]);
      setBody("");
    } catch {
      toast.error("Your message could not be sent. Please try again.");
    }
  }

  if (loading) return <SiteLayout tabBar={false}><PageLoading /></SiteLayout>;
  if (!user) return <SiteLayout><SignInRequired title="Sign in to message us" /></SiteLayout>;

  return (
    <SiteLayout tabBar={false} footer={false} className="pb-28">
      <Container size="narrow" className="pt-2 md:pt-6">
        <BackLink href="/dashboard">My quotes</BackLink>
        <h1 className="mt-1 text-largetitle font-bold">Messages</h1>
        <p className="mt-1 text-body text-label-2">Ask about lead time, payment terms, samples, or changes to your request.</p>

        <div className="mt-8 space-y-2.5" aria-live="polite">
          <p className="mx-auto max-w-xs text-center text-footnote text-label-2">Messages you send here go to the Chadrey team.</p>
          {sent.map(message => (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[78%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-[6px] bg-navy px-4 py-2.5 text-body text-white dark:bg-tint dark:text-on-tint">{message.body}</p>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </Container>

      <form onSubmit={submit} className="material hairline-t pb-safe fixed inset-x-0 bottom-0 z-40">
        <div className="gutter mx-auto flex max-w-[640px] items-end gap-2.5 pb-3 pt-3">
          <label className="sr-only" htmlFor="message-body">
            Message
          </label>
          <textarea
            id="message-body"
            rows={1}
            value={body}
            onChange={event => setBody(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && window.matchMedia("(hover: hover)").matches) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Message"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] bg-fill-3 px-4 py-2.5 text-body outline-none placeholder:text-label-2 focus-visible:ring-2 focus-visible:ring-tint/40"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!body.trim() || createMessage.isPending}
            className="press grid size-11 shrink-0 place-items-center rounded-full bg-tint text-on-tint disabled:bg-fill-1 disabled:text-label-3">
            <ArrowUp className="size-5" strokeWidth={2.6} />
          </button>
        </div>
      </form>
    </SiteLayout>
  );
}
