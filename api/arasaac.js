const API_BASE = 'https://api.arasaac.org/v1'
const cache = new Map()
const LOCALES = new Set(['an', 'ar', 'bg', 'br', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa', 'fr', 'gl', 'he', 'hr', 'hu', 'it', 'is', 'ko', 'lt', 'lv', 'mk', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sq', 'sv', 'sr', 'tr', 'val', 'uk', 'zh'])
const ttlFor = (operation) => operation === 'pictogram' || operation === 'keywords' ? 86400 : 60
const integer = (value, minimum, maximum) => Number.isInteger(Number(value)) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : null
const text = (value) => typeof value === 'string' ? value.trim() : ''
const sendJson = (response, status, body) => {
  if (typeof response.status === 'function') return response.status(status).json(body)
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

function endpoint(operation, query) {
  const language = text(query.language)
  if (!LOCALES.has(language)) throw new Error('Idioma no válido')
  const id = integer(query.id, 1, Number.MAX_SAFE_INTEGER)
  const count = integer(query.count, 1, 100)
  const days = integer(query.days, 0, 365)
  const search = encodeURIComponent(text(query.query))
  const phrase = encodeURIComponent(text(query.phrase))
  if ((operation === 'bestsearch' || operation === 'search' || operation === 'materialsSearch') && search.length < 2) throw new Error('La búsqueda debe tener al menos 2 caracteres')
  const paths = {
    bestsearch: `/pictograms/${language}/bestsearch/${search}`,
    search: `/pictograms/${language}/search/${search}`,
    pictogram: id && `/pictograms/${language}/${id}`,
    keywords: `/keywords/${language}`,
    recentPictograms: count && `/pictograms/${language}/new/${count}`,
    changedPictograms: days !== null && `/pictograms/${language}/days/${days}`,
    materialsSearch: `/materials/${language}/${search}`,
    recentMaterials: count && `/materials/new/${count}`,
    material: id && `/materials/${id}`,
    naturalize: phrase && `/phrases/flex/${language}/${phrase}`,
  }
  if (!paths[operation]) throw new Error('Operación o parámetros no válidos')
  const url = new URL(`${API_BASE}${paths[operation]}`)
  if (operation === 'naturalize') {
    if (['past', 'present', 'future'].includes(query.tense)) url.searchParams.set('tense', query.tense)
    if (text(query.pictogramIds)) url.searchParams.set('idPictograms', text(query.pictogramIds))
  }
  return url
}

export default async function handler(request, response) {
  const query = request.query || Object.fromEntries(new URL(request.url || '/', 'http://localhost').searchParams)
  const operation = text(query.operation)
  try {
    const url = endpoint(operation, query)
    const key = url.toString(); const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      response.setHeader('Cache-Control', `public, s-maxage=${ttlFor(operation)}, stale-while-revalidate=300`)
      return sendJson(response, 200, cached.value)
    }
    let upstream
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000)
      try { upstream = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } }) } finally { clearTimeout(timeout) }
      if (upstream.ok || upstream.status < 500) break
    }
    if (!upstream?.ok) return sendJson(response, upstream?.status >= 400 && upstream.status < 500 ? 400 : 502, { message: 'No fue posible completar la consulta a ARASAAC.' })
    const body = await upstream.json()
    cache.set(key, { value: body, expiresAt: Date.now() + ttlFor(operation) * 1000 })
    response.setHeader('Cache-Control', `public, s-maxage=${ttlFor(operation)}, stale-while-revalidate=300`)
    return sendJson(response, 200, body)
  } catch {
    return sendJson(response, 400, { message: 'Solicitud de ARASAAC no válida.' })
  }
}
