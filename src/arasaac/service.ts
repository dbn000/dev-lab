import { pictogramIndexRepository, type PictogramIndexRepository } from './index-repository'
import type { ApiError, ApiResult, ArasaacLanguage, Material, NaturalizeOptions, Pictogram, PictogramImageOptions, PictogramIndexRecord, SearchResult } from './types'

const API_BASE = 'https://api.arasaac.org/v1'
const PROXY_URL = import.meta.env.VITE_ARASAAC_PROXY_URL || '/api/arasaac'
const SEARCH_TTL = 60_000
const METADATA_TTL = 24 * 60 * 60_000
const KEYWORDS_TTL = 24 * 60 * 60_000
type Fetcher = typeof fetch
type Operation = 'bestsearch' | 'search' | 'pictogram' | 'keywords' | 'recentPictograms' | 'changedPictograms' | 'materialsSearch' | 'recentMaterials' | 'material' | 'naturalize'

const cache = new Map<string, { expiresAt: number; value: unknown }>()
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const apiError = (code: ApiError['code'], message: string, retryable: boolean): ApiResult<never> => ({ ok: false, error: { code, message, retryable } })

export function getPictogramImageUrl(id: number, options: PictogramImageOptions = {}) {
  const params = new URLSearchParams()
  if (options.resolution) params.set('resolution', String(options.resolution))
  if (options.color !== undefined) params.set('color', String(options.color))
  if (options.backgroundColor) params.set('backgroundColor', options.backgroundColor.replace(/^#/, ''))
  if (options.plural) params.set('plural', 'true')
  if (options.action) params.set('action', options.action)
  if (options.hair) params.set('hair', options.hair)
  if (options.skin) params.set('skin', options.skin)
  const query = params.toString()
  return `${API_BASE}/pictograms/${encodeURIComponent(String(id))}${query ? `?${query}` : ''}`
}

export function normalizePictogram(value: unknown): Pictogram | undefined {
  if (!isRecord(value)) return undefined
  const id = typeof value._id === 'number' ? value._id : typeof value.id === 'number' ? value.id : undefined
  if (!id || !Number.isInteger(id)) return undefined
  const keywords = Array.isArray(value.keywords) ? value.keywords.flatMap((keyword) => {
    if (typeof keyword === 'string') return [{ keyword }]
    if (!isRecord(keyword) || typeof keyword.keyword !== 'string') return []
    return [{ keyword: keyword.keyword, plural: typeof keyword.plural === 'string' ? keyword.plural : undefined, meaning: typeof keyword.meaning === 'string' ? keyword.meaning : undefined }]
  }) : []
  const tags = stringArray(value.tags)
  return {
    id, keywords, labels: [...new Set([...keywords.map(({ keyword }) => keyword), ...tags])], tags,
    categories: stringArray(value.categories), description: typeof value.desc === 'string' ? value.desc : undefined,
    createdAt: typeof value.created === 'string' ? value.created : undefined,
    updatedAt: typeof value.lastUpdated === 'string' ? value.lastUpdated : undefined,
    imageUrl: getPictogramImageUrl(id, { resolution: 300 }),
  }
}

export function normalizeMaterial(value: unknown): Material | undefined {
  if (!isRecord(value)) return undefined
  const id = typeof value.id === 'number' ? value.id : typeof value._id === 'string' ? Number(value._id) : undefined
  if (!id || !Number.isInteger(id)) return undefined
  return { id, title: typeof value.title === 'string' ? value.title : 'Material sin título', description: typeof value.desc === 'string' ? value.desc : '', language: typeof value.lang === 'string' ? value.lang : typeof value.language === 'string' ? value.language : undefined, authors: Array.isArray(value.authors) ? value.authors.map((author) => isRecord(author) && typeof author.name === 'string' ? author.name : typeof author === 'string' ? author : '').filter(Boolean) : [], createdAt: typeof value.created === 'string' ? value.created : undefined, updatedAt: typeof value.lastUpdate === 'string' ? value.lastUpdate : undefined, files: isRecord(value.files) ? value.files : {} }
}

export class ArasaacService {
  constructor(private readonly fetcher: Fetcher = fetch, private readonly index: PictogramIndexRepository = pictogramIndexRepository) {}

  async searchBest(query: string, language: ArasaacLanguage) { return this.searchPictograms('bestsearch', query, language) }
  async search(query: string, language: ArasaacLanguage) { return this.searchPictograms('search', query, language) }
  getPictogramImageUrl(id: number, options?: PictogramImageOptions) { return getPictogramImageUrl(id, options) }

  async getPictogram(id: number, language: ArasaacLanguage): Promise<ApiResult<Pictogram>> {
    const result = await this.request<unknown>('pictogram', { id, language }, METADATA_TTL)
    if (!result.ok) return result
    const pictogram = normalizePictogram(result.data)
    if (!pictogram) return apiError('MALFORMED_RESPONSE', 'La respuesta de ARASAAC no tiene el formato esperado.', false)
    await this.indexPictograms([pictogram], language)
    return { ok: true, data: pictogram, cached: result.cached }
  }
  async getKeywords(language: ArasaacLanguage): Promise<ApiResult<string[]>> {
    const result = await this.request<unknown>('keywords', { language }, KEYWORDS_TTL)
    if (!result.ok) return result
    const words = isRecord(result.data) ? stringArray(result.data.words) : []
    return Array.isArray(result.data) || !isRecord(result.data) ? apiError('MALFORMED_RESPONSE', 'No se pudieron leer las sugerencias.', false) : { ok: true, data: words, cached: result.cached }
  }
  async getRecentPictograms(language: ArasaacLanguage, count = 12) { return this.getPictogramList('recentPictograms', { language, count: clamp(count, 1, 100) }, language) }
  async getChangedPictograms(language: ArasaacLanguage, days = 7) { return this.getPictogramList('changedPictograms', { language, days: clamp(days, 0, 365) }, language) }
  async searchMaterials(query: string, language: ArasaacLanguage) { return this.getMaterials('materialsSearch', { query, language }) }
  async getRecentMaterials(count = 12) { return this.getMaterials('recentMaterials', { count: clamp(count, 1, 100) }) }
  async getMaterial(id: number): Promise<ApiResult<Material>> {
    const result = await this.request<unknown>('material', { id }, METADATA_TTL)
    if (!result.ok) return result
    const material = normalizeMaterial(isRecord(result.data) && 'material' in result.data ? result.data.material : result.data)
    return material ? { ok: true, data: material, cached: result.cached } : apiError('MALFORMED_RESPONSE', 'No se pudo leer el material.', false)
  }
  async naturalizePhrase(phrase: string, language: ArasaacLanguage, options: NaturalizeOptions = {}): Promise<ApiResult<string>> {
    if (!phrase.trim()) return apiError('INVALID_INPUT', 'Escribe una frase para naturalizar.', false)
    const result = await this.request<unknown>('naturalize', { phrase, language, ...options }, SEARCH_TTL)
    if (!result.ok) return result
    return isRecord(result.data) && typeof result.data.msg === 'string' ? { ok: true, data: result.data.msg, cached: result.cached } : apiError('MALFORMED_RESPONSE', 'No se pudo naturalizar la frase.', false)
  }
  async syncIncremental(language: ArasaacLanguage, days = 7) { return this.getChangedPictograms(language, days) }
  /** Best-effort opt-in caching: only favorites are preloaded, never the full catalogue. */
  async cachePictogramForOffline(pictogram: Pictogram) {
    if (!('caches' in globalThis)) return
    try {
      const imageUrl = this.getPictogramImageUrl(pictogram.id, { resolution: 500 })
      const image = await this.fetcher(imageUrl)
      if (image.ok) await globalThis.caches.open('arasaac-images-v1').then((storage) => storage.put(imageUrl, image))
    } catch { /* Offline support is optional and must never interrupt saving a favorite. */ }
  }

  private async searchPictograms(operation: 'bestsearch' | 'search', query: string, language: ArasaacLanguage): Promise<ApiResult<SearchResult[]>> {
    if (query.trim().length < 2) return { ok: true, data: [] }
    return this.getPictogramList(operation, { query: query.trim(), language }, language)
  }
  private async getPictogramList(operation: Operation, params: Record<string, unknown>, language: ArasaacLanguage): Promise<ApiResult<SearchResult[]>> {
    const result = await this.request<unknown>(operation, params, SEARCH_TTL)
    if (!result.ok) return result
    if (!Array.isArray(result.data)) return apiError('MALFORMED_RESPONSE', 'ARASAAC devolvió un formato de resultados no válido.', false)
    const pictograms = result.data.map(normalizePictogram).filter((item): item is Pictogram => Boolean(item))
    await this.indexPictograms(pictograms, language)
    return { ok: true, data: pictograms, cached: result.cached }
  }
  private async getMaterials(operation: Operation, params: Record<string, unknown>): Promise<ApiResult<Material[]>> {
    if (typeof params.query === 'string' && params.query.trim().length < 2) return { ok: true, data: [] }
    const result = await this.request<unknown>(operation, params, SEARCH_TTL)
    if (!result.ok) return result
    if (!Array.isArray(result.data)) return apiError('MALFORMED_RESPONSE', 'ARASAAC devolvió un formato de materiales no válido.', false)
    return { ok: true, data: result.data.map(normalizeMaterial).filter((item): item is Material => Boolean(item)), cached: result.cached }
  }
  private async indexPictograms(pictograms: Pictogram[], language: ArasaacLanguage) {
    const records: PictogramIndexRecord[] = pictograms.map((item) => ({ id: item.id, language, keywords: item.keywords.map(({ keyword }) => keyword), labels: item.labels, categories: item.categories, syncedAt: new Date().toISOString() }))
    await this.index.upsert(records)
  }
  private async request<T>(operation: Operation, params: Record<string, unknown>, ttl: number): Promise<ApiResult<T>> {
    const key = `${operation}:${JSON.stringify(params)}`
    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) return { ok: true, data: cached.value as T, cached: true }
    const endpoint = new URL(PROXY_URL, window.location.origin)
    endpoint.searchParams.set('operation', operation)
    Object.entries(params).forEach(([name, value]) => { if (value !== undefined) endpoint.searchParams.set(name, Array.isArray(value) ? value.join(',') : String(value)) })
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 8_000)
      try {
        let response = await this.fetcher(endpoint, { signal: controller.signal, headers: { Accept: 'application/json' } })
        // Vite has no serverless runtime. Its development fallback is deliberately direct and only used locally.
        if (response.headers.get('content-type')?.includes('text/html') && endpoint.pathname === '/api/arasaac') response = await this.fetcher(this.directUrl(operation, params), { signal: controller.signal, headers: { Accept: 'application/json' } })
        if (!response.ok) { if (response.status >= 500 && attempt === 0) continue; return apiError('UPSTREAM', 'ARASAAC no está disponible en este momento. Inténtalo de nuevo.', response.status >= 500) }
        const data: unknown = await response.json(); cache.set(key, { value: data, expiresAt: Date.now() + ttl }); return { ok: true, data: data as T }
      } catch (error) { if (attempt === 0 && !(error instanceof DOMException && error.name === 'AbortError')) continue; return apiError(error instanceof DOMException && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK', 'No se pudo conectar con ARASAAC. Comprueba tu conexión e inténtalo de nuevo.', true) } finally { window.clearTimeout(timeout) }
    }
    return apiError('NETWORK', 'No se pudo conectar con ARASAAC.', true)
  }
  private directUrl(operation: Operation, params: Record<string, unknown>) {
    const language = String(params.language || 'es'); const text = encodeURIComponent(String(params.query || params.phrase || ''))
    const path: Record<Operation, string> = { bestsearch: `/pictograms/${language}/bestsearch/${text}`, search: `/pictograms/${language}/search/${text}`, pictogram: `/pictograms/${language}/${params.id}`, keywords: `/keywords/${language}`, recentPictograms: `/pictograms/${language}/new/${params.count}`, changedPictograms: `/pictograms/${language}/days/${params.days}`, materialsSearch: `/materials/${language}/${text}`, recentMaterials: `/materials/new/${params.count}`, material: `/materials/${params.id}`, naturalize: `/phrases/flex/${language}/${text}` }
    const url = new URL(`${API_BASE}${path[operation]}`)
    if (operation === 'naturalize') { if (params.tense) url.searchParams.set('tense', String(params.tense)); if (params.pictogramIds) url.searchParams.set('idPictograms', String(params.pictogramIds)) }
    return url.toString()
  }
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)))
export const arasaac = new ArasaacService()
