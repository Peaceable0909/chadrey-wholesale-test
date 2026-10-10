import { Check, Share } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ios";

type ProductShareButtonProps = {
  url: string;
  name: string;
  description: string;
  compact?: boolean;
};

/** Opens the phone's share sheet, or copies the link where sharing is not available. */
export default function ProductShareButton({ url, name, description, compact = false }: ProductShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink(absoluteUrl: string) {
    await navigator.clipboard.writeText(absoluteUrl);
    setCopied(true);
    toast.success("Link copied");
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function shareProduct() {
    const absoluteUrl = new URL(url, window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title: name, text: description, url: absoluteUrl });
      else await copyLink(absoluteUrl);
    } catch (error) {
      // Dismissing the share sheet throws AbortError; anything else falls back to copying.
      if ((error as DOMException)?.name === "AbortError") return;
      try {
        await copyLink(absoluteUrl);
      } catch (copyError) {
        console.error("Unable to share product link:", copyError);
        toast.error("Could not share this link");
      }
    }
  }

  return (
    <Button variant="gray" size={compact ? "icon-sm" : "icon"} aria-label={copied ? "Link copied" : `Share ${name}`} onClick={shareProduct}>
      {copied ? <Check className="size-5 text-ios-green-text" strokeWidth={2.5} /> : <Share className="size-5" strokeWidth={1.9} />}
    </Button>
  );
}
