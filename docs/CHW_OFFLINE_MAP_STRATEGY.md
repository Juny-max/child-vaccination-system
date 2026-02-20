# CHW Offline Leaflet Tile Strategy

This project uses **Service Worker tile caching** for CHW map continuity when connectivity drops.

## 1) Register the SW in CHW map flows

```ts
import { useEffect } from "react"
import { registerChwMapServiceWorker } from "@/lib/chw-offline/register-map-sw"

export function UseChwMapOfflineBoot() {
  useEffect(() => {
    registerChwMapServiceWorker()
  }, [])

  return null
}
```

## 2) Leaflet tile URL stays standard OSM

```tsx
import { TileLayer } from "react-leaflet"

<TileLayer
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  attribution='&copy; OpenStreetMap contributors'
/>
```

The Service Worker in [public/chw-map-sw.js](../public/chw-map-sw.js) intercepts and caches OSM tile requests (`/{z}/{x}/{y}.png`) with cache-first behavior.

## 3) Prefetch a bounded area (optional warm-up)

```ts
async function warmTiles(minZoom: number, maxZoom: number, coords: Array<{ z: number; x: number; y: number }>) {
  for (const { z, x, y } of coords) {
    if (z < minZoom || z > maxZoom) continue
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
    await fetch(url)
  }
}
```

Use this after CHW catchment sync to warm high-priority tiles around known routes.
