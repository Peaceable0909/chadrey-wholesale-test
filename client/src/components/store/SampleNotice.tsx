import { Button, Notice } from "@/components/ios";

/** Labels the built-in demo products so nobody mistakes them for real stock. When the live catalogue could not be loaded, it says so and offers a retry. */
export function SampleNotice({ className, loadFailed = false, onRetry }: { className?: string; loadFailed?: boolean; onRetry?: () => void }) {
  return (
    <Notice tone={loadFailed ? "orange" : "blue"} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p>
          <strong className="font-semibold">{loadFailed ? "We could not load the live catalogue." : "Sample products."}</strong>{" "}
          {loadFailed
            ? "These sample products are shown instead, and they cannot be quoted."
            : "These examples appear while the live catalogue is empty or unavailable, and they cannot be quoted."}
        </p>
        {loadFailed && onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </Notice>
  );
}
