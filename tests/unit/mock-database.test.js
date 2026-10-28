import { describe, it, expect, beforeEach, vi } from 'vitest'

// Pakai tabel non-seed agar tidak terganggu data demo dari seedDemoData().
const TABLE = 'test_rows'

let cloud

beforeEach(async () => {
  localStorage.clear()
  vi.resetModules()
  const { createMockWorkBuddyCloud } = await import('../../src/mock/mock-cloud.js')
  cloud = createMockWorkBuddyCloud()
})

async function seedRows() {
  await cloud.database.from(TABLE).insert([
    { name: 'Alpha', qty: 1 },
    { name: 'beta', qty: 2 },
    { name: 'Gamma', qty: 3 },
    { name: 'delta', qty: 4 },
  ])
}

describe('insert', () => {
  it('objek tunggal mendapat id, created_at, dan owner_id', async () => {
    const { data, error } = await cloud.database.from(TABLE).insert({ name: 'satu', qty: 1 })
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('satu')
    expect(data[0].id).toBeTruthy()
    expect(data[0].owner_id).toBe('anon')
    expect(new Date(data[0].created_at).toString()).not.toBe('Invalid Date')
  })

  it('array insert menghasilkan beberapa baris', async () => {
    const { data } = await cloud.database.from(TABLE).insert([{ name: 'a' }, { name: 'b' }])
    expect(data).toHaveLength(2)
  })
})

describe('select + filter', () => {
  beforeEach(seedRows)

  it('select * mengembalikan semua baris', async () => {
    const { data } = await cloud.database.from(TABLE).select('*')
    expect(data).toHaveLength(4)
  })

  it.each([
    ['eq', 'qty', 2, 1],
    ['neq', 'qty', 2, 3],
    ['gt', 'qty', 2, 2],
    ['gte', 'qty', 2, 3],
    ['lt', 'qty', 2, 1],
    ['lte', 'qty', 2, 2],
  ])('%s(%s, %i) -> %i baris', async (op, col, val, expected) => {
    const { data } = await cloud.database.from(TABLE).select('*')[op](col, val)
    expect(data).toHaveLength(expected)
  })

  it('like bersifat case-sensitive', async () => {
    const { data } = await cloud.database.from(TABLE).select('*').like('name', '%Alp%')
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('Alpha')
  })

  it('ilike tidak case-sensitive', async () => {
    const { data } = await cloud.database.from(TABLE).select('*').ilike('name', '%ALP%')
    expect(data).toHaveLength(1)
  })

  it('in memfilter daftar nilai', async () => {
    const { data } = await cloud.database.from(TABLE).select('*').in('qty', [1, 3])
    expect(data).toHaveLength(2)
  })

  it('is mencocokkan null', async () => {
    await cloud.database.from(TABLE).insert({ name: 'TanpaQty', qty: null })
    const { data } = await cloud.database.from(TABLE).select('*').is('qty', null)
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('TanpaQty')
  })

  it('match mencocokkan beberapa kolom', async () => {
    const { data } = await cloud.database.from(TABLE).select('*').match({ qty: 2, name: 'beta' })
    expect(data).toHaveLength(1)
  })

  it('or() mengevaluasi beberapa kondisi dengan logika OR', async () => {
    const { data } = await cloud.database.from(TABLE).select('*').or('qty.eq.1,qty.eq.3')
    expect(data.map((r) => r.qty).sort()).toEqual([1, 3])
  })

  it('or() tanpa kecocokan mengembalikan nol baris', async () => {
    const { data } = await cloud.database.from(TABLE).select('*').or('qty.eq.99')
    expect(data).toHaveLength(0)
  })
})

describe('order, limit, range', () => {
  beforeEach(seedRows)

  it('order ascending dan descending', async () => {
    const asc = await cloud.database.from(TABLE).select('*').order('qty', { ascending: true })
    expect(asc.data.map((r) => r.qty)).toEqual([1, 2, 3, 4])

    const desc = await cloud.database.from(TABLE).select('*').order('qty', { ascending: false })
    expect(desc.data.map((r) => r.qty)).toEqual([4, 3, 2, 1])
  })

  it('limit memotong hasil', async () => {
    const { data } = await cloud.database.from(TABLE).select('*').order('qty').limit(2)
    expect(data.map((r) => r.qty)).toEqual([1, 2])
  })

  it('range mengambil irisan', async () => {
    const { data } = await cloud.database.from(TABLE).select('*').order('qty').range(1, 2)
    expect(data.map((r) => r.qty)).toEqual([2, 3])
  })
})

