import { LoginForm } from "./login-form";
import { LegalFooter } from "@/components/auth/legal-footer";

// Server wrapper: reads LEGAL_*_URL env on the server and passes the
// rendered footer (or null) down to the client form. Self-hosters who
// don't configure legal URLs see no Terms / Privacy links — instead of
// the previous behaviour where the buttons hardcoded https://opentab.tech
// links that 404 on their deployments.

export default function LoginPage() {
  return <LoginForm legalFooter={<LegalFooter />} />;
}
