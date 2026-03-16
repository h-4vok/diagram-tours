# Backlog

Este archivo nos sirve como backlog operativo del proyecto. Lo vamos actualizando a medida que cambie el estado real del producto.

Fuente inicial: contraste entre [`docs/reqs.md`](docs/reqs.md), el codigo actual y la documentacion viva del repo.

## Convenciones

- `Done`: implementado y presente en el repo
- `Partial`: existe parcialmente o la implementacion no coincide del todo con la intencion del requerimiento
- `Todo`: todavia no esta implementado

## Snapshot

Fecha de corte: 2026-03-16

### Done

- Parser de Mermaid + YAML, con resolucion de nodos y referencias `{{node_id}}`
  - Evidencia: `packages/parser/src/index.ts`
- Validacion de tours, nodos de foco y referencias de texto
  - Evidencia: `packages/parser/src/index.ts`
- Modelo compartido de tour, coleccion, steps y slugs en `core`
  - Evidencia: `packages/core/src/index.ts`
- Navegacion paso a paso (`Previous` / `Next`)
  - Evidencia: `packages/web-player/src/lib/player-state.ts`
- Deep linking con `?step=` 1-based y clamp de valores invalidos
  - Evidencia: `packages/web-player/src/routes/[...tourSlug]/+page.server.ts`
- Highlight de nodos con `data-node-id` y `data-focus-state`
  - Evidencia: `packages/web-player/src/lib/mermaid-diagram.ts`
- Multi-focus y empty-focus
  - Evidencia: `packages/web-player/src/lib/mermaid-diagram.ts`
- Control de viewport con pan-based centering para foco simple, grupal y neutral
  - Evidencia: `packages/web-player/src/lib/diagram-viewport.ts`
- Layout canvas-first con top bar, overlay de paso y browse panel flotante
  - Evidencia: `packages/web-player/src/routes/+layout.svelte`
- Theme toggle y persistencia del tema
  - Evidencia: `packages/web-player/src/routes/+layout.svelte`
- Descubrimiento recursivo de `*.tour.yaml`
  - Evidencia: `packages/parser/src/index.ts`
- Preview de archivo individual o directorio como source target
  - Evidencia: `packages/web-player/src/lib/source-target.ts`
- Routing por slug para multiples tours
  - Evidencia: `packages/parser/src/index.ts`, `packages/web-player/src/routes/[...tourSlug]/+page.server.ts`
- Recuperacion guiada para tours inexistentes
  - Evidencia: `packages/web-player/src/routes/+error.svelte`
- Smoke coverage para carga, deep linking, viewport, theme switching y diagramas grandes
  - Evidencia: `packages/web-player/smoke/payment-flow.spec.ts`

### Partial

- Browse panel con navegacion de tours
  - Estado actual: existe como lista plana
  - Gap: falta evolucionarlo a explorer en arbol basado en estructura de carpetas
  - Evidencia: `packages/web-player/src/routes/+layout.svelte`
- Editor preview
  - Estado actual: existe mediante `DIAGRAM_TOUR_SOURCE_TARGET`
  - Gap: la UX actual no coincide con la idea de `bun run dev path/to/tour.yaml` como argumento directo
  - Evidencia: `README.md`, `packages/web-player/src/lib/source-target.ts`
- Author diagnostics
  - Estado actual: los errores ya incluyen archivo, step y campo
  - Gap: no hay line/column, panel dedicado ni una capa mas rica de diagnostico para autores
  - Evidencia: `packages/parser/src/index.ts`
- Layout polish y highlight hierarchy
  - Estado actual: el workspace fue muy pulido, pero `reqs.md` todavia marca esta zona como abierta y sigue siendo razonable tratarla como refinamiento continuo
  - Gap: conectores, labels y jerarquia visual fina todavia pueden mejorar
  - Evidencia: `packages/web-player/src/styles/components/diagram-player.css`, `docs/reqs.md`

### Todo

- Minimap de navegacion
  - Nota: no se encontro implementacion actual en el repo
- Timeline visual de pasos
  - Nota: no se encontro implementacion actual en el repo
- Node click navigation para saltar al primer step asociado a un nodo
  - Nota: no se encontro implementacion actual en el repo
- Explorer navigation en arbol por estructura de proyecto
  - Nota: hoy sigue siendo lista plana
- Zoom-to-fit opcional
  - Nota: no se encontro implementacion actual en el repo
- Transiciones animadas de viewport
  - Nota: no se encontro implementacion actual en el repo
- Group centering mas inteligente
  - Nota: hoy existe centrado grupal, pero no una estrategia mas avanzada que la actual
- Viewport constraints explicitas
  - Nota: no se encontro implementacion actual en el repo

## Notas

- `docs/reqs.md` quedo parcialmente desactualizado respecto del estado real del proyecto.
- En particular, subestima capacidades que ya existen hoy: preview de archivo/directorio, recuperacion de rutas invalidas, persistencia de tema, empty-focus y smoke tests para viewport y diagramas grandes.
- Cuando implementemos algo de `Todo`, conviene moverlo a `Done` o `Partial` en este mismo archivo en el mismo commit.
