// Pure byte-identity check: does a served response exactly match the asset
// bytes in this checkout? This proves source identity, not that a browser
// fetched, parsed or rendered the file.
import { createHash } from 'node:crypto';

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function checkAssetIdentity({ label, status, body, expected }) {
  const expectedSha256 = sha256Hex(expected);
  const expectedBytes = expected.length;
  if (status !== 200) {
    return { label, ok: false, status, expectedSha256, expectedBytes, reason: `expected HTTP 200, got ${status}` };
  }
  const sha256 = sha256Hex(body);
  const bytes = body.length;
  const ok = sha256 === expectedSha256 && bytes === expectedBytes;
  return { label, ok, status, sha256, bytes, expectedSha256, expectedBytes, reason: ok ? undefined : 'byte mismatch against checkout' };
}
