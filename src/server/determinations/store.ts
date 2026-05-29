import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { DeterminationAssertion, DeterminationStoreState } from './types'

const DATA_DIR = path.resolve(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'determinations.json')

function emptyState(): DeterminationStoreState {
  return {
    assertions: [],
    revision: 0,
  }
}

class DeterminationJsonStore {
  private state: DeterminationStoreState = emptyState()
  private loaded = false
  private writeLock: Promise<void> = Promise.resolve()

  async init(): Promise<void> {
    if (this.loaded) return
    await fs.mkdir(DATA_DIR, { recursive: true })
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8')
      const parsed = JSON.parse(raw) as Partial<DeterminationStoreState>
      this.state = {
        assertions: Array.isArray(parsed.assertions) ? parsed.assertions : [],
        revision: parsed.revision ?? 0,
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      this.state = emptyState()
    }
    this.loaded = true
  }

  private async flush(): Promise<void> {
    this.state.revision += 1
    this.writeLock = this.writeLock.then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf8')
    })
    await this.writeLock
  }

  async listAssertions(): Promise<ReadonlyArray<DeterminationAssertion>> {
    await this.init()
    return this.state.assertions.slice().sort((a, b) => {
      return b.createdAt.localeCompare(a.createdAt)
    })
  }

  async appendAssertion(
    assertion: DeterminationAssertion,
  ): Promise<DeterminationAssertion> {
    await this.init()
    if (this.state.assertions.some((row) => row.id === assertion.id)) {
      return assertion
    }
    this.state.assertions.push(assertion)
    await this.flush()
    return assertion
  }
}

let singleton: DeterminationJsonStore | null = null

export function getDeterminationStore(): DeterminationJsonStore {
  if (!singleton) singleton = new DeterminationJsonStore()
  return singleton
}
