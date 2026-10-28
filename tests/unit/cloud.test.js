import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

let getCloud, isCloudReady, isUsingMockCloud, createWorkBuddyCloud

beforeEach(async () => {
  delete globalThis.__TEST_CLOUD_CONFIG__
  localStorage.clear()
  vi.resetModules()
  ;({ createWorkBuddyCloud } = await import('../../tests/stubs/workbuddy-sdk.js'))
  ;({ getCloud, isCloudReady, isUsingMockCloud } = await import('../../src/cloud.js'))
})

afterEach(() => {
  delete globalThis.__TEST_CLOUD_CONFIG__
})

describe('mode prototype (config kosong)', () => {
  it('isCloudReady false', () => {
    expect(isCloudReady()).toBe(false)
  })

  it('getCloud mengembalikan mock cloud dengan 4 service', () => {
    const cloud = getCloud()
    expect(Object.keys(cloud).sort()).toEqual(['auth', 'database', 'llm', 'storage'])
    expect(isUsingMockCloud()).toBe(true)
  })

  it('getCloud bersifat singleton', () => {
    expect(getCloud()).toBe(getCloud())
  })
})

describe('mode cloud (config terisi)', () => {
  it('memanggil SDK asli dan tidak memakai mock', async () => {
    globalThis.__TEST_CLOUD_CONFIG__ = {
      resourceId: 'r1',
      endpoint: 'https://contoh.workbuddy.link',
      oauthRelayBaseUrl: 'https://oauth.workbuddy.link',
      publishableKey: 'pk-test',
    }
    vi.resetModules()
    ;({ createWorkBuddyCloud } = await import('../../tests/stubs/workbuddy-sdk.js'))
    ;({ getCloud, isCloudReady, isUsingMockCloud } = await import('../../src/cloud.js'))

    expect(isCloudReady()).toBe(true)
    const cloud = getCloud()
    expect(createWorkBuddyCloud).toHaveBeenCalledTimes(1)
    expect(createWorkBuddyCloud).toHaveBeenCalledWith({
      endpoint: 'https://contoh.workbuddy.link',
      oauthRelayBaseUrl: 'https://oauth.workbuddy.link',
      publishableKey: 'pk-test',
    })
    expect(cloud).toBeDefined()
    expect(isUsingMockCloud()).toBe(false)
  })
})
