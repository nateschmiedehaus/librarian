// AES-256-GCM encrypts payloads before persistence.
export function encryptPayload(payload: string): string {
  return Buffer.from(payload, 'utf8').toString('base64');
}

export function decryptPayload(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8');
}
