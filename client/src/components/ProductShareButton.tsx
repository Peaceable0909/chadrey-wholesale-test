import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

type ProductShareButtonProps = {
  url: string;
  name: string;
  description: string;
  compact?: boolean;
};

export default function ProductShareButton({ url, name, description, compact = false }: ProductShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function shareProduct() {
    const absoluteUrl = new URL(url, window.location.origin).toString();
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: description, url: absoluteUrl });
      } else {
        await navigator.clipboard.writeText(absoluteUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(absoluteUrl);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2200);
        } catch (copyError) {
          console.error("Unable to share product link:", copyError);
        }
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <button type="button" className={`button button-secondary share-button ${compact ? "share-button-compact" : ""}`} onClick={shareProduct} disabled={sharing}>
      {copied ? <Check size={16} /> : compact ? <Copy size={16} /> : <Share2 size={16} />}
      {copied ? "Link copied" : sharing ? "Sharing…" : "Share"}
    </button>
  );
}
