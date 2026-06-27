/**
 * Code.gs — Backend del Mapa de Pedidos (Google Apps Script)
 * -----------------------------------------------------------
 * Hoja de cálculo de respaldo del modo colaborativo. El frontend NO llama
 * a este script directamente: lo hace a través del Worker de Cloudflare
 * (ver worker.js), que actúa como proxy mismo-origen para evitar CORS/CORB.
 *
 * REQUISITO — la fila 1 de la hoja de datos debe tener EXACTAMENTE estos
 * encabezados (en cualquier orden):
 *
 *   id | pedido | categoria | telefono | instagram | lat | lng | status | ts
 *
 * DESPLIEGUE — tras cualquier cambio:
 *   Implementar → Administrar implementaciones → ✏️ → Nueva versión → Implementar
 *   (la URL /exec no cambia, así que no hay que tocar worker.js)
 *
 * ADMIN — para cambiar el estado de un pedido: editar la columna `status`
 * directamente en la hoja de cálculo (open → closed). El mapa lo reflejará
 * en el próximo refresco automático (30 segundos).
 *
 * Acceso del Web App: "Ejecutar como: Yo" · "Quién tiene acceso: Cualquier usuario".
 */

const SS    = SpreadsheetApp.getActiveSpreadsheet();
const SHEET = SS.getSheetByName('Pedidos') || SS.getSheets()[0];

/** GET → devuelve todos los pedidos como JSON. */
function doGet(e) {
  var filas = SHEET.getDataRange().getValues();
  if (filas.length < 2) return _json([]);
  var cab = filas.shift();
  var pedidos = filas.map(function(f) {
    var o = {};
    cab.forEach(function(c, i) { o[c] = f[i]; });
    return o;
  });
  return _json(pedidos);
}

/** POST → maneja las acciones del frontend y del panel admin. */
function doPost(e) {
  var datos = JSON.parse(e.postData.contents);
  var cab   = SHEET.getRange(1, 1, 1, SHEET.getLastColumn()).getValues()[0];

  // Alta de un nuevo pedido (enviado por el usuario desde el mapa)
  if (datos.action === "add") {
    var fila = cab.map(function(col) {
      return datos[col] !== undefined ? datos[col] : "";
    });
    SHEET.appendRow(fila);
    return _json({ ok: true });
  }

  // Cambio de estado (open / closed) — acción de administrador
  if (datos.action === "setStatus") {
    var idC = cab.indexOf("id");
    var stC = cab.indexOf("status");
    var fs  = SHEET.getDataRange().getValues();
    for (var j = 1; j < fs.length; j++) {
      if (fs[j][idC] === datos.id) {
        SHEET.getRange(j + 1, stC + 1).setValue(datos.status);
        break;
      }
    }
    return _json({ ok: true });
  }

  return _json({ ok: false, error: "accion desconocida" });
}

/** Helper: respuesta JSON con cabeceras CORS correctas. */
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
