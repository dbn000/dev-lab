import type { ArasaacLanguage, PictogramIndexRecord } from './types'

/** Storage seam: replace this implementation with Vercel KV, Postgres or IndexedDB without changing the UI. */
export interface PictogramIndexRepository {
  upsert(records: PictogramIndexRecord[]): Promise<void>
  find(id: number, language: ArasaacLanguage): Promise<PictogramIndexRecord | undefined>
}

export class MemoryPictogramIndexRepository implements PictogramIndexRepository {
  private readonly records = new Map<string, PictogramIndexRecord>()
  async upsert(records: PictogramIndexRecord[]) {
    records.forEach((record) => this.records.set(`${record.language}:${record.id}`, record))
  }
  async find(id: number, language: ArasaacLanguage) { return this.records.get(`${language}:${id}`) }
}

export const pictogramIndexRepository = new MemoryPictogramIndexRepository()
