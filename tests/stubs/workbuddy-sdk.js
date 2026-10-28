import { vi } from 'vitest'

export const createWorkBuddyCloud = vi.fn(() => ({
  auth: {},
  database: {},
  storage: {},
  llm: {},
}))

export default { createWorkBuddyCloud }
