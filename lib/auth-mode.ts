export type AuthMode = "demo" | "clerk" | "chatgpt";

export function authMode(): AuthMode {
  const mode = process.env.AUTH_MODE;
  if (mode === "demo" || mode === "clerk") return mode;
  return "chatgpt";
}
