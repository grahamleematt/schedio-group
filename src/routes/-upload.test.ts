import { describe, expect, it } from 'vitest'

import { snapshotUploadFiles } from './upload'

describe('snapshotUploadFiles', () => {
  it('keeps selected files after the backing file input is cleared', () => {
    const file = new File(['hello'], 'invoice.pdf', {
      type: 'application/pdf',
    })
    const liveSelection: {
      0?: File
      length: number
      item: (index: number) => File | null
    } = {
      0: file,
      length: 1,
      item(index) {
        return index === 0 ? (this[0] ?? null) : null
      },
    }

    const snapshot = snapshotUploadFiles(liveSelection as FileList)
    delete liveSelection[0]
    liveSelection.length = 0

    expect(snapshot).toEqual([file])
  })

  it('returns an empty array when no files are selected', () => {
    expect(snapshotUploadFiles(null)).toEqual([])
  })
})
