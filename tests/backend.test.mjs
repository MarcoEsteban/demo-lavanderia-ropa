import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const DIR = path.resolve(import.meta.dirname, '../src');
const FUENTES = ['Codigo.js', 'Operaciones.js'].map((f) => fs.readFileSync(path.join(DIR, f), 'utf8'));

const ZONA = 'America/La_Paz';
const BASE_URL = 'https://script.google.com/macros/s/DEMO/exec';

// ---------------------------------------------------------------------------
// Mocks mínimos de Apps Script
// ---------------------------------------------------------------------------

function partesEnZona(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return out;
}

function offsetMinutos(tz, date) {
  const p = partesEnZona(date, tz);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUTC - date.getTime()) / 60000;
}

function formatDate(date, tz, fmt) {
  if (!(date instanceof Date)) date = new Date(date);
  const p = partesEnZona(date, tz);
  if (fmt === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
  if (fmt === 'HH:mm') return `${p.hour}:${p.minute}`;
  throw new Error('formatDate mock sin soporte para ' + fmt);
}

function parseDate(str, tz, fmt) {
  const conHora = fmt === 'yyyy-MM-dd' ? String(str) + ' 00:00' : String(str);
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(conHora);
  if (!m) throw new Error('parseDate mock sin soporte para ' + str + ' / ' + fmt);
  const utcGuess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
  let offset = offsetMinutos(tz, new Date(utcGuess));
  offset = offsetMinutos(tz, new Date(utcGuess - offset * 60000));
  return new Date(utcGuess - offset * 60000);
}

function crearCache() {
  const store = new Map();
  return {
    get: (k) => (store.has(k) ? store.get(k) : null),
    put: (k, v) => store.set(k, String(v)),
    remove: (k) => store.delete(k),
    removeAll: (keys) => keys.forEach((k) => store.delete(k)),
    __store: store,
  };
}

function crearHoja(nombre, filas) {
  const data = filas.map((f) => f.slice());
  const formatos = [];

  const asegurar = (r, c) => {
    while (data.length < r) data.push([]);
    const fila = data[r - 1];
    while (fila.length < c) fila.push('');
    return fila;
  };

  const rango = (row, col, numRows, numCols) => {
    const nr = numRows == null ? 1 : numRows;
    const nc = numCols == null ? 1 : numCols;
    return {
      getValues() {
        const out = [];
        for (let r = 0; r < nr; r++) {
          const fila = [];
          for (let c = 0; c < nc; c++) {
            fila.push(asegurar(row + r, col + c)[col + c - 1]);
          }
          out.push(fila);
        }
        return out;
      },
      setValues(vals) {
        for (let r = 0; r < vals.length; r++) {
          for (let c = 0; c < vals[r].length; c++) {
            asegurar(row + r, col + c)[col + c - 1] = vals[r][c];
          }
        }
      },
      setValue(v) {
        asegurar(row, col)[col - 1] = v;
      },
      getValue() {
        return asegurar(row, col)[col - 1];
      },
      clearContent() {
        for (let r = 0; r < nr; r++) {
          for (let c = 0; c < nc; c++) asegurar(row + r, col + c)[col + c - 1] = '';
        }
      },
      setNumberFormat(fmt) {
        formatos.push({ row, col, fmt });
      },
    };
  };

  return {
    getName: () => nombre,
    getLastRow: () => data.length,
    getLastColumn: () => data.reduce((max, f) => Math.max(max, f.length), 0),
    getDataRange: () => rango(1, 1, data.length, data.reduce((max, f) => Math.max(max, f.length), 0)),
    getRange: rango,
    deleteRow(row) {
      data.splice(row - 1, 1);
    },
    __data: data,
    __formatos: formatos,
    __col(header) {
      return data[0].map((h) => String(h).trim()).indexOf(header);
    },
  };
}

function cargarBackend(seed = {}) {
  const hojas = new Map();
  for (const [nombre, filas] of Object.entries(seed.hojas || {})) {
    hojas.set(nombre, crearHoja(nombre, filas));
  }
  const cache = crearCache();
  const props = new Map(Object.entries(seed.props || {}));
  let uuid = 1;

  const ctx = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => hojas.get(n) || null,
        insertSheet: (n) => {
          const hoja = crearHoja(n, []);
          hojas.set(n, hoja);
          return hoja;
        },
        getSpreadsheetTimeZone: () => ZONA,
      }),
    },
    CacheService: { getScriptCache: () => cache },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, String(v)),
        deleteProperty: (k) => props.delete(k),
      }),
    },
    Utilities: {
      formatDate,
      parseDate,
      getUuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }),
    },
    Session: { getScriptTimeZone: () => ZONA },
    ScriptApp: { getService: () => ({ getUrl: () => BASE_URL }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Logger: { log() {} },
  };

  vm.createContext(ctx);
  FUENTES.forEach((codigo, i) => {
    vm.runInContext(codigo, ctx, { filename: FUENTES.length > 1 ? ['Codigo.js', 'Operaciones.js'][i] : 'Codigo.js' });
  });

  return { ctx, hojas, cache, props };
}

