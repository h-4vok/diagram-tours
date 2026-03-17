# Backlog

Este archivo nos sirve como backlog operativo del proyecto. Lo vamos actualizando a medida que cambie el estado real del producto.

Fuente inicial: contraste entre [`docs/reqs.md`](docs/reqs.md), el codigo actual y la documentacion viva del repo.

## Convenciones

- `Done`: implementado y presente en el repo
- `In Progress`: ya arrancado, con trabajo integrado en el repo, pero todavia no cerrado
- `Partial`: existe parcialmente o la implementacion no coincide del todo con la intencion del requerimiento
- `Todo`: todavia no esta implementado

## Snapshot

Fecha de corte: 2026-03-17

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
- Browse panel con navegacion de tours como explorer
  - Estado actual: arbol basado en estructura de carpetas real, con compact folders, buscador por texto, fuzzy match simple, iconografia carpeta/diagrama y apertura de la rama activa
  - Nota: el detalle de tours omitidos se movio a un badge de `Issues` en el top bar para no mezclar navegacion con diagnosticos
  - Evidencia: `packages/web-player/src/routes/+layout.svelte`, `packages/web-player/src/lib/browse-tree.ts`, `packages/web-player/test/browse-tree.test.ts`

### Partial

- Author diagnostics
  - Estado actual: los errores incluyen archivo, step y campo, y el player muestra tours omitidos en un badge de `Issues` con popover flotante
  - Gap: siguen faltando line/column, mejor jerarquia de mensajes y una capa mas rica de diagnostico para autores
  - Evidencia: `packages/parser/src/index.ts`, `packages/web-player/src/routes/+layout.svelte`
- Layout polish y highlight hierarchy
  - Estado actual: el workspace fue muy pulido, pero `reqs.md` todavia marca esta zona como abierta y sigue siendo razonable tratarla como refinamiento continuo
  - Gap: conectores, labels y jerarquia visual fina todavia pueden mejorar
  - Evidencia: `packages/web-player/src/styles/components/diagram-player.css`, `docs/reqs.md`

### In Progress

- Editor preview
  - Estado actual: soporta `bun run dev <target>` para archivo o directorio, y tambien `bun run dev:interactive` para elegir el source target desde consola
  - Gap: sigue faltando consolidarlo dentro de una UX de CLI mas unificada, especialmente pensando en una futura instalacion global
  - Pendiente inmediato: decidir si el wizard actual es suficiente o si necesita recientes, deteccion de targets y mejor ergonomia de arranque
  - Evidencia: `README.md`, `scripts/dev-web-player.ts`, `scripts/dev-web-player-interactive.ts`, `packages/web-player/src/lib/source-target.ts`

### Todo

- Minimap de navegacion
  - Nota: no se encontro implementacion actual en el repo
- Timeline visual de pasos
  - Nota: no se encontro implementacion actual en el repo
- Soporte para otros tipos de diagramas mas complejos, incluyendo diagramas de secuencia
  - Nota: hoy el alcance documentado y soportado esta centrado en flowcharts de Mermaid
  - Pendiente: investigar el modelo de Mermaid para sequence diagrams y definir el impacto en parser, validacion, referencias y player
- Soporte para operar `diagram-tours` mediante comandos globales en npm o bun
  - Nota: aunque el uso actual sea local en esta PC, queremos planear una experiencia de CLI instalable y reutilizable
  - Pendiente: definir distribucion, entrypoints, ergonomia de comandos, compatibilidad con Bun y npm, y expectativas de authoring/preview antes de implementarlo
- Favoritos de tours dentro del browse panel
  - Nota: no es prioridad para la primera iteracion del explorer, pero puede mejorar mucho la navegacion en colecciones grandes
- Shortcuts y navegacion por teclado consistentes entre browse panel y diagrama
  - Nota: queremos atacarlo como una iniciativa unificada mas adelante, no mezclarlo con la implementacion inicial del browse explorer
  - Pendiente: definir modelo comun de shortcuts, foco, discoverability y conflictos de teclas
- Node click navigation para saltar al primer step asociado a un nodo
  - Nota: no se encontro implementacion actual en el repo
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
