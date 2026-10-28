import { describe, it, expect, beforeEach, vi } from 'vitest'

let createMockWorkBuddyCloud
let cloud

beforeEach(async () => {
  localStorage.clear()
  vi.resetModules()
  ;({ createMockWorkBuddyCloud } = await import('../../src/mock/mock-cloud.js'))
  cloud = createMockWorkBuddyCloud()
})

async function login(email = 'budi@contoh.id') {
  const events = []
  const listener = (e) => events.push(e.detail)
  window.addEventListener('mock-otp-sent', listener)
  const sent = await cloud.auth.sendOtp({ email })
  window.removeEventListener('mock-otp-sent', listener)
  const { data: session } = await cloud.auth.verifyOtp({
    email,
    verificationId: sent.data.verificationId,
    isExistingUser: sent.data.isExistingUser,
    token: events[0].code,
  })
  return { session, events }
}

describe('mockAuth.sendOtp', () => {
  it('menolak email tidak valid', async () => {
    await expect(cloud.auth.sendOtp({ email: 'bukan-email' })).rejects.toThrow(/tidak valid/i)
  })

  it('mengirim verificationId dan men-dispatch event kode OTP', async () => {
    const events = []
    window.addEventListener('mock-otp-sent', (e) => events.push(e.detail))
    const { data } = await cloud.auth.sendOtp({ email: 'budi@contoh.id' })

    expect(data.verificationId).toBeTruthy()
    expect(data.isExistingUser).toBe(false)
    expect(events).toHaveLength(1)
    expect(events[0].email).toBe('budi@contoh.id')
    expect(events[0].code).toMatch(/^\d{6}$/)
  })
})

describe('mockAuth.verifyOtp', () => {
  it('menolak kode yang salah', async () => {
    const { data } = await cloud.auth.sendOtp({ email: 'budi@contoh.id' })
    await expect(cloud.auth.verifyOtp({
      email: 'budi@contoh.id',
      verificationId: data.verificationId,
      token: '000000',
    })).rejects.toThrow(/salah/i)
  })

  it('membuat user baru dan session saat kode benar', async () => {
    const { session } = await login()
    expect(session.user.email).toBe('budi@contoh.id')

    const { data } = await cloud.auth.getSession()
    expect(data.user.id).toBe(session.user.id)
    expect(data.access_token).toMatch(/^mock_/)
  })

  it('mengenali user yang sudah ada (isExistingUser)', async () => {
    await login('budi@contoh.id')
    const events = []
    window.addEventListener('mock-otp-sent', (e) => events.push(e.detail))
    const sent = await cloud.auth.sendOtp({ email: 'budi@contoh.id' })
    expect(sent.data.isExistingUser).toBe(true)

    await cloud.auth.verifyOtp({
      email: 'budi@contoh.id',
      verificationId: sent.data.verificationId,
      isExistingUser: true,
      token: events[0].code,
    })
    // id user tetap sama (tidak duplikat)
    const users = JSON.parse(localStorage.getItem('satualur_mock_v1')).users
    expect(users.filter((u) => u.email === 'budi@contoh.id')).toHaveLength(1)
  })

  it('OTP hanya bisa dipakai sekali', async () => {
    const events = []
    window.addEventListener('mock-otp-sent', (e) => events.push(e.detail))
    const { data } = await cloud.auth.sendOtp({ email: 'budi@contoh.id' })
    await cloud.auth.verifyOtp({
      email: 'budi@contoh.id',
      verificationId: data.verificationId,
      token: events[0].code,
    })
    await expect(cloud.auth.verifyOtp({
      email: 'budi@contoh.id',
      verificationId: data.verificationId,
      token: events[0].code,
    })).rejects.toThrow()
  })
})

describe('mockAuth.session', () => {
  it('getSession null sebelum login', async () => {
    const { data, error } = await cloud.auth.getSession()
    expect(data).toBeNull()
    expect(error.message).toMatch(/Belum masuk/)
  })

  it('onAuthStateChange menerima SIGNED_IN dan bisa berhenti', async () => {
    const calls = []
    const unsub = cloud.auth.onAuthStateChange((event, session) => calls.push({ event, session }))
    await login('budi@contoh.id')
    expect(calls.map((c) => c.event)).toContain('SIGNED_IN')
    expect(calls.at(-1).session.user.email).toBe('budi@contoh.id')

    unsub()
    await cloud.auth.signOut()
    const after = calls.filter((c) => c.event === 'SIGNED_OUT')
    expect(after).toHaveLength(0)
  })

  it('signOut mengosongkan session dan memberi notifikasi', async () => {
    const calls = []
    cloud.auth.onAuthStateChange((event) => calls.push(event))
    await login('budi@contoh.id')
    await cloud.auth.signOut()

    expect(calls).toContain('SIGNED_OUT')
    const { data } = await cloud.auth.getSession()
    expect(data).toBeNull()
  })
})

describe('mockAuth OAuth', () => {
  it('ketiga method OAuth tidak tersedia di prototype mode', async () => {
    await expect(cloud.auth.signInWithOAuth()).rejects.toThrow(/tidak tersedia/i)
    await expect(cloud.auth.handleWechatWebCallback()).rejects.toThrow(/tidak tersedia/i)
    await expect(cloud.auth.handleWorkBuddyCallback()).rejects.toThrow(/tidak tersedia/i)
  })
})
