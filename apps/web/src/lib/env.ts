export function getRequiredClientEnv(name: "VITE_CLERK_PUBLISHABLE_KEY" | "VITE_API_BASE_URL"): string {
  const value = import.meta.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
