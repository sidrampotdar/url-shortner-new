import { isIP } from "net";

/**
 * SSRF protection — blocks requests to private / internal addresses.
 * Throws an error with .status = 400 on violation.
 */

const PRIVATE_RANGES = [
  /^127\./,                                          // loopback
  /^10\./,                                           // RFC-1918 class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./,                  // RFC-1918 class B
  /^192\.168\./,                                     // RFC-1918 class C
  /^169\.254\./,                                     // link-local (APIPA)
  /^0\./,                                            // this-network
  /^100\.(6[4-9]|[7-9][0-9]|1([0-1][0-9]|2[0-7]))\./, // shared address space (RFC-6598)
  /^::1$/,                                           // IPv6 loopback
  /^fc00:/i,                                         // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,                               // IPv6 unique local
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",  // AWS / GCP / Azure IMDS
  "100.100.100.200",  // Alibaba Cloud IMDS
  "192.0.0.1",
]);

function bad(msg) {
  const e = new Error(msg);
  e.status = 400;
  throw e;
}

export function validateSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    bad("Invalid URL format");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    bad("Only http and https URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) bad("URL points to a blocked address");

  if (
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".corp") ||
    hostname.endsWith(".intranet")
  ) {
    bad("URL points to an internal address");
  }

  // If the hostname is a bare IP, check private ranges
  if (isIP(hostname)) {
    if (PRIVATE_RANGES.some((r) => r.test(hostname))) {
      bad("URL points to a private or reserved IP address");
    }
  }
}
