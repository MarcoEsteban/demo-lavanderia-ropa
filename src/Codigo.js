/**
 * ============================================================================
 * LAVANDERÍA DEMO — Backend base
 * Google Sheets como base de datos + Apps Script como backend/frontend.
 *
 * Hojas: Config | Servicios | Clientes | Ordenes | OrdenLineas | Eventos |
 *        Pagos | Notificaciones
 *
 * Las funciones que terminan en "_" son privadas por convención. En Apps
 * Script eso NO es una barrera de seguridad: cualquier función global puede
 * invocarse desde el cliente vía google.script.run. Por eso cada operación
 * sensible valida un token de sesión en su primera línea.
 *
 * La lógica de órdenes, precios, estados, pagos y reportes vive en
 * Operaciones.js (mismo proyecto, mismos globales).
 * ============================================================================
 */

var SHEET_NAMES = {
  CONFIG: 'Config',
  SERVICIOS: 'Servicios',
  CLIENTES: 'Clientes',
  ORDENES: 'Ordenes',
  LINEAS: 'OrdenLineas',
  EVENTOS: 'Eventos',
  PAGOS: 'Pagos',
  NOTIFICACIONES: 'Notificaciones'
};

var HEADERS = {
  CONFIG: ['clave', 'valor'],
  SERVICIOS: ['id', 'nombre', 'tipo', 'categoria', 'precio', 'incluye_planchado', 'activo', 'orden', 'descripcion'],
  CLIENTES: ['id', 'nombre', 'telefono', 'notas', 'fecha_alta'],
  ORDENES: [
    'id', 'codigo', 'token', 'cliente_id', 'cliente_nombre', 'cliente_telefono',
    'estado', 'servicio_id', 'servicio_nombre', 'incluye_planchado',
    'peso_kg', 'peso_cobrado', 'prendas', 'total', 'descuento', 'recargo',
    'total_pagado', 'pago_estado', 'fecha_recepcion', 'fecha_prometida',
    'fecha_entrega', 'notificado', 'fecha_notificacion', 'observaciones', 'creado_por'
  ],
  LINEAS: ['orden_id', 'tipo', 'descripcion', 'cantidad', 'precio_unitario', 'subtotal'],
  EVENTOS: ['id', 'orden_id', 'tipo', 'estado', 'fecha', 'usuario', 'nota'],
  PAGOS: ['id', 'orden_id', 'metodo', 'monto', 'fecha', 'registrado_por', 'nota'],
  NOTIFICACIONES: ['id', 'orden_id', 'canal', 'destino', 'fecha', 'usuario', 'nota']
};

var HOJAS_REQUERIDAS = [
  { nombre: SHEET_NAMES.CONFIG, headers: HEADERS.CONFIG },
  { nombre: SHEET_NAMES.SERVICIOS, headers: HEADERS.SERVICIOS },
  { nombre: SHEET_NAMES.CLIENTES, headers: HEADERS.CLIENTES },
  { nombre: SHEET_NAMES.ORDENES, headers: HEADERS.ORDENES },
  { nombre: SHEET_NAMES.LINEAS, headers: HEADERS.LINEAS },
  { nombre: SHEET_NAMES.EVENTOS, headers: HEADERS.EVENTOS },
  { nombre: SHEET_NAMES.PAGOS, headers: HEADERS.PAGOS },
  { nombre: SHEET_NAMES.NOTIFICACIONES, headers: HEADERS.NOTIFICACIONES }
];

var CONFIG_DEFAULT = {
  negocio_nombre: 'Lavandería Demo',
  negocio_telefono: '70012345',
  negocio_whatsapp: '70012345',
  negocio_direccion: 'Av. Siempre Fresca 123, entre 2do y 3er anillo',
  negocio_ciudad: 'Santa Cruz de la Sierra',
  zona_horaria: 'America/La_Paz',
  moneda: 'BOB',
  moneda_simbolo: 'Bs.',
  horario_apertura: '08:00',
  horario_cierre: '20:00',
  dias_entrega_lavado: '2',
  dias_entrega_planchado: '3',
  dias_entrega_express: '1',
  dias_cerrados: '0', // 0 = domingo. Separar con coma si hay más.
  minimo_kg: '2',
  recargo_express: '15',
  precio_planchado_pieza: '5',
  color_primario: '#0B4F60',
  color_secundario: '#B7791F',
  color_acento: '#E7F1F3',
  whatsapp_plantilla: 'Hola {cliente} 👋\nTu pedido {codigo} en {negocio} ya está listo para retirar.\n\n🧺 {prendas}\n💵 Total: {total}\n{pendiente}\n\n📍 {direccion}\n🕒 {horario}\n\nMirá el estado en línea: {link}',
  pago_qr_url: 'https://quickchart.io/qr?size=240&text=PAGO-DEMO-LAVANDERIA',
  pago_instrucciones: 'Escaneá el QR desde tu app del banco o pagá en efectivo al retirar.',
  pie_pagina_recibo: 'Gracias por confiar en Lavandería Demo.'
};

