import { notFound } from "next/navigation";

import PasswordLogin from "./PasswordLogin";

/**
 * Hidden fallback for the legacy username/password form, reachable only while
 * ENABLE_PASSWORD_LOGIN=true (the cutover rollback window). Nothing links here.
 * With the flag off the password provider isn't even registered, so the page
 * doesn't exist.
 */
export default function PasswordLoginPage() {
  if (process.env.ENABLE_PASSWORD_LOGIN !== "true") notFound();
  return <PasswordLogin />;
}
