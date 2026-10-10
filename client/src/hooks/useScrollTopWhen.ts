import * as React from "react";

/** Scrolls to the top when `trigger` becomes truthy, e.g. when a long form is replaced by its confirmation. */
export function useScrollTopWhen(trigger: unknown) {
  const active = Boolean(trigger);
  React.useEffect(() => {
    if (active) window.scrollTo({ top: 0 });
  }, [active]);
}