/** Claves que el panel puede editar. El resto de Config queda protegido. */
var CLAVES_CONFIG_EDITABLES = [
  'negocio_nombre', 'negocio_telefono', 'negocio_whatsapp', 'negocio_direccion',
  'negocio_ciudad', 'horario_apertura', 'horario_cierre', 'dias_entrega_lavado',
  'dias_entrega_planchado', 'dias_entrega_express', 'dias_cerrados', 'minimo_kg',
  'recargo_express', 'precio_planchado_pieza', 'color_primario', 'color_secundario',
  'color_acento', 'whatsapp_plantilla', 'pago_qr_url', 'pago_instrucciones',
  'pie_pagina_recibo'
];

var SERVICIOS_DEMO = [
  ['Lavado por kilo', 'kg', 'general', 12, false, true, 1, 'Ropa de uso diario, secada al aire'],
  ['Lavado + planchado por kilo', 'kg', 'general', 18, true, true, 2, 'Ropa lista para colgar'],
  ['Edredón 1 plaza', 'pieza', 'especial', 25, true, true, 3, 'Lavado y planchado'],
  ['Edredón 2 plazas', 'pieza', 'especial', 35, true, true, 4, 'Lavado y planchado'],
  ['Quilt / colcha', 'pieza', 'especial', 40, true, true, 5, 'Lavado y planchado'],
  ['Alfombra', 'pieza', 'especial', 50, false, true, 6, 'Lavado y secado, sin planchado'],
  ['Cortina (por paño)', 'pieza', 'especial', 20, true, true, 7, 'Lavado y planchado']
];

var ZONA_DEFAULT = 'America/La_Paz';
var CACHE_TTL_CONFIG = 60;
var CACHE_TTL_CATALOGO = 60;
var MAX_INTENTOS_LOGIN = 6;
var BLOQUEO_LOGIN_SEGUNDOS = 300;
var SESION_TTL_SEGUNDOS = 21600; // máximo permitido por CacheService: 6 h

// ----------------------------------------------------------------------------
// WEB APP
// ----------------------------------------------------------------------------

/**
 * Prepara la planilla la primera vez que alguien abre la Web App.
 * Deja todo listo sin exigir ejecutar setup() a mano y siembra los pedidos
 * de ejemplo en segundo plano para no demorar la primera carga.
 * Es idempotente y está protegido con LockService.
 */
function bootstrapDemo_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('DEMO_LISTO') === 'ok') return;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    if (props.getProperty('DEMO_LISTO') === 'ok') return;
    setup();
    if (!hayOrdenes_()) {
      ScriptApp.newTrigger('sembrarDemo').timeBased().after(60000).create();
    }
    props.setProperty('DEMO_LISTO', 'ok');
  } catch (err) {
    console.error('No se pudo preparar la demo: ' + err);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  bootstrapDemo_();
  var params = (e && e.parameter) || {};
  var cfg = getConfig_();
  var tema = {
    primario: colorSeguro_(cfg.color_primario, '#0B4F60'),
    secundario: colorSeguro_(cfg.color_secundario, '#B7791F'),
    acento: colorSeguro_(cfg.color_acento, '#E7F1F3')
  };

  var scriptUrl = '';
  try { scriptUrl = ScriptApp.getService().getUrl() || ''; } catch (err) { scriptUrl = ''; }

  if (params.estado) {
    var token = String(params.estado).trim().slice(0, 64);
    var tmplEstado = HtmlService.createTemplateFromFile('Estado');
    tmplEstado.cfg = cfg;
    tmplEstado.tema = tema;
    tmplEstado.token = token;
    tmplEstado.scriptUrl = scriptUrl;
    return tmplEstado.evaluate()
      .setTitle('Estado del pedido · ' + cfg.negocio_nombre)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }

  var tmpl = HtmlService.createTemplateFromFile('Admin');
  tmpl.cfg = cfg;
  tmpl.tema = tema;
  tmpl.scriptUrl = scriptUrl;
  return tmpl.evaluate()
    .setTitle(cfg.negocio_nombre + ' · Panel')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** Incluye un archivo .html estático dentro de otro template. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** JSON apto para incrustar en un <script> sin romper el HTML. */
function jsonSeguro_(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ----------------------------------------------------------------------------
// UTILIDADES DE HOJAS
// ----------------------------------------------------------------------------

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(nombre) {
  var sh = ss_().getSheetByName(nombre);
  if (!sh) {
    throw new Error('No existe la hoja "' + nombre + '". Ejecutá setup() desde el editor de Apps Script.');
  }
  return sh;
}

/** Lee una hoja completa como array de objetos {encabezado: valor}. */
function readSheetAsObjects_(nombre) {
  var sh = sheet_(nombre);
  var valores = sh.getDataRange().getValues();
  if (valores.length < 2) return [];
  var headers = valores[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < valores.length; i++) {
    var fila = valores[i];
    var vacia = fila.every(function (c) { return c === '' || c === null; });
    if (vacia) continue;
    var obj = {};
    headers.forEach(function (h, idx) { obj[h] = fila[idx]; });
    obj.__row = i + 1;
    out.push(obj);
  }
  return out;
}

function parseBool_(v) {
  if (typeof v === 'boolean') return v;
  var s = String(v).trim().toUpperCase();
  return s === 'TRUE' || s === 'SI' || s === 'SÍ' || s === '1';
}

/**
 * Escribe una fila nueva mapeando por NOMBRE de encabezado. Fuerza formato
 * texto en los valores string para que un nombre tipo "=HYPERLINK(...)" no se
 * evalúe como fórmula (inyección de fórmulas vía datos del cliente).
 */
function escribirFilaPorEncabezado_(nombreHoja, datos) {
  var sh = sheet_(nombreHoja);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  var fila = headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(datos, h) ? datos[h] : '';
  });

  var n = sh.getLastRow() + 1;
  headers.forEach(function (h, idx) {
    var valor = fila[idx];
    var esTexto = typeof valor === 'string' && valor !== '';
    var esContacto = h.indexOf('cliente_') === 0 || h === 'nota' || h === 'notas' || h === 'nombre' || h === 'descripcion';
    if (esTexto || esContacto) sh.getRange(n, idx + 1).setNumberFormat('@');
  });

  sh.getRange(n, 1, 1, headers.length).setValues([fila]);
  return n;
}

