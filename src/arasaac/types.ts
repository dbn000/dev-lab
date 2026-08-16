export const ARASAAC_LANGUAGES = [
  'an', 'ar', 'bg', 'br', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa',
  'fr', 'gl', 'he', 'hr', 'hu', 'it', 'is', 'ko', 'lt', 'lv', 'mk', 'nb', 'nl', 'pl',
  'pt', 'ro', 'ru', 'sk', 'sq', 'sv', 'sr', 'tr', 'val', 'uk', 'zh',
] as const

export type ArasaacLanguage = (typeof ARASAAC_LANGUAGES)[number]
export type ImageResolution = 300 | 500 | 2500
export type SkinTone = 'white' | 'black' | 'assian' | 'mulatto' | 'aztec'
export type HairColor = 'blonde' | 'brown' | 'darkBrown' | 'gray' | 'darkGray' | 'red' | 'black'

export interface PictogramImageOptions {
  resolution?: ImageResolution
  color?: boolean
  backgroundColor?: string
  plural?: boolean
  action?: 'past' | 'future'
  hair?: HairColor
  skin?: SkinTone
}

export interface PictogramKeyword { keyword: string; plural?: string; meaning?: string }
export interface Pictogram {
  id: number
  keywords: PictogramKeyword[]
  labels: string[]
  categories: string[]
  tags: string[]
  description?: string
  createdAt?: string
  updatedAt?: string
  imageUrl: string
}
export interface SearchResult extends Pictogram { score?: number }
export interface Material {
  id: number
  title: string
  description: string
  language?: string
  authors: string[]
  createdAt?: string
  updatedAt?: string
  files: Record<string, unknown>
}
export type ApiErrorCode = 'INVALID_INPUT' | 'NETWORK' | 'TIMEOUT' | 'UPSTREAM' | 'MALFORMED_RESPONSE'
export interface ApiError { code: ApiErrorCode; message: string; retryable: boolean }
export type ApiResult<T> = { ok: true; data: T; cached?: boolean } | { ok: false; error: ApiError }
export interface NaturalizeOptions { tense?: 'past' | 'present' | 'future'; pictogramIds?: number[] }

export interface PictogramIndexRecord {
  id: number
  language: ArasaacLanguage
  keywords: string[]
  labels: string[]
  categories: string[]
  syncedAt: string
}
