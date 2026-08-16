import { describe, expect, it, vi } from 'vitest'
import { ArasaacService, getPictogramImageUrl, normalizePictogram } from './service'

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
vi.stubGlobal('window', { location: { origin: 'http://localhost' }, setTimeout, clearTimeout })

describe('ARASAAC image URLs', () => {
  it('uses the official image endpoint and supported customisation parameters', () => {
    expect(getPictogramImageUrl(2349, { resolution: 500, color: false, plural: true, action: 'past', hair: 'blonde', skin: 'black', backgroundColor: '#ffffff' })).toBe('https://api.arasaac.org/v1/pictograms/2349?resolution=500&color=false&backgroundColor=ffffff&plural=true&action=past&hair=blonde&skin=black')
  })
})

describe('ARASAAC normalisation', () => {
  it('normalises pictogram labels, tags and image URL', () => {
    expect(normalizePictogram({ _id: 42, keywords: [{ keyword: 'comer', plural: 'comidas' }], tags: ['alimentación'], categories: ['acciones'], desc: 'Acción de comer' })).toMatchObject({ id: 42, labels: ['comer', 'alimentación'], categories: ['acciones'], imageUrl: 'https://api.arasaac.org/v1/pictograms/42?resolution=300' })
  })
  it('rejects malformed pictograms', () => expect(normalizePictogram({ keywords: [] })).toBeUndefined())
})

describe('ARASAAC service', () => {
  it('uses the proxy for search, detail and keywords', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response([{ _id: 1, keywords: [{ keyword: 'casa' }] }]))
      .mockResolvedValueOnce(response({ _id: 1, keywords: [{ keyword: 'casa' }] }))
      .mockResolvedValueOnce(response({ locale: 'es', words: ['casa', 'casita'] }))
    const service = new ArasaacService(fetcher)
    await expect(service.searchBest('casa', 'es')).resolves.toMatchObject({ ok: true, data: [{ id: 1 }] })
    await expect(service.getPictogram(1, 'es')).resolves.toMatchObject({ ok: true, data: { id: 1 } })
    await expect(service.getKeywords('es')).resolves.toMatchObject({ ok: true, data: ['casa', 'casita'] })
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(String(fetcher.mock.calls[0][0])).toContain('operation=bestsearch')
  })
  it('returns a safe, retryable error for upstream failures', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ message: 'internal details' }, 503))
    const result = await new ArasaacService(fetcher).search('fallo-red', 'es')
    expect(result).toEqual({ ok: false, error: { code: 'UPSTREAM', message: 'ARASAAC no está disponible en este momento. Inténtalo de nuevo.', retryable: true } })
  })
})