/** Actualiza una fila existente mapeando por NOMBRE de encabezado. */
function actualizarFilaPorEncabezado_(nombreHoja, row, datos) {
  var sh = sheet_(nombreHoja);
  var n = Number(row);
  if (!isFinite(n) || Math.floor(n) !== n || n < 2 || n > sh.getLastRow()) {
    throw new Error('Fila inválida.');
  }

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  headers.forEach(function (h, idx) {
    if (!Object.prototype.hasOwnProperty.call(datos, h)) return;
    var valor = datos[h];
    if (typeof valor === 'string' && valor !== '') sh.getRange(n, idx + 1).setNumberFormat('@');
    sh.getRange(n, idx + 1).setValue(valor);
  });

  return n;
}

function obtenerSiguienteId_(nombreHoja) {
  var filas = readSheetAsObjects_(nombreHoja);
  var max = 0;
  filas.forEach(function (f) {
    var n = Number(f.id);
    if (isFinite(n) && n > max) max = n;
  });
  return max + 1;
}

function generarCodigoOrden_(id) {
  return 'L-' + ('0000' + String(id)).slice(-4);
}

// ----------------------------------------------------------------------------
// TEXTO Y TELÉFONOS
// ----------------------------------------------------------------------------

/** Limpia texto libre: recorta, colapsa espacios y neutraliza fórmulas. */
function limpiarTexto_(valor, maxLargo) {
  var s = String(valor == null ? '' : valor)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // La inyección de fórmulas se evita escribiendo con formato texto en
  // escribirFilaPorEncabezado_ / actualizarFilaPorEncabezado_.
  var max = maxLargo || 300;
  return s.slice(0, max);
}

/**
 * Normaliza teléfonos bolivianos a 8 dígitos locales.
 * Acepta +591 70012345, 00591..., 591..., con espacios o guiones.
 */
function normalizarTelefono_(telefono) {
  var d = String(telefono == null ? '' : telefono).replace(/\D/g, '');
  if (d.indexOf('00591') === 0) d = d.slice(5);
  else if (d.indexOf('591') === 0 && d.length > 8) d = d.slice(3);
  return d.slice(0, 8);
}

/** Celular boliviano válido: 8 dígitos, empieza en 6 o 7. */
function telefonoValido_(telefono) {
  return /^[67]\d{7}$/.test(normalizarTelefono_(telefono));
}

/** Número internacional para wa.me (sin + ni espacios). */
function telefonoWhatsapp_(telefono) {
  var local = normalizarTelefono_(telefono);
  return local ? '591' + local : '';
}

function formatearTelefono_(telefono) {
  var local = normalizarTelefono_(telefono);
  if (local.length !== 8) return local;
  return local.slice(0, 3) + ' ' + local.slice(3, 6) + ' ' + local.slice(6);
}

// ----------------------------------------------------------------------------
// FECHAS (siempre sobre ISO yyyy-MM-dd, sin depender de la zona del server)
// ----------------------------------------------------------------------------

function zonaHoraria_(cfg) {
  return (cfg && cfg.zona_horaria) || ZONA_DEFAULT;
}

function esFechaISO_(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''));
}

function hoyISO_(zona) {
  return Utilities.formatDate(new Date(), zona || ZONA_DEFAULT, 'yyyy-MM-dd');
}

