export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Navigate every authentication entry point to the Firebase email/password screen. */
export const startLogin = () => {
  if (typeof window !== "undefined") window.location.assign("/login");
};
