# Mapa de Pedidos — Colaborativo

**🔗 App en vivo:** https://emergency-tasks.wifi-laguaira.workers.dev/

Aplicación web de una sola página para publicar y encontrar pedidos o solicitudes geolocalizadas. Diseñada para operar sin instalación, desde cualquier navegador móvil, con o sin backend. 

## ¿Qué hace?

- Muestra un mapa interactivo (Leaflet + OpenStreetMap) con los pedidos publicados, coloreados por categoría.
- Permite publicar un pedido indicando teléfono de contacto, categoría, descripción, ubicación (clic en el mapa o GPS) e Instagram opcional.
- Panel lateral con la lista de todos los pedidos abiertos, ordenados del más reciente al más antiguo.
- Acción **"Encontrar el más cercano a mí"**: usa el GPS del dispositivo para volar al pedido abierto más próximo.
- Tocar cualquier ítem del panel o marcador del mapa abre el popup con el detalle completo y el contacto.
- Los pedidos cerrados se muestran en gris; el campo de estado lo controlan los administradores desde el backend (sin exposición al usuario).
- Funciona en dos modos:
  - **Modo local** — datos en `localStorage`. Sin backend, útil para probar.
  - **Modo colaborativo** — sincroniza con Google Apps Script + Sheets cada 30 segundos.

## Estructura del proyecto

```
index.html               # Núcleo: mapa, formulario y API pública TicketApp
features/
  panel.js               # Panel de pedidos + acción "Más cercano"
worker.js                # Cloudflare Worker: sirve estáticos y proxea /api → Apps Script
Code.gs                  # Backend Google Apps Script (lee/escribe en la hoja de cálculo)
wrangler.jsonc           # Configuración de despliegue en Cloudflare Workers
.assetsignore            # Excluye worker.js, Code.gs, etc. del servido público
```

## Configuración

Al inicio del `<script>` en `index.html` se encuentran tres bloques configurables:

### `CONFIG`

```js
const CONFIG = {
  API_URL: "/api",              // "/api" = colaborativo · "" = solo local
  CENTER:  [10.5939, -66.9283], // [lat, lng] centro inicial del mapa
  ZOOM:    12                   // zoom inicial (0–19)
};
```

### `CATEGORIAS`

Define las categorías disponibles en el formulario. Cada objeto genera automáticamente el chip del formulario, el marcador del mapa, el tag del popup y la leyenda.

```js
const CATEGORIAS = [
  { v: "alimentos",    label: "Alimentos",          emoji: "🍽", color: "#1f9d57" },
  { v: "medicamentos", label: "Medicamentos",        emoji: "💊", color: "#c8412f" },
  // ... agregar, quitar o renombrar libremente
];
```

| Campo   | Descripción |
|---------|-------------|
| `v`     | Valor interno guardado en la hoja de cálculo. No cambiar una vez que hay datos. |
| `label` | Texto visible en la UI. |
| `emoji` | Ícono que aparece en chips, leyenda y panel. |
| `color` | Color hexadecimal del marcador y el tag. |

### `FEATURES`

Activa o desactiva los módulos opcionales de `features/`:

```js
const FEATURES = {
  panel: true   // false para ocultar el botón de lista y la acción "Más cercano"
};
```

## Módulos (`features/`)

El núcleo expone `window.TicketApp` con la API pública. Los módulos solo hablan con ella y se registran con `TicketApp.feature({ name, init })`.

| Miembro de `TicketApp` | Para qué |
|------------------------|----------|
| `app.map` | El mapa Leaflet |
| `app.tickets` · `app.markers` | Datos y marcadores (lectura) |
| `app.CATEGORIAS` | Array de categorías definido en `<head>` |
| `app.render()` · `app.toast(msg)` · `app.send(action, payload)` | Acciones del core |
| `app.colorFor(t)` · `app.icon(t)` · `app.popupHtml(t)` · `app.esc(s)` · `app.ago(ts)` | Helpers |
| `app.on(evento, fn)` | Engancharse a eventos del core |

**Eventos disponibles:** `tickets:loaded` (data: array de tickets).

### `panel.js`

Botón redondo flotante (lado derecho, a la altura de la leyenda) que abre un panel inferior con:

- Lista completa de pedidos **abiertos**, ordenados del más reciente al más antiguo. Cada ítem muestra: color de categoría, descripción (2 líneas), categoría, tiempo transcurrido y teléfono.
- Tocar un ítem cierra el panel, vuela al marcador y abre su popup.
- Botón **"📍 Encontrar el más cercano a mí"**: solicita GPS y vuela al pedido abierto más próximo (distancia Haversine).
- Se actualiza automáticamente si llegan datos nuevos mientras el panel está abierto.

### Crear un módulo nuevo

```js
// features/mi-modulo.js
(function(){
  "use strict";
  TicketApp.feature({
    name: "miModulo",
    init(app){
      // usá solo `app` — sin tocar variables internas del core
    }
  });
})();
```

Agregar `miModulo: true` en `FEATURES` y `<script src="features/mi-modulo.js"></script>` antes de `</body>`.

