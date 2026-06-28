# TODO — Mapa de Pedidos

Mejoras identificadas y pendientes de implementación.

---

## Backend (`Code.gs`)

- [ ] **Filtrar tickets cerrados en `doGet`** — devolver solo `status = "open"` desde el servidor para reducir el payload y no cargar pines irrelevantes en el mapa. Mayor impacto de rendimiento con el menor cambio posible.
- [ ] **Ventana temporal en `doGet`** — si los tickets nunca se cierran explícitamente, filtrar registros más viejos que N días (ej: 30) para evitar acumulación indefinida.
- [ ] **Anti-duplicado en `onEditStatus`** — comparar `e.oldValue !== e.value` antes de disparar el correo, para evitar notificaciones cuando se edita una celda sin cambiar su contenido.

## Frontend (`index.html` / `features/`)

- [ ] **"Cargar más" en el panel** — mostrar los primeros 30 pedidos en el panel lateral y agregar un botón "Ver más" para cargar el resto. El mapa sigue mostrando todos los pines. Aplica si el volumen crece.
- [ ] **Filtro por categoría en el panel** — chips de categoría en la cabecera del panel para filtrar la lista sin afectar el mapa.

## Notificaciones

- [ ] **Canales adicionales (WhatsApp / Telegram)** — explorar integración vía Twilio (WhatsApp) o Bot de Telegram como canal alternativo o complementario al correo, configurables también desde Script Properties.

## Operacional

- [ ] **Panel de administración básico** — interfaz mínima para cambiar el estado de un pedido desde la propia app (sin necesidad de abrir el Google Sheet), accesible con contraseña simple o token configurado en Script Properties.

---

## Hecho ✓

- [x] Notificaciones por email al crear pedido (`_notifyEmail` + `MailApp`)
- [x] Notificaciones por email al cambiar estado (`onEditStatus` + activador instalable)
- [x] Configuración sin código via Script Properties (`NOTIFY_ENABLED`, `EMAIL_TO`)
- [x] Filtrado de filas vacías en `doGet`
- [x] Modo "marcar en el mapa" en móvil (el formulario se baja para liberar el mapa)
- [x] Panel de últimos 3 pedidos (`features/recent.js`)
- [x] Panel completo con "Encontrar el más cercano" (`features/panel.js`)
- [x] Íconos SVG pin en lugar de círculos (mapa y formulario)
- [x] Guía de uso (`como-usar.png`)
