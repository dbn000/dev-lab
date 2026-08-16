import { useEffect, useMemo, useRef, useState } from 'react'
import { arasaac } from './arasaac/service'
import type { ArasaacLanguage, Pictogram, SearchResult } from './arasaac/types'

const LANGUAGE_OPTIONS: { value: ArasaacLanguage; label: string }[] = [{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }, { value: 'ca', label: 'Català' }, { value: 'fr', label: 'Français' }]
const FAVORITES_KEY = 'arasaac:favorites:v1'
const fromStorage = (): Pictogram[] => { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') } catch { return [] } }

export function ArasaacExplorer() {
  const [query, setQuery] = useState(''); const [language, setLanguage] = useState<ArasaacLanguage>('es'); const [results, setResults] = useState<SearchResult[]>([]); const [suggestions, setSuggestions] = useState<string[]>([]); const [selected, setSelected] = useState<Pictogram | null>(null); const [favorites, setFavorites] = useState<Pictogram[]>(fromStorage); const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle'); const [message, setMessage] = useState('Escribe al menos dos caracteres para buscar.'); const requestId = useRef(0)
  useEffect(() => { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)) }, [favorites])
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) { setResults([]); setSuggestions([]); setState('idle'); setMessage('Escribe al menos dos caracteres para buscar.'); return }
    const id = ++requestId.current
    const timer = window.setTimeout(async () => { setState('loading'); setMessage('Buscando pictogramas…'); const [searchResult, keywordsResult] = await Promise.all([arasaac.searchBest(trimmed, language), arasaac.getKeywords(language)]); if (id !== requestId.current) return; if (!searchResult.ok) { setState('error'); setMessage(searchResult.error.message); return }; setResults(searchResult.data.slice(0, 12)); setState('idle'); setMessage(searchResult.data.length ? '' : 'No encontramos pictogramas para esta búsqueda.'); if (keywordsResult.ok) setSuggestions(keywordsResult.data.filter((word) => word.toLocaleLowerCase(language).startsWith(trimmed.toLocaleLowerCase(language))).slice(0, 6)) }, 300)
    return () => window.clearTimeout(timer)
  }, [query, language])
  const favoriteIds = useMemo(() => new Set(favorites.map(({ id }) => id)), [favorites])
  const selectPictogram = async (result: SearchResult) => { setSelected(result); const detail = await arasaac.getPictogram(result.id, language); if (detail.ok) setSelected(detail.data) }
  const toggleFavorite = (pictogram: Pictogram) => { if (!favoriteIds.has(pictogram.id)) void arasaac.cachePictogramForOffline(pictogram); setFavorites((current) => favoriteIds.has(pictogram.id) ? current.filter(({ id }) => id !== pictogram.id) : [...current, pictogram]) }
  return <main className="page"><section className="lab" aria-labelledby="page-title"><header className="hero"><p className="eyebrow">ARASAAC · búsqueda de pictogramas</p><h1 id="page-title">Dev Lab</h1><p className="description">Encuentra pictogramas accesibles, guarda los que necesitas y prepara tu contenido para usarlo sin conexión.</p></header><section className="search-panel" aria-label="Buscador de pictogramas"><div className="search-controls"><label className="visually-hidden" htmlFor="pictogram-search">Buscar pictogramas</label><input id="pictogram-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar, por ejemplo: comer" autoComplete="off" /><label className="visually-hidden" htmlFor="language">Idioma</label><select id="language" value={language} onChange={(event) => setLanguage(event.target.value as ArasaacLanguage)}>{LANGUAGE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>{suggestions.length > 0 && <div className="suggestions" aria-label="Sugerencias">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuery(suggestion)}>{suggestion}</button>)}</div>}{state === 'loading' && <p className="feedback" role="status">{message}</p>}{state === 'error' && <p className="feedback error" role="alert">{message} <button onClick={() => setQuery((value) => `${value} `)}>Reintentar</button></p>}{state === 'idle' && message && <p className="feedback" role="status">{message}</p>}<div className="result-grid" aria-live="polite" aria-busy={state === 'loading'}>{results.map((pictogram) => <article className="pictogram-card" key={pictogram.id}><button className="pictogram-select" type="button" onClick={() => void selectPictogram(pictogram)} aria-label={`Ver detalles de ${pictogram.labels[0] || `pictograma ${pictogram.id}`}`}><img src={pictogram.imageUrl} width="150" height="150" loading="lazy" alt={`Pictograma ARASAAC: ${pictogram.labels[0] || pictogram.id}`} /><span>{pictogram.labels[0] || `Pictograma ${pictogram.id}`}</span></button><button className="favorite" type="button" onClick={() => toggleFavorite(pictogram)} aria-pressed={favoriteIds.has(pictogram.id)} aria-label={`${favoriteIds.has(pictogram.id) ? 'Quitar de' : 'Añadir a'} favoritos: ${pictogram.labels[0] || pictogram.id}`}>{favoriteIds.has(pictogram.id) ? '★' : '☆'}</button></article>)}</div></section>{selected && <aside className="detail" aria-label="Pictograma seleccionado"><img src={arasaac.getPictogramImageUrl(selected.id, { resolution: 500 })} width="180" height="180" alt={`Vista ampliada: ${selected.labels[0] || selected.id}`} /><div><p className="eyebrow">Pictograma seleccionado</p><h2>{selected.labels[0] || `Pictograma ${selected.id}`}</h2><p><strong>ID:</strong> {selected.id}</p><p><strong>Etiquetas:</strong> {selected.labels.join(', ') || 'Sin etiquetas disponibles'}</p><a href={arasaac.getPictogramImageUrl(selected.id, { resolution: 2500 })} target="_blank" rel="noreferrer">Abrir imagen en alta resolución</a></div></aside>}{favorites.length > 0 && <section className="favorites" aria-labelledby="favorites-title"><h2 id="favorites-title">Favoritos guardados</h2><p>{favorites.length} pictograma{favorites.length === 1 ? '' : 's'} conservado{favorites.length === 1 ? '' : 's'} localmente para preparar uso offline.</p></section>}<footer className="attribution">Pictogramas: Sergio Palao. Origen: ARASAAC (<a href="http://www.arasaac.org" target="_blank" rel="noreferrer">www.arasaac.org</a>). Licencia: CC BY-NC-SA. Propiedad: Gobierno de Aragón.<br />No se permite el uso comercial sin autorización; las obras derivadas deben respetar la misma licencia.</footer></section></main>
}

