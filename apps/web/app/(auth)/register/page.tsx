import { notFound } from "next/navigation";
import { RegisterClient } from "./register-client";
import { LegalFooter } from "@/components/auth/legal-footer";

// Server wrapper. Resolves LEGAL_*_URL env on the server and passes
// them to the client form so:
//   - The "By creating an account you agree to our Terms and Privacy"
//     consent text only renders when both URLs are configured.
//   - The Terms · Privacy footer at the bottom matches login's
//     conditional rendering.
// Self-hosters who haven't deployed legal pages get a clean signup
// flow without dead links.

export default function RegisterPage() {
  if (process.env.PUBLIC_REGISTRATION === "off") notFound();
  return (
    <RegisterClient
      termsUrl={process.env.LEGAL_TERMS_URL ?? null}
      privacyUrl={process.env.LEGAL_PRIVACY_URL ?? null}
      legalFooter={<LegalFooter />}
    />
  );
}
