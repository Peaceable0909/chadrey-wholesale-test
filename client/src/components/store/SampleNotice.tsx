import { Notice } from "@/components/ios";

/** Labels the built-in demo products so nobody mistakes them for real stock. */
export function SampleNotice({ className }: { className?: string }) {
  return (
    <Notice tone="blue" className={className}>
      <strong className="font-semibold">Sample products.</strong> These examples appear while the live catalogue is empty or unavailable, and they cannot be quoted.
    </Notice>
  );
}
