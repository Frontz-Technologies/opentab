// Shared post-submit error banner for auth pages (login / register /
// reset-password / forgot-password). Uses the M3 `error` token pair
// per docs/DESIGN.md; `role="alert"` so screen readers announce the
// message on render. Render conditionally: parent passes the message
// string and omits rendering when empty.

interface FormErrorProps {
  message: string;
}

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="p-4 rounded-xl bg-error/10 text-error text-sm mb-6"
    >
      {message}
    </div>
  );
}
