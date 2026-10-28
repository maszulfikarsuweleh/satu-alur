import { beforeEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

/* ---------- Polyfill minimal untuk jsdom ---------- */

if (!globalThis.crypto) globalThis.crypto = {}

if (typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: randomUUID,
    configurable: true,
    writable: true,
  })
}

if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = (str) => Buffer.from(String(str), 'binary').toString('base64')
}

if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
}

/* ---------- Isolasi antar test ---------- */

beforeEach(() => {
  localStorage.clear()
  document.head.innerHTML = ''
  document.body.innerHTML = ''

  // Kode AntiSlop memang sengaja berisik (console.warn/error).
  // Di-senyapkan agar output test bersih; test yang perlu assert memakai vi.mocked(console.warn).
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'group').mockImplementation(() => {})
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
})