function partesISO_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) throw new Error('Fecha inválida: ' + iso);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Suma días a una fecha ISO usando aritmética UTC (sin DST). */
function sumarDiasISO_(iso, dias) {
  var p = partesISO_(iso);
  var t = Date.UTC(p.y, p.m - 1, p.d) + Number(dias) * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
function diaSemanaISO_(iso) {
  var p = partesISO_(iso);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

function diasCerrados_(cfg) {
  var raw = String((cfg && cfg.dias_cerrados) || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map(function (s) { return Number(String(s).trim()); })
    .filter(function (n) { return isFinite(n) && n >= 0 && n <= 6; });
}

/**
 * Calcula la fecha prometida sumando días hábiles (salta días cerrados).
 * Si `dias` es 0 devuelve la misma fecha base.
 */
function calcularFechaPrometida_(baseISO, dias, cfg) {
  var cerrados = diasCerrados_(cfg);
  var actual = baseISO;
  var agregados = 0;
  var vueltas = 0;
  while (agregados < Number(dias || 0) && vueltas < 90) {
    actual = sumarDiasISO_(actual, 1);
    if (cerrados.indexOf(diaSemanaISO_(actual)) === -1) agregados++;
    vueltas++;
  }
  return actual;
}

/** Convierte una celda fecha a ISO yyyy-MM-dd. */
function fechaISODeCelda_(valor, zona) {
  if (valor instanceof Date) return Utilities.formatDate(valor, zona || ZONA_DEFAULT, 'yyyy-MM-dd');
  if (typeof valor === 'number') return Utilities.formatDate(new Date(valor), zona || ZONA_DEFAULT, 'yyyy-MM-dd');
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor || '').trim());
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

/** Convierte una fecha ISO a Date al mediodía local (evita corrimientos). */
function fechaDesdeISO_(iso, zona) {
  return Utilities.parseDate(String(iso) + ' 12:00', zona || ZONA_DEFAULT, 'yyyy-MM-dd HH:mm');
}

/** Milisegundos de una celda fecha, o 0 si está vacía. */
function fechaMs_(valor) {
  if (!valor) return 0;
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number') return valor;
  var t = new Date(valor).getTime();
  return isFinite(t) ? t : 0;
}

function redondear2_(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function formatearMonto_(monto, cfg) {
  var simbolo = (cfg && cfg.moneda_simbolo) || 'Bs.';
  var n = redondear2_(monto || 0);
  var partes = n.toFixed(2).split('.');
  return simbolo + ' ' + partes[0] + ',' + partes[1];
}

// ----------------------------------------------------------------------------
// CONFIG Y CATÁLOGOS
// ----------------------------------------------------------------------------

function getConfig_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('lav_cfg');
  if (cached) return JSON.parse(cached);

  var filas = readSheetAsObjects_(SHEET_NAMES.CONFIG);
  var cfg = {};
  filas.forEach(function (f) {
    var clave = String(f.clave || '').trim();
    if (clave) cfg[clave] = f.valor;
  });
  cache.put('lav_cfg', JSON.stringify(cfg), CACHE_TTL_CONFIG);
  return cfg;
}

function getServicios_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('lav_servicios');
  if (cached) return JSON.parse(cached);

  var servicios = readSheetAsObjects_(SHEET_NAMES.SERVICIOS)
    .map(function (s) {
      return {
        id: Number(s.id),
        nombre: String(s.nombre || ''),
        tipo: String(s.tipo || 'pieza'),
        categoria: String(s.categoria || 'especial'),
        precio: Number(s.precio) || 0,
        incluyePlanchado: parseBool_(s.incluye_planchado),
        activo: parseBool_(s.activo),
        orden: Number(s.orden) || 0,
        descripcion: String(s.descripcion || '')
      };
    })
    .sort(function (a, b) {
      var ca = a.categoria === 'general' ? 0 : 1;
      var cb = b.categoria === 'general' ? 0 : 1;
      if (ca !== cb) return ca - cb;
      if (a.orden !== b.orden) return a.orden - b.orden;
      return a.id - b.id;
    });

  cache.put('lav_servicios', JSON.stringify(servicios), CACHE_TTL_CATALOGO);
  return servicios;
}

function getServiciosActivos_() {
  return getServicios_().filter(function (s) { return s.activo; });
}

function getServicio_(id) {
  var n = Number(id);
  var found = getServicios_().filter(function (s) { return s.id === n; })[0];
  if (!found) throw new Error('Servicio inexistente.');
  return found;
}

function invalidarCache_() {
  CacheService.getScriptCache().removeAll(['lav_cfg', 'lav_servicios']);
}

function limpiarCacheTotal() {
  invalidarCache_();
  Logger.log('Caché de configuración y catálogos limpio.');
}

function limpiarCacheAdmin(token) {
  return conSesion_(token, ['admin'], function () {
    invalidarCache_();
    return { mensaje: 'Caché de configuración y catálogos limpio.' };
  });
}

function datosNegocio_(cfg) {
  return {
    nombre: cfg.negocio_nombre || 'Lavandería Demo',
    telefono: normalizarTelefono_(cfg.negocio_telefono || ''),
    whatsapp: normalizarTelefono_(cfg.negocio_whatsapp || ''),
    telefonoBonito: formatearTelefono_(cfg.negocio_telefono || cfg.negocio_whatsapp || ''),
    direccion: cfg.negocio_direccion || '',
    ciudad: cfg.negocio_ciudad || '',
    horario: (cfg.horario_apertura || '08:00') + ' a ' + (cfg.horario_cierre || '20:00'),
    monedaSimbolo: cfg.moneda_simbolo || 'Bs.',
    zonaHoraria: zonaHoraria_(cfg),
    pagoQrUrl: cfg.pago_qr_url || '',
    pagoInstrucciones: cfg.pago_instrucciones || ''
  };
}

function configPublica_(cfg) {
  return {
    minimoKg: Number(cfg.minimo_kg) || 0,
    recargoExpress: Number(cfg.recargo_express) || 0,
    precioPlanchadoPieza: Number(cfg.precio_planchado_pieza) || 0,
    diasEntregaLavado: Number(cfg.dias_entrega_lavado) || 0,
    diasEntregaPlanchado: Number(cfg.dias_entrega_planchado) || 0,
    diasEntregaExpress: Number(cfg.dias_entrega_express) || 0,
    diasCerrados: diasCerrados_(cfg),
    horarioApertura: cfg.horario_apertura || '08:00',
    horarioCierre: cfg.horario_cierre || '20:00',
    piePagina: cfg.pie_pagina_recibo || ''
  };
}

function colorSeguro_(valor, fallback) {
  var s = String(valor || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}

/** Devuelve el listado de servicios con el formato que consume el cliente. */
function servicioDto_(s) {
  return {
    id: s.id,
    nombre: s.nombre,
    tipo: s.tipo,
    categoria: s.categoria,
    precio: s.precio,
    incluyePlanchado: s.incluyePlanchado,
    activo: s.activo,
    descripcion: s.descripcion
  };
}

function buscarClientes_(texto, limite) {
  var q = String(texto || '').trim().toLowerCase();
  var tel = normalizarTelefono_(texto);
  return readSheetAsObjects_(SHEET_NAMES.CLIENTES)
    .filter(function (c) {
      if (!q) return true;
      var nombre = String(c.nombre || '').toLowerCase();
      var telefono = normalizarTelefono_(c.telefono);
      return nombre.indexOf(q) > -1 || (tel && telefono.indexOf(tel) > -1);
    })
    .slice(0, limite || 20)
    .map(function (c) {
      return {
        id: Number(c.id),
        nombre: String(c.nombre || ''),
        telefono: normalizarTelefono_(c.telefono),
        telefonoBonito: formatearTelefono_(c.telefono)
      };
    });
}

/**
 * Busca por teléfono o crea el cliente. Devuelve el id.
 * Solo actualiza el nombre si viene uno nuevo distinto.
 */
function upsertCliente_(nombre, telefono) {
  var tel = normalizarTelefono_(telefono);
  var filas = readSheetAsObjects_(SHEET_NAMES.CLIENTES);
  var existente = filas.filter(function (c) { return normalizarTelefono_(c.telefono) === tel; })[0];

  if (existente) {
    var nombreActual = String(existente.nombre || '').trim();
    if (nombre && nombre !== nombreActual) {
      actualizarFilaPorEncabezado_(SHEET_NAMES.CLIENTES, existente.__row, { nombre: nombre });
    }
    return Number(existente.id);
  }

  var id = obtenerSiguienteId_(SHEET_NAMES.CLIENTES);
  escribirFilaPorEncabezado_(SHEET_NAMES.CLIENTES, {
    id: id,
    nombre: nombre,
    telefono: tel,
    notas: '',
    fecha_alta: new Date()
  });
  return id;
}

// ----------------------------------------------------------------------------
// SESIONES / AUTENTICACIÓN
// ----------------------------------------------------------------------------

function getAuthConfigurada_() {
  var props = PropertiesService.getScriptProperties();
  return !!(props.getProperty('ADMIN_PIN') || props.getProperty('STAFF_PIN'));
}

function leerSesion_(token) {
  var t = String(token || '').trim();
  if (!t || t.length > 80) return null;
  var raw = CacheService.getScriptCache().get('lav_ses_' + t);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

/** Envuelve una operación autenticada y normaliza la respuesta. */
function conSesion_(token, rolesPermitidos, fn) {
  var ses = leerSesion_(token);
  if (!ses) return { ok: false, error: 'Sesión vencida. Volvé a ingresar.' };
  if (rolesPermitidos && rolesPermitidos.indexOf(ses.rol) === -1) {
    return { ok: false, error: 'No tenés permiso para esta acción.' };
  }
  try {
    var resultado = fn(ses) || {};
    var salida = { ok: true };
    Object.keys(resultado).forEach(function (k) { salida[k] = resultado[k]; });
    return salida;
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function iniciarSesion(credenciales) {
  var rol = String((credenciales && credenciales.rol) || '').trim();
  if (rol !== 'admin' && rol !== 'staff') {
    return { ok: false, error: 'Rol inválido.' };
  }

  var props = PropertiesService.getScriptProperties();
  var esperado = props.getProperty(rol === 'admin' ? 'ADMIN_PIN' : 'STAFF_PIN');
  if (!esperado) {
    return { ok: false, error: 'El acceso no está configurado. Ejecutá setup() desde el editor de Apps Script.' };
  }

  var cache = CacheService.getScriptCache();
  var claveIntentos = 'lav_intentos_' + rol;
  var intentos = Number(cache.get(claveIntentos) || 0);
  if (intentos >= MAX_INTENTOS_LOGIN) {
    return { ok: false, error: 'Demasiados intentos fallidos. Esperá 5 minutos y probá de nuevo.' };
  }

  var pin = String((credenciales && credenciales.pin) || '').trim();
  if (pin !== String(esperado)) {
    var nuevos = intentos + 1;
    cache.put(claveIntentos, String(nuevos), BLOQUEO_LOGIN_SEGUNDOS);
    return {
      ok: false,
      error: nuevos >= MAX_INTENTOS_LOGIN
        ? 'Demasiados intentos fallidos. Esperá 5 minutos y probá de nuevo.'
        : 'PIN incorrecto.'
    };
  }

  cache.remove(claveIntentos);
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  cache.put('lav_ses_' + token, JSON.stringify({ rol: rol, creado: Date.now() }), SESION_TTL_SEGUNDOS);

  return {
    ok: true,
    token: token,
    rol: rol,
    nombre: rol === 'admin' ? 'Administración' : 'Mostrador'
  };
}

function cerrarSesion(token) {
  var t = String(token || '').trim();
  if (t) CacheService.getScriptCache().remove('lav_ses_' + t);
  return { ok: true };
}

function getInicio() {
  var cfg = getConfig_();
  return {
    ok: true,
    negocio: datosNegocio_(cfg),
    authConfigurada: getAuthConfigurada_()
  };
}

function getContexto(token) {
  return conSesion_(token, ['admin', 'staff'], function (ses) {
    var cfg = getConfig_();
    return {
      sesion: { rol: ses.rol, nombre: ses.rol === 'admin' ? 'Administración' : 'Mostrador' },
      negocio: datosNegocio_(cfg),
      cfg: configPublica_(cfg),
      servicios: getServiciosActivos_().map(servicioDto_),
      estados: ESTADOS_ORDEN,
      hoy: hoyISO_(zonaHoraria_(cfg))
    };
  });
}

function buscarClientes(token, texto) {
  return conSesion_(token, ['admin', 'staff'], function () {
    return { clientes: buscarClientes_(texto, 12) };
  });
}

// ----------------------------------------------------------------------------
// ADMINISTRACIÓN DE CATÁLOGOS Y CONFIG
// ----------------------------------------------------------------------------

function guardarServicioAdmin(token, datos) {
  return conSesion_(token, ['admin'], function () {
    var d = datos || {};
    var id = Number(d.id) || 0;
    var nombre = limpiarTexto_(d.nombre, 60);
    if (nombre.length < 2) throw new Error('El nombre del servicio es obligatorio.');

    var tipo = d.tipo === 'kg' ? 'kg' : 'pieza';
    var categoria = tipo === 'kg' ? 'general' : 'especial';
    var precio = Number(String(d.precio == null ? '' : d.precio).replace(',', '.'));
    if (!isFinite(precio) || precio <= 0 || precio > 10000) {
      throw new Error('El precio debe ser mayor a 0 y menor a 10000.');
    }

    var existentes = readSheetAsObjects_(SHEET_NAMES.SERVICIOS);
    var actual = id ? existentes.filter(function (s) { return Number(s.id) === id; })[0] : null;
    if (id && !actual) throw new Error('Servicio inexistente.');

    var activo = d.activo === undefined ? true : !!d.activo;
    var datosFila = {
      nombre: nombre,
      tipo: tipo,
      categoria: categoria,
      precio: redondear2_(precio),
      incluye_planchado: !!d.incluyePlanchado,
      activo: activo,
      orden: Number(d.orden) || (actual ? Number(actual.orden) : existentes.length + 1),
      descripcion: limpiarTexto_(d.descripcion, 120)
    };

    if (!id) {
      if (activo && tipo === 'kg' && !existentes.some(function (s) { return parseBool_(s.activo) && s.tipo === 'kg'; })) {
        datosFila.orden = 1;
      }
      datosFila.id = obtenerSiguienteId_(SHEET_NAMES.SERVICIOS);
      escribirFilaPorEncabezado_(SHEET_NAMES.SERVICIOS, datosFila);
      id = datosFila.id;
    } else {
      // No permitir quedarse sin ningún servicio por kilo activo.
      if (tipo === 'kg' && !activo) {
        var otrosKg = existentes.filter(function (s) {
          return Number(s.id) !== id && parseBool_(s.activo) && s.tipo === 'kg';
        });
        if (!otrosKg.length) throw new Error('Tiene que quedar al menos un servicio por kilo activo.');
      }
      actualizarFilaPorEncabezado_(SHEET_NAMES.SERVICIOS, actual.__row, datosFila);
    }

    invalidarCache_();
    return { servicio: servicioDto_(getServicio_(id)) };
  });
}

function cambiarServicioActivoAdmin(token, id, activo) {
  return conSesion_(token, ['admin'], function () {
    var s = getServicio_(id);
    if (!activo) {
      var otros = getServicios_().filter(function (x) {
        return x.id !== s.id && x.activo && x.tipo === 'kg';
      });
      if (s.tipo === 'kg' && !otros.length) {
        throw new Error('Tiene que quedar al menos un servicio por kilo activo.');
      }
    }
    actualizarFilaPorEncabezado_(SHEET_NAMES.SERVICIOS, filaServicio_(s.id), { activo: !!activo });
    invalidarCache_();
    return { servicio: servicioDto_(getServicio_(s.id)) };
  });
}

function filaServicio_(id) {
  var fila = readSheetAsObjects_(SHEET_NAMES.SERVICIOS)
    .filter(function (s) { return Number(s.id) === Number(id); })[0];
  if (!fila) throw new Error('Servicio inexistente.');
  return fila.__row;
}

function getConfigAdmin(token) {
  return conSesion_(token, ['admin'], function () {
    var cfg = getConfig_();
    var valores = {};
    CLAVES_CONFIG_EDITABLES.forEach(function (k) { valores[k] = cfg[k] == null ? '' : cfg[k]; });
    return {
      config: valores,
      servicios: getServicios_().map(servicioDto_),
      clavesProtegidas: ['zona_horaria', 'moneda', 'moneda_simbolo']
    };
  });
}

function validarConfig_(clave, valor) {
  var v = String(valor == null ? '' : valor).trim();

  if (clave === 'negocio_nombre' && v.length < 2) throw new Error('El nombre del negocio es obligatorio.');
  if (clave === 'negocio_whatsapp') {
    if (!telefonoValido_(v)) {
      throw new Error('El WhatsApp del negocio debe ser un celular boliviano de 8 dígitos (empieza en 6 o 7).');
    }
    v = normalizarTelefono_(v);
  }
  if (clave === 'negocio_telefono') {
    if (v && !telefonoValido_(v)) {
      throw new Error('El teléfono del negocio debe ser un celular boliviano de 8 dígitos.');
    }
    v = v ? normalizarTelefono_(v) : '';
  }
  if (/^color_/.test(clave)) {
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error('Los colores deben ser hexadecimales, por ejemplo #0B4F60.');
  }
  if (clave === 'minimo_kg' || clave === 'recargo_express' || clave === 'precio_planchado_pieza') {
    var n = Number(v.replace(',', '.'));
    if (!isFinite(n) || n < 0) throw new Error('Ese valor debe ser un número mayor o igual a 0.');
    v = String(redondear2_(n));
  }
  if (clave === 'dias_entrega_lavado' || clave === 'dias_entrega_planchado' || clave === 'dias_entrega_express') {
    var d = Number(v);
    if (!isFinite(d) || d < 0 || d > 30) throw new Error('Los días de entrega deben estar entre 0 y 30.');
    v = String(Math.round(d));
  }
  if (clave === 'dias_cerrados') {
    if (v === '') return '';
    var dias = v.split(',').map(function (x) { return Number(String(x).trim()); });
    var ok = dias.every(function (x) { return isFinite(x) && x >= 0 && x <= 6; });
    if (!ok) throw new Error('Los días cerrados van de 0 (domingo) a 6 (sábado), separados por coma.');
    v = dias.join(',');
  }
  if (clave === 'horario_apertura' || clave === 'horario_cierre') {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error('El horario debe tener formato HH:MM.');
  }
  if (clave === 'pago_qr_url' && v && !/^https?:\/\//i.test(v)) {
    throw new Error('La URL del QR debe empezar con http:// o https://.');
  }
  if (clave === 'whatsapp_plantilla' && v.length < 10) {
    throw new Error('La plantilla de WhatsApp es demasiado corta.');
  }

  return v;
}

function guardarConfigAdmin(token, cambios) {
  return conSesion_(token, ['admin'], function () {
    var datos = cambios || {};
    var filas = readSheetAsObjects_(SHEET_NAMES.CONFIG);
    var porClave = {};
    filas.forEach(function (f) { porClave[String(f.clave || '').trim()] = f; });

    Object.keys(datos).forEach(function (clave) {
      if (CLAVES_CONFIG_EDITABLES.indexOf(clave) === -1) return;
      var valor = validarConfig_(clave, datos[clave]);
      if (porClave[clave]) {
        actualizarFilaPorEncabezado_(SHEET_NAMES.CONFIG, porClave[clave].__row, { valor: valor });
      } else {
        escribirFilaPorEncabezado_(SHEET_NAMES.CONFIG, { clave: clave, valor: valor });
      }
    });

    invalidarCache_();
    return { mensaje: 'Configuración guardada.' };
  });
}

// ----------------------------------------------------------------------------
// SETUP / DATOS DE DEMO
// ----------------------------------------------------------------------------

function setup() {
  var ss = ss_();
  var hojasCreadas = [];
  var headersAgregados = {};

  HOJAS_REQUERIDAS.forEach(function (def) {
    var sh = ss.getSheetByName(def.nombre);
    if (!sh) {
      sh = ss.insertSheet(def.nombre);
      hojasCreadas.push(def.nombre);
    }
    var faltantes = asegurarHeaders_(sh, def.headers);
    if (faltantes.length) headersAgregados[def.nombre] = faltantes;
  });

  var shConfig = ss.getSheetByName(SHEET_NAMES.CONFIG);
  var valores = shConfig.getDataRange().getValues();
  var claves = {};
  for (var i = 1; i < valores.length; i++) {
    var clave = String(valores[i][0] == null ? '' : valores[i][0]).trim();
    if (clave) claves[clave] = true;
  }

  var fila = Math.max(shConfig.getLastRow(), 1) + 1;
  var configAgregada = [];
  Object.keys(CONFIG_DEFAULT).forEach(function (k) {
    if (claves[k]) return;
    shConfig.getRange(fila, 1, 1, 2).setValues([[k, CONFIG_DEFAULT[k]]]);
    fila++;
    configAgregada.push(k);
  });

  // Catálogo de ejemplo la primera vez.
  var serviciosAgregados = 0;
  var shServicios = ss.getSheetByName(SHEET_NAMES.SERVICIOS);
  if (shServicios.getLastRow() < 2) {
    SERVICIOS_DEMO.forEach(function (s, idx) {
      escribirFilaPorEncabezado_(SHEET_NAMES.SERVICIOS, {
        id: idx + 1,
        nombre: s[0],
        tipo: s[1],
        categoria: s[2],
        precio: s[3],
        incluye_planchado: s[4],
        activo: s[5],
        orden: s[6],
        descripcion: s[7]
      });
      serviciosAgregados++;
    });
  }

  // PINs de demo. Cambiarlos antes de usar con datos reales.
  var props = PropertiesService.getScriptProperties();
  var pinsCreados = [];
  if (!props.getProperty('ADMIN_PIN')) {
    props.setProperty('ADMIN_PIN', '2468');
    pinsCreados.push('ADMIN_PIN');
  }
  if (!props.getProperty('STAFF_PIN')) {
    props.setProperty('STAFF_PIN', '1357');
    pinsCreados.push('STAFF_PIN');
  }

  invalidarCache_();

  var resumen = {
    ok: true,
    hojasCreadas: hojasCreadas,
    headersAgregados: headersAgregados,
    configAgregada: configAgregada,
    serviciosAgregados: serviciosAgregados,
    pinsCreados: pinsCreados
  };
  Logger.log(JSON.stringify(resumen));
  return resumen;
}

/**
 * Asegura que una hoja tenga todos los encabezados pedidos, en orden.
 * No reordena ni borra columnas existentes.
 */
function asegurarHeaders_(sh, headers) {
  var ultimaCol = sh.getLastColumn();
  if (ultimaCol === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return headers.slice();
  }

  var actuales = sh.getRange(1, 1, 1, ultimaCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var faltantes = headers.filter(function (h) { return actuales.indexOf(h) === -1; });

  if (faltantes.length) {
    sh.getRange(1, ultimaCol + 1, 1, faltantes.length).setValues([faltantes]);
  }
  return faltantes;
}

/** ¿Hay órdenes cargadas? Lo usa sembrarDemo para no duplicar. */
function hayOrdenes_() {
  try {
    return readSheetAsObjects_(SHEET_NAMES.ORDENES).length > 0;
  } catch (err) {
    return false;
  }
}

// ----------------------------------------------------------------------------
// MENÚ DE LA HOJA
// ----------------------------------------------------------------------------

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Lavandería Demo')
      .addItem('1. Preparar hojas y configuración', 'setup')
      .addItem('2. Cargar datos de ejemplo', 'sembrarDemo')
      .addSeparator()
      .addItem('Abrir la app', 'abrirApp')
      .addToUi();
  } catch (err) {
    // Sin UI (por ejemplo, ejecución desde clasp): no hacer nada.
  }
}

function abrirApp() {
  var url = ScriptApp.getService().getUrl();
  var html = HtmlService.createHtmlOutput(
    '<p>Abriendo la app…</p><script>window.open(' + JSON.stringify(url) + ', "_blank");google.script.host.close();</script>'
  ).setWidth(320).setHeight(120);
  SpreadsheetApp.getUi().showModalDialog(html, 'Lavandería Demo');
}
