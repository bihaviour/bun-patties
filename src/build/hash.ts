// Spec calls for xxh64 — non-cryptographic, fast, stable. Bun's CryptoHasher
// does not expose xxh64 on every release; fall back to a truncated sha1 (also
// fast and stable) when xxh64 is unavailable. For SRI-grade hashes, the caller
// uses sha256 directly.
const ALGO = pickAlgo()

export function xxh64(bytes: Uint8Array | string): string {
  return new Bun.CryptoHasher(ALGO as never).update(bytes).digest("hex").slice(0, 16)
}

function pickAlgo(): string {
  try {
    new Bun.CryptoHasher("xxh64" as never)
    return "xxh64"
  } catch {
    return "sha1"
  }
}
