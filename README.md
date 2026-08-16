# Dev Lab

Laboratorio personal para probar APIs y explorar diferentes tecnologías.

## Desarrollo local

```bash
npm install
npm run dev
```

## Producción

```bash
npm run build
npm run preview
```

## ARASAAC

La portada `/` enlaza a `/apis-externas`, donde se agrupan las integraciones. La demo de ARASAAC está en `/apis-externas/arasaac`; el antiguo `/arasaac` mantiene compatibilidad y lleva al índice. El endpoint serverless vive en `/api/arasaac`.

La búsqueda usa exclusivamente la API oficial de ARASAAC. En Vercel, `api/arasaac.js` centraliza validación, reintentos prudentes y caché HTTP; en el servidor también mantiene una caché efímera por instancia. No requiere variables de entorno. De forma opcional, `VITE_ARASAAC_PROXY_URL` permite indicar la URL de otro proxy compatible.

El índice de pictogramas tiene hoy un adaptador en memoria (`MemoryPictogramIndexRepository`); puede sustituirse por Vercel KV, Postgres o IndexedDB sin modificar la interfaz. Los favoritos se conservan localmente y, al marcarlos, se intenta almacenar su imagen de 500 px mediante Cache Storage; no hay descarga masiva. Para una persistencia real en Vercel, implemente el adaptador del repositorio usando las credenciales de su proveedor (por ejemplo, `KV_REST_API_URL` y `KV_REST_API_TOKEN` si se elige Vercel KV).

Los pictogramas son de Sergio Palao para ARASAAC y se distribuyen bajo CC BY-NC-SA. No deben utilizarse comercialmente sin autorización, y las obras derivadas deben mantenerse bajo la misma licencia.
