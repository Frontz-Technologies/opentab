import { NotFoundView } from "@/components/layout/not-found-view";

export default function NotFound() {
  return <NotFoundView actionHref="/login" actionKey="goToSignIn" />;
}
