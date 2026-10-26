import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import bcrypt from 'bcryptjs';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

const iterations = 600000; // Retain verification of existing PBKDF2 accounts.
const prefix = 'bcrypt-hmac-sha256$';
const cost = 10;
export const dummyPasswordHash = `${prefix}$2b$10$${'.'.repeat(53)}`;

// Salted pre-hashing preserves the full UTF-8 password beyond bcrypt's 72-byte limit.
function bcryptInput(password, salt) {
  return bytesToHex(hmac(sha256, salt, utf8ToBytes(password)));
}

export async function hashPassword(password, randomBytes = size => globalThis.crypto.getRandomValues(new Uint8Array(size))) {
  const salt = await randomBytes(16);
  const bcryptSalt = `$2b$${cost}$${bcrypt.encodeBase64(salt, 16)}`;
  return prefix + await bcrypt.hash(bcryptInput(password, salt), bcryptSalt);
}

export async function verifyPassword(password, record) {
  if (typeof record !== 'string' || typeof password !== 'string') return false;
  if (record.startsWith(prefix)) {
    const hash = record.slice(prefix.length);
    if (!/^\$2b\$10\$[./A-Za-z0-9]{53}$/.test(hash)) return false;
    const salt = new Uint8Array(bcrypt.decodeBase64(hash.slice(7, 29), 16));
    return bcrypt.compare(bcryptInput(password, salt), hash);
  }
  const [algorithm, count, salt, expected, extra] = record.split('$');
  if (extra !== undefined) return false;
  if (algorithm !== 'pbkdf2-sha256' || Number(count) !== iterations || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  let hash;
  if (globalThis.crypto?.subtle) {
    const key = await globalThis.crypto.subtle.importKey('raw', utf8ToBytes(password), 'PBKDF2', false, ['deriveBits']);
    hash = new Uint8Array(await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations }, key, 256));
  } else {
    hash = await pbkdf2Async(sha256, utf8ToBytes(password), hexToBytes(salt), { c: iterations, dkLen: 32 });
  }
  const wanted = hexToBytes(expected);
  let difference = 0;
  for (let index = 0; index < hash.length; index++) difference |= hash[index] ^ wanted[index];
  return difference === 0;
}

export function needsPasswordMigration(record) {
  return record.startsWith('pbkdf2-sha256$');
}