function nuevoBackend() {
  const b = cargarBackend();
  b.ctx.setup();
  return b;
}

function login(ctx, rol = 'admin') {
  const res = ctx.iniciarSesion({ rol, pin: rol === 'admin' ? '2468' : '1357' });
  assert.equal(res.ok, true, res.error);
  return res.token;
}

function servicio(ctx, texto) {
  const s = ctx.getServicios_().find((x) => x.nombre.toLowerCase().includes(texto.toLowerCase()));
  assert.ok(s, 'No se encontró el servicio ' + texto);
  return s;
}

function ordenDemo(ctx, extra = {}) {
  return {
    nombre: 'Juan Pérez',
    telefono: '+591 7123-4567',
    servicioId: servicio(ctx, 'Lavado por kilo').id,
    pesoKg: 3,
    prendas: 10,
    ...extra,
  };
}

function crear(ctx, token, extra = {}) {
  const res = ctx.crearOrden(token, ordenDemo(ctx, extra));
  assert.equal(res.ok, true, res.error);
  return res.orden;
}

function avanzarHasta(ctx, token, id, destino) {
  let actual = ctx.getOrden(token, id).orden;
  let guardia = 0;
  while (actual.estado !== destino && guardia < 12) {
    const res = ctx.avanzarEstado(token, id, '', '');
    assert.equal(res.ok, true, res.error);
    actual = res.orden;
    guardia++;
  }
  assert.equal(actual.estado, destino);
  return actual;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('setup crea hojas, config, catálogo y PINs; es idempotente', () => {
  const { ctx, hojas } = cargarBackend();
  const res = ctx.setup();
  assert.equal(res.ok, true);
  assert.equal(res.pinsCreados.length, 2);

  for (const nombre of Object.values(ctx.SHEET_NAMES)) {
    assert.ok(hojas.has(nombre), 'Falta la hoja ' + nombre);
  }

  const cfg = ctx.getConfig_();
  assert.equal(cfg.negocio_nombre, 'Lavandería Demo');
  assert.equal(cfg.zona_horaria, ZONA);
  assert.equal(ctx.getServicios_().length, 7);

  const filasServicios = hojas.get('Servicios').__data.length;
  const filasConfig = hojas.get('Config').__data.length;
  const segunda = ctx.setup();
  assert.equal(segunda.hojasCreadas.length, 0);
  assert.equal(segunda.serviciosAgregados, 0);
  assert.equal(hojas.get('Servicios').__data.length, filasServicios);
  assert.equal(hojas.get('Config').__data.length, filasConfig);
});

test('calcularTotales_ aplica mínimo, especiales, planchado, express y descuento', () => {
  const { ctx } = cargarBackend();
  const lavado = { tipo: 'kg', nombre: 'Lavado por kilo', precio: 12, incluyePlanchado: false };
  const edredon = { tipo: 'pieza', nombre: 'Edredón 2 plazas', precio: 25 };

  const r = ctx.calcularTotales_({
    servicio: lavado,
    pesoKg: 1.2,
    especiales: [{ servicio: edredon, cantidad: 2 }],
    planchadoExtra: 3,
    express: true,
    descuento: 10,
    cfg: { minimo_kg: '2', recargo_express: '15', precio_planchado_pieza: '5' },
  });

  assert.equal(r.pesoCobrado, 2);
  assert.equal(r.incluyePlanchado, true);
  assert.equal(r.recargo, 15);
  assert.equal(r.descuento, 10);
  assert.equal(r.subtotal, 104); // 24 + 50 + 15 + 15
  assert.equal(r.total, 94);
  assert.equal(r.lineas.length, 5);
  assert.equal(r.lineas[0].subtotal, 24);
  assert.match(r.lineas[0].descripcion, /mínimo 2 kg/);
  assert.equal(r.lineas[4].tipo, 'descuento');
  assert.equal(r.lineas[4].subtotal, -10);
});

test('calcularTotales_ rechaza datos inválidos', () => {
  const { ctx } = cargarBackend();
  const lavado = { tipo: 'kg', nombre: 'Lavado', precio: 12, incluyePlanchado: false };
  const pieza = { tipo: 'pieza', nombre: 'Quilt', precio: 40 };
  const cfg = { minimo_kg: '2', recargo_express: '15', precio_planchado_pieza: '5' };

  assert.throws(() => ctx.calcularTotales_({ servicio: lavado, pesoKg: 0, cfg }), /mayor a 0/);
  assert.throws(() => ctx.calcularTotales_({ servicio: lavado, pesoKg: 3, descuento: 999, cfg }), /descuento/);
  assert.throws(() => ctx.calcularTotales_({ servicio: pieza, pesoKg: 3, cfg }), /por kilo/);
  assert.throws(() => ctx.calcularTotales_({ servicio: lavado, pesoKg: 3, planchadoExtra: 1, cfg: { ...cfg, precio_planchado_pieza: '0' } }), /precio de planchado/);
});

test('normalizarTelefono_ y telefonoValido_ aceptan formatos bolivianos', () => {
  const { ctx } = cargarBackend();
  for (const tel of ['71234567', '+591 7123-4567', '00591 71234567', '59171234567']) {
    assert.equal(ctx.normalizarTelefono_(tel), '71234567');
    assert.equal(ctx.telefonoValido_(tel), true);
  }
  assert.equal(ctx.telefonoValido_('7123456'), false);
  assert.equal(ctx.telefonoValido_('51234567'), false);
  assert.equal(ctx.telefonoWhatsapp_('+591 7123 4567'), '59171234567');
  assert.equal(ctx.formatearTelefono_('71234567'), '712 345 67');

  const negocio = ctx.datosNegocio_({ negocio_whatsapp: '591 7123-4567', negocio_telefono: '700 12345' });
  assert.equal(negocio.whatsapp, '71234567');
  assert.equal(negocio.telefono, '70012345');
});

test('calcularFechaPrometida_ salta domingos y respeta express', () => {
  const { ctx } = cargarBackend();
  const cfg = { dias_cerrados: '0' };
  // 2026-11-21 es sábado: el domingo 22 no cuenta.
  assert.equal(ctx.sumarDiasISO_('2026-11-21', 1), '2026-11-22');
  assert.equal(ctx.diaSemanaISO_('2026-11-21'), 6);
  assert.equal(ctx.calcularFechaPrometida_('2026-11-21', 2, cfg), '2026-11-24');
  assert.equal(ctx.calcularFechaPrometida_('2026-11-21', 1, cfg), '2026-11-23');

  // Sin días cerrados se entrega todos los días, incluso domingo.
  assert.equal(ctx.diasCerrados_({ dias_cerrados: '' }).length, 0);
  assert.equal(ctx.calcularFechaPrometida_('2026-11-21', 1, { dias_cerrados: '' }), '2026-11-22');
});

test('crearOrden guarda orden, líneas, evento y cliente con precios congelados', () => {
  const { ctx, hojas } = nuevoBackend();
  const token = login(ctx, 'staff');

  const orden = crear(ctx, token, { telefono: '71234567' });
  assert.equal(orden.codigo, 'L-0001');
  assert.equal(orden.estado, 'recibida');
  assert.equal(orden.total, 36);
  assert.equal(orden.take, undefined);
  assert.equal(orden.cliente.telefono, '71234567');
  assert.equal(orden.lineas.length, 1);
  assert.equal(orden.eventos.length, 1);
  assert.equal(orden.eventos[0].estado, 'recibida');
  assert.ok(orden.token.length >= 20);

  assert.equal(hojas.get('Ordenes').__data.length, 2);
  assert.equal(hojas.get('OrdenLineas').__data.length, 2);
  assert.equal(hojas.get('Clientes').__data.length, 2);

  // Cambia el precio del catálogo: la orden ya creada no debe cambiar.
  ctx.actualizarFilaPorEncabezado_('Servicios', 2, { precio: 20 });
  ctx.limpiarCacheTotal();
  assert.equal(ctx.getOrden(token, orden.id).orden.total, 36);

  const segunda = crear(ctx, token, { nombre: 'Otra Persona', telefono: '70001111' });
  assert.equal(segunda.total, 60);
  assert.equal(segunda.codigo, 'L-0002');
});

test('crearOrden valida nombre, teléfono y servicio', () => {
  const { ctx } = nuevoBackend();
  const token = login(ctx, 'staff');
  const base = ordenDemo(ctx);

  assert.equal(ctx.crearOrden(token, { ...base, nombre: 'A' }).ok, false);
  assert.equal(ctx.crearOrden(token, { ...base, telefono: '123' }).ok, false);
  assert.equal(ctx.crearOrden(token, { ...base, pesoKg: 0 }).ok, false);
  assert.match(ctx.crearOrden(token, { ...base, servicioId: 999 }).error, /inexistente/i);
  assert.equal(ctx.crearOrden(token, { ...base, prendas: 999 }).ok, false);
});

test('estado público no filtra teléfono ni notas y valida código + últimos 4', () => {
  const { ctx } = nuevoBackend();
  const token = login(ctx);
  const orden = crear(ctx, token, {
    telefono: '71234567',
    observaciones: 'Dejar en portería, llamar al 71234567',
  });

  const pub = ctx.consultarEstadoPublico(orden.token);
  assert.equal(pub.ok, true);
  assert.equal(pub.orden.cliente, 'Juan');
  assert.equal(pub.orden.estado, 'recibida');
  assert.equal(pub.orden.items.length, 1);
  assert.ok(!JSON.stringify(pub).includes('71234567'));
  assert.ok(!JSON.stringify(pub).includes('portería'));

  const recuperado = ctx.recuperarEstado('L-0001', '4567');
  assert.equal(recuperado.ok, true);
  assert.equal(recuperado.token, orden.token);

  const malo = ctx.recuperarEstado('L-0001', '0000');
  assert.equal(malo.ok, false);
  assert.equal(ctx.recuperarEstado('L-9999', '4567').ok, false);

  assert.equal(ctx.consultarEstadoPublico('token-falso').ok, false);
});

test('recuperarEstado bloquea tras 10 intentos fallidos', () => {
  const { ctx } = nuevoBackend();
  const token = login(ctx);
  crear(ctx, token);

  for (let i = 0; i < 10; i++) {
    assert.equal(ctx.recuperarEstado('L-0001', '0000').ok, false);
  }
  const bloqueado = ctx.recuperarEstado('L-0001', '4567');
  assert.equal(bloqueado.ok, false);
  assert.match(bloqueado.error, /Demasiados intentos/);
});

test('avanzarEstado respeta la máquina de estados y salta planchado si no corresponde', () => {
  const { ctx } = nuevoBackend();
  const token = login(ctx, 'staff');
  const orden = crear(ctx, token);

  const salto = ctx.avanzarEstado(token, orden.id, 'lavado', '');
  assert.equal(salto.ok, false);
  assert.match(salto.error, /No se puede pasar/);

  let actual = ctx.avanzarEstado(token, orden.id, '', '').orden;
  assert.equal(actual.estado, 'clasificacion');
  actual = ctx.avanzarEstado(token, orden.id, '', '').orden;
  assert.equal(actual.estado, 'lavado');

  const cancelar = ctx.cancelarOrden(token, orden.id, 'El cliente se arrepintió');
  assert.equal(cancelar.ok, false);
  assert.match(cancelar.error, /antes de empezar el lavado/);

  actual = ctx.avanzarEstado(token, orden.id, '', '').orden;
  assert.equal(actual.estado, 'secado');
  assert.equal(actual.permitidas.join(','), 'empaquetado');
  actual = ctx.avanzarEstado(token, orden.id, '', '').orden;
  assert.equal(actual.estado, 'empaquetado');
  actual = ctx.avanzarEstado(token, orden.id, '', '').orden;
  assert.equal(actual.estado, 'lista');

  const sinPago = ctx.avanzarEstado(token, orden.id, 'entregada', '');
  assert.equal(sinPago.ok, false);
  assert.match(sinPago.error, /Saldo/);
});

test('pagos parciales, saldo y entrega con pago completo', () => {
  const { ctx } = nuevoBackend();
  const token = login(ctx, 'staff');
  const orden = crear(ctx, token);

  const parcial = ctx.registrarPago(token, orden.id, { metodo: 'efectivo', monto: 10 });
  assert.equal(parcial.ok, true, parcial.error);
  assert.equal(parcial.orden.pagoEstado, 'parcial');
  assert.equal(parcial.orden.saldo, 26);

  const sobrepago = ctx.registrarPago(token, orden.id, { metodo: 'qr', monto: 100 });
  assert.equal(sobrepago.ok, false);
  assert.match(sobrepago.error, /supera el saldo/);

  const resto = ctx.registrarPago(token, orden.id, { metodo: 'qr', monto: 26 });
  assert.equal(resto.ok, true, resto.error);
  assert.equal(resto.orden.pagoEstado, 'pagado');
  assert.equal(resto.orden.saldo, 0);
  assert.equal(resto.orden.pagos.length, 2);

  const lista = avanzarHasta(ctx, token, orden.id, 'lista');
  assert.equal(lista.puedeEntregar, true);
  const entregada = ctx.avanzarEstado(token, orden.id, 'entregada', 'Retirado por el cliente');
  assert.equal(entregada.ok, true, entregada.error);
  assert.equal(entregada.orden.estado, 'entregada');
  assert.ok(entregada.orden.entregaMs > 0);

  const pagoExtra = ctx.registrarPago(token, orden.id, { metodo: 'efectivo', monto: 1 });
  assert.equal(pagoExtra.ok, false);
  assert.match(pagoExtra.error, /ya está paga/);
});

test('cancelarOrden exige motivo y bloquea órdenes con pagos', () => {
  const { ctx } = nuevoBackend();
  const token = login(ctx, 'staff');

  const a = crear(ctx, token);
  assert.equal(ctx.cancelarOrden(token, a.id, '').ok, false);
  assert.equal(ctx.cancelarOrden(token, a.id, 'x').ok, false);
  const cancelada = ctx.cancelarOrden(token, a.id, 'Ropa mojada');
  assert.equal(cancelada.ok, true, cancelada.error);
  assert.equal(cancelada.orden.estado, 'cancelada');
  assert.equal(cancelada.orden.puedeCancelar, false);

  const b = crear(ctx, token, { nombre: 'Con Pago', telefono: '70002222' });
  ctx.registrarPago(token, b.id, { metodo: 'efectivo', monto: 5 });
  const conPago = ctx.cancelarOrden(token, b.id, 'Prueba');
  assert.equal(conPago.ok, false);
  assert.match(conPago.error, /pagos registrados/);
});

test('retrocederEstado es solo para administración y vuelve un paso', () => {
  const { ctx } = nuevoBackend();
  const admin = login(ctx, 'admin');
  const staff = login(ctx, 'staff');
  const orden = crear(ctx, staff);

  assert.equal(ctx.retrocederEstado(staff, orden.id).ok, false);
  assert.equal(ctx.retrocederEstado(admin, orden.id).ok, false); // ya está en recibida

  const enLavado = avanzarHasta(ctx, admin, orden.id, 'lavado');
  assert.equal(enLavado.estado, 'lavado');
  const atras = ctx.retrocederEstado(admin, orden.id, 'Cargamos mal el peso');
  assert.equal(atras.ok, true, atras.error);
  assert.equal(atras.orden.estado, 'clasificacion');
  assert.match(atras.orden.eventos[atras.orden.eventos.length - 1].nota, /Retroceso manual/);
});

test('notificación arma wa.me, mensaje y registra el aviso', () => {
  const { ctx } = nuevoBackend();
  const token = login(ctx, 'staff');
  const orden = crear(ctx, token);
  avanzarHasta(ctx, token, orden.id, 'lista');

  const noti = ctx.getNotificacion(token, orden.id);
  assert.equal(noti.ok, true, noti.error);
  assert.match(noti.texto, /Juan/);
  assert.match(noti.texto, /L-0001/);
  assert.match(noti.texto, /Bs\. 36,00/);
  assert.match(noti.texto, /\?estado=/);
  assert.ok(noti.waUrl.startsWith('https://wa.me/59171234567?text='));
  assert.equal(noti.yaNotificado, false);

  const marcada = ctx.marcarNotificado(token, orden.id, { canal: 'whatsapp' });
  assert.equal(marcada.ok, true, marcada.error);
  assert.equal(marcada.orden.notificado, true);
  assert.equal(marcada.orden.notificaciones.length, 1);
  assert.equal(marcada.orden.notificaciones[0].canal, 'whatsapp');
});

test('getPanel resume activas, listas, sin notificar y saldo pendiente', () => {
  const { ctx } = nuevoBackend();
  const token = login(ctx, 'staff');
  const a = crear(ctx, token);
  const b = crear(ctx, token, { nombre: 'María López', telefono: '76543210' });
  avanzarHasta(ctx, token, a.id, 'lista');

  const panel = ctx.getPanel(token);
  assert.equal(panel.ok, true, panel.error);
  assert.equal(panel.resumen.activas, 2);
  assert.equal(panel.resumen.listas, 1);
  assert.equal(panel.resumen.sinNotificar, 1);
  assert.equal(panel.resumen.saldoPendiente, a.total + b.total);
  assert.equal(panel.ordenes.length, 2);
  assert.equal(panel.estados.length, 8);
});

test('listarOrdenes filtra por estado y texto', () => {
  const { ctx } = nuevoBackend();
  const token = login(ctx, 'staff');
  const a = crear(ctx, token);
  crear(ctx, token, { nombre: 'María López', telefono: '76543210' });
  avanzarHasta(ctx, token, a.id, 'lista');

  assert.equal(ctx.listarOrdenes(token, { estado: 'activas' }).ordenes.length, 2);
  assert.equal(ctx.listarOrdenes(token, { estado: 'lista' }).ordenes.length, 1);
  assert.equal(ctx.listarOrdenes(token, { texto: 'maría' }).ordenes.length, 1);
  assert.equal(ctx.listarOrdenes(token, { texto: 'l-0001' }).ordenes.length, 1);
  assert.equal(ctx.listarOrdenes(token, { texto: '7123' }).ordenes.length, 1);
});

test('catálogo y configuración: solo admin, con validaciones y whitelist', () => {
  const { ctx } = nuevoBackend();
  const admin = login(ctx, 'admin');
  const staff = login(ctx, 'staff');

  assert.equal(ctx.guardarServicioAdmin(staff, { nombre: 'Traje', tipo: 'pieza', precio: 30 }).ok, false);

  const creado = ctx.guardarServicioAdmin(admin, {
    nombre: 'Traje completo', tipo: 'pieza', precio: 30, incluyePlanchado: true, activo: true,
  });
  assert.equal(creado.ok, true, creado.error);
  assert.ok(ctx.getServicios_().some((s) => s.nombre === 'Traje completo'));

  const editado = ctx.guardarServicioAdmin(admin, {
    id: creado.servicio.id, nombre: 'Traje completo', tipo: 'pieza', precio: 35, activo: true,
  });
  assert.equal(editado.servicio.precio, 35);

  // Precio con coma decimal desde la UI.
  const conComa = ctx.guardarServicioAdmin(admin, {
    nombre: 'Cortina gruesa', tipo: 'pieza', precio: '22,50', activo: true,
  });
  assert.equal(conComa.ok, true, conComa.error);
  assert.equal(conComa.servicio.precio, 22.5);

  const apagado = ctx.cambiarServicioActivoAdmin(admin, creado.servicio.id, false);
  assert.equal(apagado.servicio.activo, false);

  const colorMalo = ctx.guardarConfigAdmin(admin, { color_primario: 'red; background:url(x)' });
  assert.equal(colorMalo.ok, false);
  assert.match(colorMalo.error, /hexadecimales/);

  const guardado = ctx.guardarConfigAdmin(admin, {
    negocio_nombre: 'Lavandería Sol',
    negocio_whatsapp: '+591 7001-2345',
    negocio_telefono: '',
    dias_cerrados: '',
    color_primario: '#123456',
    zona_horaria: 'UTC',
  });
  assert.equal(guardado.ok, true, guardado.error);
  const cfg = ctx.getConfig_();
  assert.equal(cfg.negocio_nombre, 'Lavandería Sol');
  assert.equal(cfg.negocio_whatsapp, '70012345'); // normalizado
  assert.equal(cfg.negocio_telefono, '');
  assert.equal(cfg.dias_cerrados, ''); // abierto todos los días
  assert.equal(cfg.color_primario, '#123456');
  assert.equal(cfg.zona_horaria, ZONA); // no editable
});

test('getReportes suma facturación, cobros y excluye canceladas', () => {
  const { ctx } = nuevoBackend();
  const admin = login(ctx, 'admin');
  const hoy = ctx.hoyISO_(ZONA);

  const orden = crear(ctx, admin);
  ctx.registrarPago(admin, orden.id, { metodo: 'efectivo', monto: 36 });
  avanzarHasta(ctx, admin, orden.id, 'lista');
  ctx.avanzarEstado(admin, orden.id, 'entregada', '');

  const cancelada = crear(ctx, admin, { nombre: 'Cancelada', telefono: '70003333' });
  ctx.cancelarOrden(admin, cancelada.id, 'No volvió');

  const reporte = ctx.getReportes(admin, hoy, hoy);
  assert.equal(reporte.ok, true, reporte.error);
  assert.equal(reporte.kpis.ordenes, 1);
  assert.equal(reporte.kpis.facturado, 36);
  assert.equal(reporte.kpis.entregadas, 1);
  assert.equal(reporte.cobradoEnRango, 36);
  assert.equal(reporte.porMetodo.find((m) => m.metodo === 'efectivo').monto, 36);
  assert.equal(reporte.porDia.length, 1);
  assert.equal(reporte.porDia[0].ordenes, 1);

  assert.equal(ctx.getReportes(login(ctx, 'staff'), hoy, hoy).ok, false);
  assert.equal(ctx.getReportes(admin, '2026-02-01', '2026-01-01').ok, false);
});

test('sembrarDemo carga 8 órdenes en distintos estados y no duplica', () => {
  const { ctx } = nuevoBackend();
  const primera = ctx.sembrarDemo();
  assert.equal(primera.ok, true);
  assert.equal(primera.ordenesCreadas, 8);

  const admin = login(ctx, 'admin');
  const panel = ctx.getPanel(admin);
  assert.equal(panel.ordenes.length, 8);
  assert.equal(panel.resumen.entregadasHoy, 1);
  assert.equal(panel.resumen.listas, 2);
  assert.equal(panel.resumen.sinNotificar, 1);
  assert.ok(panel.resumen.saldoPendiente > 0);

  const entregada = panel.ordenes.find((o) => o.estado === 'entregada');
  const detalle = ctx.getOrden(admin, entregada.id);
  assert.equal(detalle.ok, true);
  assert.equal(detalle.orden.pagoEstado, 'pagado');
  assert.equal(detalle.orden.notificado, true);

  const segunda = ctx.sembrarDemo();
  assert.equal(segunda.ordenesCreadas, undefined);
  assert.match(segunda.mensaje, /Ya existen órdenes/);
});

test('setup crea la hoja Notificaciones y conserva datos existentes', () => {
  const { ctx, hojas } = cargarBackend({
    hojas: {
      Config: [['clave', 'valor'], ['negocio_nombre', 'Mi Lavandería']],
      Servicios: [['id', 'nombre', 'tipo', 'categoria', 'precio', 'incluye_planchado', 'activo', 'orden', 'descripcion']],
    },
  });
  const res = ctx.setup();
  assert.ok(res.hojasCreadas.includes('Ordenes'));
  assert.ok(res.hojasCreadas.includes('Notificaciones'));
  assert.equal(ctx.getConfig_().negocio_nombre, 'Mi Lavandería');
  assert.equal(hojas.get('Servicios').__data.length, 8);
});
