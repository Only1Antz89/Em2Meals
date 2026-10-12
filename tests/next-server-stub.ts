// Unit tests call route handlers directly, outside a Next.js request scope,
// where the real `after` also throws.
export function after(): never {
  throw Error("`after` was called outside a request scope");
}
