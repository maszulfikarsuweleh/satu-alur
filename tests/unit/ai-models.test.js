import { describe, it, expect, beforeEach, vi } from 'vitest'

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }))

vi.mock('../../src/cloud.js', () => ({
  getCloud: () => ({ llm: { models: { list: listMock } } }),
}))

let loadModels, getModels, pickDefaultModel

beforeEach(async () => {
  vi.resetModules()
  listMock.mockReset()
  ;({ loadModels, getModels, pickDefaultModel } = await import('../../src/ai/models.js'))
})

describe('sebelum loadModels', () => {
  it('getModels mengembalikan array kosong', () => {
    expect(getModels()).toEqual([])
  })

  it('pickDefaultModel mengembalikan null', () => {
    expect(pickDefaultModel()).toBeNull()
  })
})

describe('loadModels', () => {
  it('memuat dan memfilter model yang disabled', async () => {
    listMock.mockResolvedValue({
      data: [
        { id: 'm1', name: 'Model 1', disabled: false },
        { id: 'm2', name: 'Model 2', disabled: true },
        { id: 'm3', name: 'Model 3' },
      ],
      error: null,
    })
    const models = await loadModels()
    expect(models.map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(getModels()).toHaveLength(2)
  })

  it('throw saat error dari cloud', async () => {
    listMock.mockResolvedValue({ data: null, error: { message: 'koneksi gagal' } })
    await expect(loadModels()).rejects.toThrow(/Gagal memuat model/)
  })

  it('throw saat tidak ada model tersedia', async () => {
    listMock.mockResolvedValue({ data: [{ id: 'x', disabled: true }], error: null })
    await expect(loadModels()).rejects.toThrow(/Tidak ada model AI/)
  })
})

describe('pickDefaultModel', () => {
  it('mengembalikan model pertama setelah load', async () => {
    listMock.mockResolvedValue({
      data: [{ id: 'a', disabled: false }, { id: 'b', disabled: false }],
      error: null,
    })
    await loadModels()
    expect(pickDefaultModel().id).toBe('a')
  })
})
