import { PayOS } from "@payos/node";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not defined`);
  }

  return value;
}

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function getPayOS() {
  return new PayOS({
    clientId: requireEnv("PAYOS_CLIENT_ID"),
    apiKey: requireEnv("PAYOS_API_KEY"),
    checksumKey: requireEnv("PAYOS_CHECKSUM_KEY"),
  });
}