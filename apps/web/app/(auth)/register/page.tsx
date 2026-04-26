import { notFound } from "next/navigation";
import { RegisterClient } from "./register-client";

export default function RegisterPage() {
  if (process.env.PUBLIC_REGISTRATION === "off") notFound();
  return <RegisterClient />;
}