> Se usan `<script>` planos (no ES Modules) para que `index.html` funcione también abierto como `file://` local.

## Uso

### Modo local (sin backend)

1. Abrir `index.html` directamente en el navegador.
2. Dejar `API_URL: ""` en `CONFIG`.
3. Los pedidos se guardan en `localStorage` bajo la clave `tickets_v1` y solo son visibles en ese dispositivo.

### Modo colaborativo (con backend)

El frontend no llama a Apps Script directamente: lo hace a través del Worker de Cloudflare (`worker.js`), que actúa como proxy del mismo origen bajo la ruta `/api`.

```
index.html ──fetch("/api")──▶ worker.js ──fetch()──▶ Code.gs (Apps Script) ──▶ Google Sheet
 (navegador, mismo origen)    (Cloudflare)               (doGet / doPost)
```

1. Crear una **Google Spreadsheet** con una pestaña llamada `Pedidos` y estos encabezados en la fila 1 (en cualquier orden):

   ```
   id   pedido   categoria   telefono   instagram   lat   lng   status   ts
   ```

2. Abrir **Extensions → Apps Script**, pegar el contenido de `Code.gs` y guardar.

3. Desplegar como aplicación web:
   - **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Copiar la URL `/exec` generada.

4. Pegar esa URL en la constante `APPS_SCRIPT` de `worker.js`.

5. Desplegar en Cloudflare Workers (ver sección siguiente).

## Despliegue en Cloudflare Workers

### `wrangler.jsonc`

Este archivo controla cómo se despliega el proyecto en Cloudflare. El campo más relevante es `name`:

```jsonc
"name": "emergency-tasks"
```

Ese nombre determina la URL pública del Worker:

```
https://emergency-tasks.<tu-cuenta>.workers.dev
```

Si cambiás el nombre, Cloudflare crea un Worker separado — no pisa otros proyectos de la misma cuenta. Cada proyecto (WiFi map, tickets, etc.) debe tener su propio nombre y su propio despliegue.

### Conectar el repo de GitHub para deploy automático

El deploy se dispara automáticamente en cada `git push` a `main`, siempre que el Worker esté vinculado al repo en Cloudflare. Para configurarlo:

1. **Cloudflare dashboard → Workers & Pages → `emergency-tasks` → Settings → Build → Connect a repository**
2. Si el repo `GuGazza/emergency-tasks` no aparece en la lista, hay que autorizar la GitHub App de Cloudflare:
   - Ir a **GitHub → (ícono de perfil) → Settings → Applications → Installed GitHub Apps**
   - Buscar la app **Cloudflare Workers** → **Configure**
   - En **Repository access** → agregar `emergency-tasks` (o elegir _All repositories_)
   - Guardar y volver al paso 1 — el repo ya debería aparecer
3. Una vez conectado, cada push a `main` genera un deploy visible en la pestaña **Deployments** del Worker.

> Si el banner "This project is disconnected from your Git account" aparece en Cloudflare, repetir el paso 2 para reconectar la GitHub App.

### Publicar manualmente (alternativa)

Si no se usa la integración con GitHub, se puede desplegar desde la terminal:

```bash
npx wrangler deploy
```

Al finalizar, Wrangler muestra la URL donde quedó publicado.

El Worker sirve `index.html` y los estáticos, y atiende `/api` como proxy hacia Apps Script.

### Previsualizar sin afectar producción

```bash
npx wrangler versions upload   # genera URL de preview para validar
npx wrangler versions deploy   # promueve a producción
```

### Desarrollo local

```bash
npx wrangler dev               # http://localhost:8787 con hot-reload
```

### Rollback

```bash
npx wrangler rollback
```

O desde el dashboard de Cloudflare → Workers → tu Worker → **Deployments → Rollback**.

## Administración de pedidos

El estado de un pedido lo controlan los administradores editando directamente la columna `status` en la hoja de cálculo:

| Valor en `status` | Resultado en el mapa |
|-------------------|----------------------|
| `open`            | Marcador coloreado según categoría |
| `closed`          | Marcador gris (cerrado) |

El cambio se refleja en el mapa en el próximo refresco automático (30 segundos) o al recargar la página.

### Eliminar un pedido

Seleccionar la fila en la hoja de cálculo → clic derecho → **Eliminar fila**. El pedido desaparece del mapa en el próximo refresco.

## Leyenda del mapa

| Color   | Significado |
|---------|-------------|
| Verde / Rojo / Azul / etc. | Pedido abierto (color según categoría) |
| Gris    | Pedido cerrado |

## Tecnologías

- [Leaflet 1.9.4](https://leafletjs.com/) — mapa interactivo (desde CDN, sin instalación)
- [OpenStreetMap](https://www.openstreetmap.org/) — tiles del mapa y direcciones
- Google Apps Script + Google Sheets — backend del modo colaborativo
- Cloudflare Workers — hosting de estáticos y proxy `/api`

## Licencia

MIT — libre para usar, modificar y redistribuir con o sin fines de lucro.
