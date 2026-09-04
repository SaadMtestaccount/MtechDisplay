/**
 * lib/screens/codes.ts — SERVER ONLY. Per-screen login codes (docs/CONTRACTS.md §15).
 * A persistent 8-char code the store types on the TV to log it into a screen. Alphabet excludes
 * 0/O/1/I. Stored raw; displayed as "XXXX-XXXX" via formatLoginCode (lib/utils, isomorphic).
 */
import { randomInt } from 'node:crypto'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LOGIN_CODE_LENGTH = 8

export function generateLoginCode(): string {
  let code = ''
  for (let i = 0; i < LOGIN_CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

/** Strip spaces/dashes and upper-case what the TV operator typed. */
export function normalizeLoginCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}