describe('single & maybeSingle', () => {
  beforeEach(seedRows)

  it('single mengembalikan baris tunggal', async () => {
    const { data, error } = await cloud.database.from(TABLE).select('*').eq('qty', 1).single()
    expect(error).toBeNull()
    expect(data.name).toBe('Alpha')
  })

  it('single error saat 0 baris', async () => {
    const { data, error } = await cloud.database.from(TABLE).select('*').eq('qty', 99).single()
    expect(data).toBeNull()
    expect(error.message).toMatch(/Tidak ditemukan/)
  })

  it('single error saat lebih dari 1 baris', async () => {
    const { data, error } = await cloud.database.from(TABLE).select('*').gt('qty', 1).single()
    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })

  it('maybeSingle mengembalikan null tanpa error saat kosong', async () => {
    const { data, error } = await cloud.database.from(TABLE).select('*').eq('qty', 99).maybeSingle()
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})

describe('count & head', () => {
  beforeEach(seedRows)

  it('count exact mengembalikan jumlah baris', async () => {
    const { count } = await cloud.database.from(TABLE).select('*', { count: 'exact' })
    expect(count).toBe(4)
  })

  it('head:true hanya mengembalikan count', async () => {
    const { data, count } = await cloud.database.from(TABLE).select('*', { count: 'exact', head: true })
    expect(data).toBeNull()
    expect(count).toBe(4)
  })
})

describe('update', () => {
  beforeEach(seedRows)

  it('update dengan eq hanya mengubah baris yang cocok', async () => {
    await cloud.database.from(TABLE).update({ qty: 99 }).eq('name', 'Alpha')
    const { data } = await cloud.database.from(TABLE).select('*')
    const alpha = data.find((r) => r.name === 'Alpha')
    expect(alpha.qty).toBe(99)
    expect(data.find((r) => r.name === 'beta').qty).toBe(2)
  })

  it('update tanpa filter mengubah semua baris', async () => {
    await cloud.database.from(TABLE).update({ qty: 0 })
    const { data } = await cloud.database.from(TABLE).select('*')
    expect(data.every((r) => r.qty === 0)).toBe(true)
  })

  it('update dengan gt hanya mengubah baris yang cocok', async () => {
    await cloud.database.from(TABLE).update({ qty: 0 }).gt('qty', 2)
    const { data } = await cloud.database.from(TABLE).select('*').order('qty')
    expect(data.map((r) => r.qty)).toEqual([0, 0, 1, 2])
  })
})

describe('delete', () => {
  beforeEach(seedRows)

  it('menghapus baris yang cocok dengan eq', async () => {
    await cloud.database.from(TABLE).delete().eq('name', 'Alpha')
    const { data } = await cloud.database.from(TABLE).select('*')
    expect(data).toHaveLength(3)
    expect(data.find((r) => r.name === 'Alpha')).toBeUndefined()
  })

  it('delete dengan gt menghormati operator', async () => {
    await cloud.database.from(TABLE).delete().gt('qty', 2)
    const { data } = await cloud.database.from(TABLE).select('*').order('qty')
    expect(data.map((r) => r.qty)).toEqual([1, 2])
  })
})

describe('persistensi', () => {
  it('data tetap ada setelah modul di-reload (localStorage)', async () => {
    await cloud.database.from(TABLE).insert({ name: 'persist', qty: 7 })

    vi.resetModules()
    const { createMockWorkBuddyCloud } = await import('../../src/mock/mock-cloud.js')
    const cloud2 = createMockWorkBuddyCloud()

    const { data } = await cloud2.database.from(TABLE).select('*').eq('name', 'persist')
    expect(data).toHaveLength(1)
  })

  it('seedDemoData hanya jalan sekali (idempoten)', async () => {
    const { data: first } = await cloud.database.from('requests').select('*')
    expect(first).toHaveLength(8)

    vi.resetModules()
    const { createMockWorkBuddyCloud } = await import('../../src/mock/mock-cloud.js')
    const cloud2 = createMockWorkBuddyCloud()
    const { data: second } = await cloud2.database.from('requests').select('*')
    expect(second).toHaveLength(8)
  })
})