function ExternalApisPage() {
  return (
    <main className="page">
      <section className="lab home" aria-labelledby="external-apis-title">
        <a className="back-link" href="/">← Dev Lab</a>
        <p className="eyebrow">Área de experimentación</p>
        <h1 id="external-apis-title">Consumo de APIs externas</h1>
        <p className="description">Pruebas aisladas de integraciones con servicios de terceros.</p>
        <a className="api-card" href="/apis-externas/arasaac">
          <span className="api-card-kicker">API pública</span>
          <strong>ARASAAC</strong>
          <span>Búsqueda, visualización y caché de pictogramas.</span>
        </a>
      </section>
    </main>
  )
}

function App() {
  const path = window.location.pathname
  if (path.startsWith('/apis-externas/arasaac')) return <ArasaacExplorer />
  if (path.startsWith('/apis-externas') || path.startsWith('/arasaac')) return <ExternalApisPage />

  return (
    <main className="page">
      <section className="lab home" aria-labelledby="page-title">
        <p className="eyebrow">Entorno de experimentación</p>
        <h1 id="page-title">Dev Lab</h1>
        <p className="description">Un espacio para probar APIs y explorar diferentes tecnologías.</p>
        <a className="demo-link" href="/apis-externas">Explorar consumo de APIs externas</a>
      </section>
    </main>
  )
}

export default App
