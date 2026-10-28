import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateOffer } from '../../src/domain/rules.js'

let cloud

beforeEach(async () => {
  localStorage.clear()
  vi.resetModules()
  const { createMockWorkBuddyCloud } = await import('../../src/mock/mock-cloud.js')
  cloud = createMockWorkBuddyCloud()
})

describe('mockStorage', () => {
  it('userPath dan sharedPath membentuk path yang benar', () => {
    expect(cloud.storage.userPath('u1', 'foto.png')).toBe('users/u1/foto.png')
    expect(cloud.storage.sharedPath('u1', 'doc.pdf')).toBe('shared/u1/doc.pdf')
  })

  it('upload menyimpan entri file', async () => {
    const { data, error } = await cloud.storage.upload('users/u1/foto.png', { size: 1024 })
    expect(error).toBeNull()
    expect(data.path).toBe('users/u1/foto.png')

    const { data: files } = await cloud.storage.list('users/u1')
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('foto.png')
    expect(files[0].size).toBe(1024)
  })

  it('list memfilter prefix dan menghormati offset/limit', async () => {
    await cloud.storage.upload('users/u1/a.png', { size: 1 })
    await cloud.storage.upload('users/u1/b.png', { size: 2 })
    await cloud.storage.upload('users/u2/c.png', { size: 3 })

    const { data: all } = await cloud.storage.list('users/u1')
    expect(all).toHaveLength(2)

    const { data: page } = await cloud.storage.list('users/u1', { offset: 1, limit: 1 })
    expect(page).toHaveLength(1)
    expect(page[0].name).toBe('b.png')
  })

  it('createSignedUrl mengembalikan URL data', async () => {
    const { data } = await cloud.storage.createSignedUrl('users/u1/foto.png', 600)
    expect(data.signedUrl).toMatch(/^data:text\/plain;base64,/)
  })
})

describe('mockLLM.models', () => {
  it('menyediakan daftar model aktif', async () => {
    const { data, error } = await cloud.llm.models.list()
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    expect(data.every((m) => m.disabled !== true)).toBe(true)
  })
})

describe('mockLLM.chat streaming', () => {
  async function collect(messages) {
    let text = ''
    let last = null
    for await (const chunk of cloud.llm.chat.completions.create({ messages, stream: true })) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) text += delta
      last = chunk
    }
    return { text, last }
  }

  it('streaming penawaran menghasilkan JSON valid yang lolos validasi domain', async () => {
    const request = { service_type: 'Cuci Sofa', location: 'Bandung', customer_name: 'Rumah Budi' }
    const { text, last } = await collect([
      { role: 'user', content: 'Permintaan jasa:\n' + JSON.stringify(request) },
    ])

    const offer = JSON.parse(text)
    expect(offer.scope).toContain('Cuci Sofa')
    expect(offer.terms.length).toBeGreaterThan(10)
    expect(validateOffer(offer).valid).toBe(true)

    expect(last.choices[0].finish_reason).toBe('stop')
    expect(last.usage.total_tokens).toBeGreaterThan(0)
  }, 30000)

  it('streaming lain menghasilkan HTML laporan', async () => {
    const { text } = await collect([{ role: 'user', content: 'Jelaskan laporan ini' }])
    expect(text).toContain('<h3>')
    expect(text).toContain('Total pendapatan')
  }, 30000)
})

describe('seedDemoData', () => {
  it('mengisi data demo lengkap', async () => {
    const counts = {}
    for (const table of ['requests', 'offers', 'assignments', 'completions', 'ledger_entries']) {
      counts[table] = (await cloud.database.from(table).select('*')).data.length
    }
    expect(counts).toEqual({
      requests: 8,
      offers: 7,
      assignments: 6,
      completions: 4,
      ledger_entries: 12,
    })
  })
})

describe('createMockWorkBuddyCloud', () => {
  it('mengekspos empat service cloud', () => {
    expect(Object.keys(cloud).sort()).toEqual(['auth', 'database', 'llm', 'storage'])
  })
})
