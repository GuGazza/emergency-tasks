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
 * NOTIFICACIONES POR EMAIL — configurar en Script Properties:
 *   Apps Script → Configuración del proyecto (⚙️) → Propiedades del script
 *
 *   Propiedad      | Valor de ejemplo
 *   ---------------|-----------------------------------------
 *   NOTIFY_ENABLED | true          (o false para desactivar)
 *   EMAIL_TO       | admin@gmail.com, otro@gmail.com
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
  var idIdx = cab.indexOf("id");
  var pedidos = filas
    .filter(function(f) { return idIdx >= 0 && f[idIdx] !== ""; })
    .map(function(f) {
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

  if (datos.action === "add") {
    var fila = cab.map(function(col) {
      return datos[col] !== undefined ? datos[col] : "";
    });
    SHEET.appendRow(fila);
    _notifyEmail(datos);
    return _json({ ok: true });
  }

  if (datos.action === "setStatus") {
    var idC = cab.indexOf("id");
    var stC = cab.indexOf("status");
    var fs  = SHEET.getDataRange().getValues();
    for (var j = 1; j < fs.length; j++) {
      if (fs[j][idC] === datos.id) {
        SHEET.getRange(j + 1, stC + 1).setValue(datos.status);
        var pedidoActualizado = {};
        cab.forEach(function(c, i) { pedidoActualizado[c] = fs[j][i]; });
        pedidoActualizado.status = datos.status;
        _notifyEmail(pedidoActualizado);
        break;
      }
    }
    return _json({ ok: true });
  }

  return _json({ ok: false, error: "accion desconocida" });
}

/** Helper: respuesta JSON. */
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Envía email al publicarse un nuevo pedido o al cambiar su estado.
 * Se activa/desactiva y configura desde Script Properties (sin tocar este código):
 *   NOTIFY_ENABLED = true | false
 *   EMAIL_TO       = destinatarios separados por coma
 */
function _notifyEmail(datos) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("NOTIFY_ENABLED") !== "true") return;
  var to = props.getProperty("EMAIL_TO");
  if (!to) return;

  var CATEGORIAS = {
    alimentos: "🍽 Alimentos", medicamentos: "💊 Medicamentos",
    agua: "💧 Agua / Suministros", alojamiento: "🏠 Alojamiento",
    transporte: "🚗 Transporte", otros: "📦 Otros"
  };
  var cat    = CATEGORIAS[datos.categoria] || datos.categoria || "–";
  var estado = datos.status === "closed" ? "Cerrado" : "Abierto";
  var esNuevo = datos.action === "add";

  try {
    MailApp.sendEmail({
      to:      to,
      subject: esNuevo
        ? "🆕 Nuevo pedido: " + cat
        : "🔄 Pedido actualizado: " + cat + " → " + estado,
      body:
        (esNuevo ? "Nuevo pedido publicado en el mapa." : "Un pedido cambió de estado.") + "\n\n" +
        "Categoría : " + cat                                                + "\n" +
        "Pedido    : " + (datos.pedido    || "–")                           + "\n" +
        "Estado    : " + estado                                             + "\n" +
        "Teléfono  : " + (datos.telefono  || "–")                           + "\n" +
        "Instagram : " + (datos.instagram ? "@" + datos.instagram : "–")   + "\n" +
        "Coords    : " + datos.lat + ", " + datos.lng                       + "\n" +
        "Ver en mapa: https://maps.google.com/?q=" + datos.lat + "," + datos.lng
    });
  } catch(e) {
    Logger.log("Email error: " + e);
  }
}

/**
 * DIAGNÓSTICO — ejecutar MANUALMENTE desde el editor de Apps Script.
 * (Elegí "probarEmail" en el selector de funciones y pulsá ▶ Ejecutar.)
 *
 * La PRIMERA vez Google pedirá autorización para enviar correos: aceptala.
 * Ese es el paso clave: sin esta autorización, el envío automático del
 * formulario falla en silencio para visitantes anónimos.
 *
 * Luego revisá:
 *   • el registro (abajo, "Registro de ejecución") → muestra los valores guardados
 *   • tu bandeja de entrada (y la carpeta de Spam) → debería llegar la prueba
 */
function probarEmail() {
  var props   = PropertiesService.getScriptProperties();
  var enabled = props.getProperty("NOTIFY_ENABLED");
  var to      = props.getProperty("EMAIL_TO");

  Logger.log("NOTIFY_ENABLED = [" + enabled + "]   (debe ser exactamente: true)");
  Logger.log("EMAIL_TO       = [" + to + "]");

  if (!to) {
    Logger.log("⚠️ EMAIL_TO está vacío. Configuralo en Propiedades del script.");
    return;
  }

  MailApp.sendEmail({
    to:      to,
    subject: "✅ Prueba de notificación — Mapa de Pedidos",
    body:    "Si recibís este correo, las notificaciones funcionan.\n\n" +
             "NOTIFY_ENABLED = " + enabled + "\n" +
             "EMAIL_TO = " + to
  });
  Logger.log("Correo de prueba enviado a: " + to);
  Logger.log("Cuota diaria de correos restante: " + MailApp.getRemainingDailyQuota());
}

/**
 * Notifica por email cuando se edita la columna `status` directamente en la hoja.
 *
 * IMPORTANTE — esto NO se activa solo: hay que crear un ACTIVADOR INSTALABLE
 * (los activadores simples no pueden usar MailApp porque requiere autorización):
 *   Apps Script → ⏰ Activadores → + Añadir activador
 *     Función a ejecutar : onEditStatus
 *     Implementación     : Head
 *     Origen del evento  : De la hoja de cálculo
 *     Tipo de evento     : Al editar
 *   (la primera vez pedirá autorización: aceptala)
 */
function onEditStatus(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== SHEET.getName()) return;   // solo la hoja de pedidos
  if (e.range.getRow() === 1) return;             // ignora la fila de encabezados

  var cab   = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var stCol = cab.indexOf("status") + 1;
  if (stCol === 0 || e.range.getColumn() !== stCol) return;  // solo la columna `status`

  var fila  = sh.getRange(e.range.getRow(), 1, 1, sh.getLastColumn()).getValues()[0];
  var datos = {};
  cab.forEach(function(c, i) { datos[c] = fila[i]; });
  datos.status = e.range.getValue();   // valor recién editado
  // sin datos.action => _notifyEmail lo trata como "cambio de estado"

  _notifyEmail(datos);
}

/**
 * DIAGNÓSTICO — ejecutar MANUALMENTE desde el editor.
 * Simula la notificación de un cambio de estado (sin tocar la hoja),
 * para confirmar que el correo "🔄 Pedido actualizado" sale con buen formato.
 */
function probarCambioEstado() {
  _notifyEmail({
    categoria: "medicamentos",
    pedido:    "PRUEBA — cambio de estado",
    status:    "closed",
    telefono:  "+58 000 000 0000",
    lat: 10.61, lng: -66.88
  });
  Logger.log("Notificación de cambio de estado enviada. Revisá tu correo (y Spam).");
}
