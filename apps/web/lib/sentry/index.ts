/**
 * Sentry hooks. `beforeSend` filters and transforms events before they
 * leave the runtime; wired into the Sentry SDK init in the Next.js layout.
 */
export { beforeSend } from "./before-send";
