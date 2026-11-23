/**
 * ============================================================================
 * LAVANDERÍA DEMO — Operaciones
 * Precios, órdenes, estados de producción, pagos, notificaciones, estado
 * público y reportes. Comparte los globales de Codigo.js.
 * ============================================================================
 */

var ESTADOS_ORDEN = [
  { id: 'recibida', label: 'Recibida' },
  { id: 'clasificacion', label: 'Clasificación' },
  { id: 'lavado', label: 'Lavado' },
  { id: 'secado', label: 'Secado' },
  { id: 'planchado', label: 'Planchado' },
  { id: 'empaquetado', label: 'Empaquetado' },
  { id: 'lista', label: 'Lista' },
  { id: 'entregada', label: 'Entregada' }
];

var ESTADOS_LABEL = {
  recibida: 'Recibida',
  clasificacion: 'Clasificación',
  lavado: 'Lavado',
  secado: 'Secado',
  planchado: 'Planchado',
  empaquetado: 'Empaquetado',
  lista: 'Lista para retirar',
  entregada: 'Entregada',
  cancelada: 'Cancelada'
};

var TRANSICIONES = {
  recibida: ['clasificacion', 'cancelada'],
  clasificacion: ['lavado', 'cancelada'],
  lavado: ['secado'],
  secado: ['planchado', 'empaquetado'],
  planchado: ['empaquetado'],
  empaquetado: ['lista'],
  lista: ['entregada'],
  entregada: [],
  cancelada: []
};

var DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// ----------------------------------------------------------------------------
// PRECIOS
// ----------------------------------------------------------------------------

function formatoKg_(n) {
  var v = Math.round(Number(n) * 10) / 10;
  return String(v).replace('.', ',') + ' kg';
}

/**
 * Calcula las líneas y totales de una orden. Función pura: recibe el servicio
 * principal ya resuelto y los especiales como [{servicio, cantidad}].
 * Los precios quedan congelados en cada línea (snapshot).
 */
function calcularTotales_(opciones) {
  var o = opciones || {};
  var cfg = o.cfg || {};
  var servicio = o.servicio;

  if (!servicio || servicio.tipo !== 'kg') {
    throw new Error('El servicio principal debe cobrarse por kilo.');
  }
  var peso = Number(o.pesoKg);
  if (!isFinite(peso) || peso <= 0) throw new Error('Ingresá un peso mayor a 0.');
  if (peso > 200) throw new Error('El peso máximo por orden es 200 kg.');

  var minimo = Number(cfg.minimo_kg) || 0;
  var pesoCobrado = minimo > 0 ? Math.max(peso, minimo) : peso;
  var lineas = [];

  lineas.push({
    tipo: 'general_kg',
    descripcion: servicio.nombre + ' · ' + formatoKg_(peso) +
      (pesoCobrado > peso + 0.0001 ? ' (mínimo ' + formatoKg_(minimo) + ')' : ''),
    cantidad: redondear2_(pesoCobrado),
    precio_unitario: redondear2_(servicio.precio),
    subtotal: redondear2_(pesoCobrado * servicio.precio)
  });

  (o.especiales || []).forEach(function (item) {
    var s = item && item.servicio;
    if (!s) return;
    if (s.tipo !== 'pieza') throw new Error('Los artículos especiales se cobran por pieza.');
    var cantidad = Math.floor(Number(item.cantidad) || 0);
    if (cantidad <= 0) return;
    if (cantidad > 50) throw new Error('Máximo 50 piezas por artículo especial.');
    lineas.push({
      tipo: 'especial_pieza',
      descripcion: s.nombre,
      cantidad: cantidad,
      precio_unitario: redondear2_(s.precio),
      subtotal: redondear2_(cantidad * s.precio)
    });
  });

  var planchadoExtra = Math.floor(Number(o.planchadoExtra) || 0);
  if (planchadoExtra > 0) {
    var precioPlanchado = Number(cfg.precio_planchado_pieza) || 0;
    if (precioPlanchado <= 0) throw new Error('Configurá el precio de planchado extra por pieza.');
    if (planchadoExtra > 100) throw new Error('Máximo 100 piezas de planchado extra.');
    lineas.push({
      tipo: 'planchado_pieza',
      descripcion: 'Planchado extra por pieza',
      cantidad: planchadoExtra,
      precio_unitario: redondear2_(precioPlanchado),
      subtotal: redondear2_(planchadoExtra * precioPlanchado)
    });
  }

  var recargo = 0;
  if (o.express) {
    recargo = redondear2_(Math.max(0, Number(cfg.recargo_express) || 0));
    if (recargo > 0) {
      lineas.push({
        tipo: 'recargo',
        descripcion: 'Servicio express',
        cantidad: 1,
        precio_unitario: recargo,
        subtotal: recargo
      });
    }
  }

  var subtotal = redondear2_(lineas.reduce(function (suma, l) { return suma + l.subtotal; }, 0));
  var descuento = redondear2_(Math.max(0, Number(o.descuento) || 0));
  if (descuento > subtotal) throw new Error('El descuento no puede superar el subtotal.');

  if (descuento > 0) {
    lineas.push({
      tipo: 'descuento',
      descripcion: 'Descuento',
      cantidad: 1,
      precio_unitario: -descuento,
      subtotal: -descuento
    });
  }

  return {
    lineas: lineas,
    subtotal: subtotal,
    descuento: descuento,
    recargo: recargo,
    total: redondear2_(subtotal - descuento),
    pesoCobrado: redondear2_(pesoCobrado),
    incluyePlanchado: !!servicio.incluyePlanchado || planchadoExtra > 0
  };
}

// ----------------------------------------------------------------------------
// ESTADOS
// ----------------------------------------------------------------------------

function transicionesPermitidas_(orden) {
  if (!orden || !orden.estado) return [];
  if (orden.estado === 'secado' && !orden.incluyePlanchado) return ['empaquetado'];
  return (TRANSICIONES[orden.estado] || []).slice();
}

function siguienteEstadoSugerido_(orden) {
  var permitidas = transicionesPermitidas_(orden).filter(function (e) { return e !== 'cancelada'; });
  if (!permitidas.length) return '';
  if (orden.estado === 'secado') {
    return orden.incluyePlanchado && permitidas.indexOf('planchado') > -1 ? 'planchado' : 'empaquetado';
  }
  return permitidas[0];
}

function puedeCancelar_(orden) {
  return !!orden && (orden.estado === 'recibida' || orden.estado === 'clasificacion');
}

function ordenBasico_(fila) {
  return {
    id: Number(fila.id),
    estado: String(fila.estado || ''),
    incluyePlanchado: parseBool_(fila.incluye_planchado)
  };
}

// ----------------------------------------------------------------------------
// CREACIÓN DE ÓRDENES
// ----------------------------------------------------------------------------

function ordenPorId_(id) {
  var n = Number(id);
  var fila = readSheetAsObjects_(SHEET_NAMES.ORDENES).filter(function (f) { return Number(f.id) === n; })[0];
  if (!fila) throw new Error('Orden inexistente.');
  return fila;
}

function ordenPorToken_(token) {
  var t = String(token || '').trim();
  if (!t) return null;
  return readSheetAsObjects_(SHEET_NAMES.ORDENES)
    .filter(function (f) { return String(f.token || '') === t; })[0] || null;
}

function lineasDeOrden_(id) {
  return readSheetAsObjects_(SHEET_NAMES.LINEAS)
    .filter(function (l) { return Number(l.orden_id) === Number(id); });
}

function eventosDeOrden_(id) {
  return readSheetAsObjects_(SHEET_NAMES.EVENTOS)
    .filter(function (e) { return Number(e.orden_id) === Number(id); });
}

function pagosDeOrden_(id) {
  return readSheetAsObjects_(SHEET_NAMES.PAGOS)
    .filter(function (p) { return Number(p.orden_id) === Number(id); });
}

function notificacionesDeOrden_(id) {
  return readSheetAsObjects_(SHEET_NAMES.NOTIFICACIONES)
    .filter(function (n) { return Number(n.orden_id) === Number(id); });
}

function registrarEvento_(ordenId, tipo, estado, usuario, nota) {
  escribirFilaPorEncabezado_(SHEET_NAMES.EVENTOS, {
    id: obtenerSiguienteId_(SHEET_NAMES.EVENTOS),
    orden_id: Number(ordenId),
    tipo: tipo,
    estado: estado || '',
    fecha: new Date(),
    usuario: usuario || '',
    nota: nota || ''
  });
}

/**
 * Valida los datos del formulario y resuelve catálogo + precios.
 * Devuelve todo listo para escribir la orden.
 */
function prepararOrden_(datos, cfg) {
  var d = datos || {};
  var zona = zonaHoraria_(cfg);

  var nombre = limpiarTexto_(d.nombre, 60);
  if (nombre.length < 2) throw new Error('Ingresá el nombre del cliente.');

  var telefono = normalizarTelefono_(d.telefono);
  if (!telefonoValido_(telefono)) {
    throw new Error('Ingresá un celular boliviano válido: 8 dígitos, empieza en 6 o 7.');
  }

  var principal = getServicio_(d.servicioId);
  if (!principal.activo) throw new Error('El servicio "' + principal.nombre + '" no está disponible.');
  if (principal.tipo !== 'kg') throw new Error('Elegí un servicio por kilo como base de la orden.');

  var especiales = [];
  var vistos = {};
  (Array.isArray(d.especiales) ? d.especiales : []).forEach(function (item) {
    var s = getServicio_(item && item.servicioId);
    if (!s.activo) throw new Error('El artículo "' + s.nombre + '" no está disponible.');
    if (s.tipo !== 'pieza') throw new Error('Los artículos especiales se cobran por pieza.');
    var cantidad = Math.floor(Number(item.cantidad) || 0);
    if (cantidad <= 0) return;
    if (vistos[s.id]) {
      vistos[s.id].cantidad += cantidad;
    } else {
      vistos[s.id] = { servicio: s, cantidad: cantidad };
      especiales.push(vistos[s.id]);
    }
  });

  var peso = Number(String(d.pesoKg == null ? '' : d.pesoKg).replace(',', '.'));
  if (!isFinite(peso) || peso <= 0) throw new Error('Ingresá el peso de la ropa en kilos.');

  var prendas = Math.floor(Number(d.prendas) || 0);
  if (prendas < 0 || prendas > 500) throw new Error('La cantidad de prendas debe estar entre 0 y 500.');

  var totales = calcularTotales_({
    servicio: principal,
    pesoKg: peso,
    especiales: especiales,
    planchadoExtra: d.planchadoExtra,
    express: !!d.express,
    descuento: d.descuento,
    cfg: cfg
  });

  var hoy = hoyISO_(zona);
  var dias = Number(cfg.dias_entrega_lavado) || 0;
  if (d.express) dias = Number(cfg.dias_entrega_express) || 0;
  else if (totales.incluyePlanchado) dias = Number(cfg.dias_entrega_planchado) || 0;
  var fechaPrometida = calcularFechaPrometida_(hoy, dias, cfg);

  if (d.fechaPrometida) {
    var fp = String(d.fechaPrometida).trim();
    if (!esFechaISO_(fp)) throw new Error('La fecha prometida no es válida.');
    if (fp < hoy) throw new Error('La fecha prometida no puede ser anterior a hoy.');
    if (fp > sumarDiasISO_(hoy, 30)) throw new Error('La fecha prometida no puede superar los 30 días.');
    fechaPrometida = fp;
  }

  return {
    nombre: nombre,
    telefono: telefono,
    principal: principal,
    especiales: especiales,
    prendas: prendas,
    pesoKg: redondear2_(peso),
    totales: totales,
    fechaPrometida: fechaPrometida,
    observaciones: limpiarTexto_(d.observaciones, 300),
    express: !!d.express
  };
}

/** Crea la orden sin validar sesión (la usan el panel y el seed de demo). */
function crearOrdenInterna_(datos, usuario) {
  var cfg = getConfig_();
  var p = prepararOrden_(datos, cfg);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var clienteId = upsertCliente_(p.nombre, p.telefono);
    var id = obtenerSiguienteId_(SHEET_NAMES.ORDENES);
    var codigo = generarCodigoOrden_(id);
    var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 24);

    escribirFilaPorEncabezado_(SHEET_NAMES.ORDENES, {
      id: id,
      codigo: codigo,
      token: token,
      cliente_id: clienteId,
      cliente_nombre: p.nombre,
      cliente_telefono: p.telefono,
      estado: 'recibida',
      servicio_id: p.principal.id,
      servicio_nombre: p.principal.nombre,
      incluye_planchado: p.totales.incluyePlanchado,
      peso_kg: p.pesoKg,
      peso_cobrado: p.totales.pesoCobrado,
      prendas: p.prendas,
      total: p.totales.total,
      descuento: p.totales.descuento,
      recargo: p.totales.recargo,
      total_pagado: 0,
      pago_estado: 'pendiente',
      fecha_recepcion: new Date(),
      fecha_prometida: fechaDesdeISO_(p.fechaPrometida, zonaHoraria_(cfg)),
      fecha_entrega: '',
      notificado: false,
      fecha_notificacion: '',
      observaciones: p.observaciones,
      creado_por: usuario || 'staff'
    });

    p.totales.lineas.forEach(function (l) {
      escribirFilaPorEncabezado_(SHEET_NAMES.LINEAS, {
        orden_id: id,
        tipo: l.tipo,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal: l.subtotal
      });
    });

    registrarEvento_(id, 'estado', 'recibida', usuario || 'staff', 'Orden creada');

    return { id: id, codigo: codigo, token: token };
  } finally {
    lock.releaseLock();
  }
}

function crearOrden(token, datos) {
  return conSesion_(token, ['admin', 'staff'], function (ses) {
    var creada = crearOrdenInterna_(datos, ses.rol);
    return { orden: obtenerOrden_(creada.id) };
  });
}

// ----------------------------------------------------------------------------
// LECTURA Y LISTADO
// ----------------------------------------------------------------------------

function resumenOrden_(fila, cfg) {
  var total = redondear2_(Number(fila.total) || 0);
  var pagado = redondear2_(Number(fila.total_pagado) || 0);
  var saldo = redondear2_(total - pagado);
  return {
    id: Number(fila.id),
    codigo: String(fila.codigo || ''),
    estado: String(fila.estado || ''),
    estadoLabel: ESTADOS_LABEL[fila.estado] || String(fila.estado || ''),
    clienteNombre: String(fila.cliente_nombre || ''),
    clienteTelefono: normalizarTelefono_(fila.cliente_telefono),
    prendas: Number(fila.prendas) || 0,
    pesoKg: Number(fila.peso_kg) || 0,
    servicioNombre: String(fila.servicio_nombre || ''),
    incluyePlanchado: parseBool_(fila.incluye_planchado),
    total: total,
    pagado: pagado,
    saldo: saldo,
    pagoEstado: String(fila.pago_estado || 'pendiente'),
    notificado: parseBool_(fila.notificado),
    fechaPrometida: fechaISODeCelda_(fila.fecha_prometida, zonaHoraria_(cfg)),
    recepcionMs: fechaMs_(fila.fecha_recepcion),
    entregaMs: fechaMs_(fila.fecha_entrega)
  };
}

function filtrarOrdenes_(filtros) {
  var cfg = getConfig_();
  var zona = zonaHoraria_(cfg);
  var f = filtros || {};
  var estado = String(f.estado || 'todas');
  var texto = String(f.texto || '').trim().toLowerCase();
  var tel = normalizarTelefono_(texto);
  var limite = Math.min(Math.max(Number(f.limite) || 100, 1), 300);

  var filas = readSheetAsObjects_(SHEET_NAMES.ORDENES).filter(function (fila) {
    var est = String(fila.estado || '');
    if (estado === 'activas') {
      if (est === 'entregada' || est === 'cancelada') return false;
    } else if (estado !== 'todas' && est !== estado) {
      return false;
    }

    if (texto) {
      var nombre = String(fila.cliente_nombre || '').toLowerCase();
      var codigo = String(fila.codigo || '').toLowerCase();
      var telefono = normalizarTelefono_(fila.cliente_telefono);
      var coincide = nombre.indexOf(texto) > -1 || codigo.indexOf(texto) > -1;
      if (!coincide && tel && telefono.indexOf(tel) > -1) coincide = true;
      if (!coincide) return false;
    }

    if (f.desde || f.hasta) {
      var iso = fechaISODeCelda_(fila.fecha_recepcion, zona);
      if (f.desde && iso < String(f.desde)) return false;
      if (f.hasta && iso > String(f.hasta)) return false;
    }

    return true;
  });

  filas.sort(function (a, b) {
    return fechaMs_(b.fecha_recepcion) - fechaMs_(a.fecha_recepcion);
  });

  return {
    total: filas.length,
    ordenes: filas.slice(0, limite).map(function (fila) { return resumenOrden_(fila, cfg); })
  };
}

function listarOrdenes(token, filtros) {
  return conSesion_(token, ['admin', 'staff'], function () {
    return filtrarOrdenes_(filtros);
  });
}

function getPanel(token) {
  return conSesion_(token, ['admin', 'staff'], function () {
    var cfg = getConfig_();
    var zona = zonaHoraria_(cfg);
    var hoy = hoyISO_(zona);
    var filas = readSheetAsObjects_(SHEET_NAMES.ORDENES);

    var resumen = {
      recibidasHoy: 0,
      activas: 0,
      listas: 0,
      sinNotificar: 0,
      entregadasHoy: 0,
      saldoPendiente: 0,
      prendasEnProceso: 0,
      porEstado: {}
    };

    ESTADOS_ORDEN.forEach(function (e) { resumen.porEstado[e.id] = 0; });

    var visibles = [];
    filas.forEach(function (fila) {
      var orden = resumenOrden_(fila, cfg);
      if (orden.estado === 'cancelada') return;

      resumen.porEstado[orden.estado] = (resumen.porEstado[orden.estado] || 0) + 1;

      if (fechaISODeCelda_(fila.fecha_recepcion, zona) === hoy) resumen.recibidasHoy++;
      if (orden.estado === 'entregada') {
        if (fechaISODeCelda_(fila.fecha_entrega, zona) === hoy) {
          resumen.entregadasHoy++;
          visibles.push(orden);
        }
        return;
      }

      resumen.activas++;
      resumen.prendasEnProceso += orden.prendas;
      resumen.saldoPendiente = redondear2_(resumen.saldoPendiente + orden.saldo);
      if (orden.estado === 'lista') resumen.listas++;
      if (orden.estado === 'lista' && !orden.notificado) resumen.sinNotificar++;
      visibles.push(orden);
    });

    visibles.sort(function (a, b) { return a.recepcionMs - b.recepcionMs; });

    return {
      resumen: resumen,
      ordenes: visibles,
      estados: ESTADOS_ORDEN,
      hoy: hoy
    };
  });
}

/** Detalle completo de una orden. Uso interno (sin validar sesión). */
function obtenerOrden_(id) {
  var cfg = getConfig_();
  var zona = zonaHoraria_(cfg);
  var fila = ordenPorId_(id);

  var lineas = lineasDeOrden_(id).map(function (l) {
    return {
      tipo: String(l.tipo || ''),
      descripcion: String(l.descripcion || ''),
      cantidad: Number(l.cantidad) || 0,
      precioUnitario: Number(l.precio_unitario) || 0,
      subtotal: Number(l.subtotal) || 0
    };
  });

  var eventos = ordenarPorFecha_(eventosDeOrden_(id)).map(function (e) {
    return {
      tipo: String(e.tipo || ''),
      estado: String(e.estado || ''),
      estadoLabel: ESTADOS_LABEL[e.estado] || String(e.estado || ''),
      fechaMs: fechaMs_(e.fecha),
      usuario: String(e.usuario || ''),
      nota: String(e.nota || '')
    };
  });

  var pagos = ordenarPorFecha_(pagosDeOrden_(id)).map(function (p) {
    return {
      metodo: String(p.metodo || ''),
      metodoLabel: p.metodo === 'qr' ? 'QR' : 'Efectivo',
      monto: Number(p.monto) || 0,
      fechaMs: fechaMs_(p.fecha),
      usuario: String(p.registrado_por || ''),
      nota: String(p.nota || '')
    };
  });

  var notificaciones = ordenarPorFecha_(notificacionesDeOrden_(id)).map(function (n) {
    return {
      canal: String(n.canal || ''),
      destino: String(n.destino || ''),
      fechaMs: fechaMs_(n.fecha),
      usuario: String(n.usuario || ''),
      nota: String(n.nota || '')
    };
  });

  var resumen = resumenOrden_(fila, cfg);
  var basico = ordenBasico_(fila);

  return {
    id: resumen.id,
    codigo: resumen.codigo,
    token: String(fila.token || ''),
    linkEstado: linkEstado_(fila.token),
    estado: resumen.estado,
    estadoLabel: resumen.estadoLabel,
    estadoDescripcion: descripcionEstado_(resumen.estado),
    cliente: {
      id: Number(fila.cliente_id) || 0,
      nombre: String(fila.cliente_nombre || ''),
      telefono: normalizarTelefono_(fila.cliente_telefono),
      telefonoBonito: formatearTelefono_(fila.cliente_telefono)
    },
    servicioNombre: resumen.servicioNombre,
    incluyePlanchado: resumen.incluyePlanchado,
    pesoKg: resumen.pesoKg,
    pesoCobrado: Number(fila.peso_cobrado) || 0,
    prendas: resumen.prendas,
    observaciones: String(fila.observaciones || ''),
    lineas: lineas,
    subtotal: redondear2_(lineas.reduce(function (s, l) { return s + l.subtotal; }, 0)),
    total: resumen.total,
    pagado: resumen.pagado,
    saldo: resumen.saldo,
    pagoEstado: resumen.pagoEstado,
    descuento: Number(fila.descuento) || 0,
    recargo: Number(fila.recargo) || 0,
    fechaPrometida: resumen.fechaPrometida,
    recepcionMs: resumen.recepcionMs,
    entregaMs: resumen.entregaMs,
    notificado: resumen.notificado,
    fechaNotificacionMs: fechaMs_(fila.fecha_notificacion),
    creadoPor: String(fila.creado_por || ''),
    eventos: eventos,
    pagos: pagos,
    notificaciones: notificaciones,
    permitidas: transicionesPermitidas_(basico),
    siguiente: siguienteEstadoSugerido_(basico),
    puedeCancelar: puedeCancelar_(basico),
    puedeEntregar: basico.estado === 'lista' && resumen.saldo <= 0.005,
    puedeNotificar: basico.estado === 'lista'
  };
}

function getOrden(token, id) {
  return conSesion_(token, ['admin', 'staff'], function () {
    return { orden: obtenerOrden_(id) };
  });
}

function ordenarPorFecha_(filas) {
  return filas.slice().sort(function (a, b) { return fechaMs_(a.fecha) - fechaMs_(b.fecha); });
}

function cambiarEstadoInterno_(fila, nuevoEstado, usuario, nota) {
  var datos = { estado: nuevoEstado };
  if (nuevoEstado === 'entregada') datos.fecha_entrega = new Date();
  actualizarFilaPorEncabezado_(SHEET_NAMES.ORDENES, fila.__row, datos);
  registrarEvento_(fila.id, 'estado', nuevoEstado, usuario, nota || '');
}

function avanzarEstado(token, id, nuevoEstado, nota) {
  return conSesion_(token, ['admin', 'staff'], function (ses) {
    var fila = ordenPorId_(id);
    var basico = ordenBasico_(fila);
    var permitidas = transicionesPermitidas_(basico).filter(function (e) { return e !== 'cancelada'; });
    var destino = String(nuevoEstado || siguienteEstadoSugerido_(basico));

    if (!destino) throw new Error('Esta orden ya no tiene pasos pendientes.');
    if (permitidas.indexOf(destino) === -1) {
      throw new Error('No se puede pasar de "' + (ESTADOS_LABEL[basico.estado] || basico.estado) +
        '" a "' + (ESTADOS_LABEL[destino] || destino) + '".');
    }

    if (destino === 'entregada') {
      var total = Number(fila.total) || 0;
      var pagado = Number(fila.total_pagado) || 0;
      if (redondear2_(total - pagado) > 0.005) {
        throw new Error('Antes de entregar, registrá el pago completo. Saldo: ' + formatearMonto_(total - pagado, getConfig_()) + '.');
      }
    }

    cambiarEstadoInterno_(fila, destino, ses.rol, limpiarTexto_(nota, 200));
    return { orden: obtenerOrden_(id) };
  });
}

var RETROCESOS = {
  clasificacion: 'recibida',
  lavado: 'clasificacion',
  secado: 'lavado',
  planchado: 'secado',
  empaquetado: 'secado',
  lista: 'empaquetado',
  entregada: 'lista'
};

function retrocederEstado(token, id, nota) {
  return conSesion_(token, ['admin'], function (ses) {
    var fila = ordenPorId_(id);
    var basico = ordenBasico_(fila);
    if (basico.estado === 'recibida') throw new Error('La orden ya está en el primer estado.');
    if (basico.estado === 'cancelada') throw new Error('Una orden cancelada no se puede retroceder.');

    var anterior = RETROCESOS[basico.estado];
    if (basico.estado === 'empaquetado' && basico.incluyePlanchado) {
      var tuvoPlanchado = eventosDeOrden_(id).some(function (e) { return e.estado === 'planchado'; });
      if (tuvoPlanchado) anterior = 'planchado';
    }
    if (!anterior) throw new Error('No hay un paso anterior para esta orden.');

    var datos = { estado: anterior };
    if (basico.estado === 'entregada') datos.fecha_entrega = '';
    actualizarFilaPorEncabezado_(SHEET_NAMES.ORDENES, fila.__row, datos);
    registrarEvento_(id, 'estado', anterior, ses.rol,
      'Retroceso manual desde "' + (ESTADOS_LABEL[basico.estado] || basico.estado) + '"' +
      (nota ? ': ' + limpiarTexto_(nota, 160) : ''));

    return { orden: obtenerOrden_(id) };
  });
}

function cancelarOrden(token, id, motivo) {
  return conSesion_(token, ['admin', 'staff'], function (ses) {
    var fila = ordenPorId_(id);
    var basico = ordenBasico_(fila);
    if (!puedeCancelar_(basico)) {
      throw new Error('Solo se puede cancelar una orden antes de empezar el lavado.');
    }
    if ((Number(fila.total_pagado) || 0) > 0.005) {
      throw new Error('La orden tiene pagos registrados. Devolvé el dinero antes de cancelarla.');
    }

    var texto = limpiarTexto_(motivo, 200);
    if (texto.length < 3) throw new Error('Indicá el motivo de la cancelación.');

    actualizarFilaPorEncabezado_(SHEET_NAMES.ORDENES, fila.__row, { estado: 'cancelada' });
    registrarEvento_(id, 'estado', 'cancelada', ses.rol, 'Cancelada: ' + texto);
    return { orden: obtenerOrden_(id) };
  });
}

// ----------------------------------------------------------------------------
// PAGOS
// ----------------------------------------------------------------------------

function recalcularPagoOrden_(fila, cfg) {
  var pagado = redondear2_(pagosDeOrden_(fila.id).reduce(function (s, p) {
    return s + (Number(p.monto) || 0);
  }, 0));
  var total = redondear2_(Number(fila.total) || 0);
  var estado = pagado <= 0.005 ? 'pendiente' : (pagado >= total - 0.005 ? 'pagado' : 'parcial');
  actualizarFilaPorEncabezado_(SHEET_NAMES.ORDENES, fila.__row, {
    total_pagado: pagado,
    pago_estado: estado
  });
  return { pagado: pagado, estado: estado };
}

function registrarPagoInterno_(ordenId, datos, usuario) {
  var cfg = getConfig_();
  var fila = ordenPorId_(ordenId);
  if (fila.estado === 'cancelada') throw new Error('No se pueden registrar pagos de una orden cancelada.');

  var total = redondear2_(Number(fila.total) || 0);
  var pagado = redondear2_(Number(fila.total_pagado) || 0);
  var saldo = redondear2_(total - pagado);
  if (saldo <= 0.005) throw new Error('La orden ya está paga.');

  var monto = redondear2_(Number(String(datos && datos.monto != null ? datos.monto : '').replace(',', '.')));
  if (!isFinite(monto) || monto <= 0) throw new Error('Ingresá un monto mayor a 0.');
  if (monto > saldo + 0.005) {
    throw new Error('El monto supera el saldo pendiente (' + formatearMonto_(saldo, cfg) + ').');
  }

  var metodo = datos && datos.metodo === 'qr' ? 'qr' : 'efectivo';

  escribirFilaPorEncabezado_(SHEET_NAMES.PAGOS, {
    id: obtenerSiguienteId_(SHEET_NAMES.PAGOS),
    orden_id: Number(ordenId),
    metodo: metodo,
    monto: monto,
    fecha: new Date(),
    registrado_por: usuario || '',
    nota: limpiarTexto_(datos && datos.nota, 160)
  });

  registrarEvento_(ordenId, 'pago', fila.estado, usuario || '',
    (metodo === 'qr' ? 'Pago QR' : 'Pago efectivo') + ': ' + formatearMonto_(monto, cfg));

  var resultado = recalcularPagoOrden_(fila, cfg);
  return { pagado: resultado.pagado, pagoEstado: resultado.estado, saldo: redondear2_(total - resultado.pagado) };
}

function registrarPago(token, id, datos) {
  return conSesion_(token, ['admin', 'staff'], function (ses) {
    registrarPagoInterno_(id, datos, ses.rol);
    return { orden: obtenerOrden_(id) };
  });
}

// ----------------------------------------------------------------------------
// NOTIFICACIONES (wa.me, sin API de WhatsApp)
// ----------------------------------------------------------------------------

function primerNombre_(nombre) {
  var partes = String(nombre || '').trim().split(/\s+/);
  return partes[0] || 'cliente';
}

function fechaBonita_(iso, zona) {
  if (!esFechaISO_(iso)) return '';
  var p = partesISO_(iso);
  var d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  return DIAS_CORTOS[d.getUTCDay()] + ' ' + String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0');
}

function linkEstado_(token) {
  var base = '';
  try { base = ScriptApp.getService().getUrl() || ''; } catch (err) { base = ''; }
  if (!base) return '(link no disponible)';
  return base + '?estado=' + encodeURIComponent(token);
}

function rellenarPlantilla_(plantilla, datos) {
  var texto = String(plantilla || '');
  Object.keys(datos).forEach(function (clave) {
    texto = texto.split('{' + clave + '}').join(String(datos[clave] == null ? '' : datos[clave]));
  });
  return texto;
}

function construirMensajeWhatsApp_(orden, cfg) {
  var saldo = redondear2_(orden.saldo);
  var pendiente = saldo > 0.005
    ? '💳 Saldo a pagar: ' + formatearMonto_(saldo, cfg) + ' (efectivo o QR)'
    : '✅ Pedido pago. ¡Solo falta que lo retires!';

  var datos = {
    cliente: primerNombre_(orden.cliente.nombre),
    codigo: orden.codigo,
    negocio: cfg.negocio_nombre || 'Lavandería Demo',
    total: formatearMonto_(orden.total, cfg),
    saldo: formatearMonto_(saldo, cfg),
    pendiente: pendiente,
    prendas: orden.prendas > 0
      ? orden.prendas + (orden.prendas === 1 ? ' prenda' : ' prendas')
      : formatoKg_(orden.pesoKg),
    peso: formatoKg_(orden.pesoKg),
    link: linkEstado_(orden.token),
    direccion: cfg.negocio_direccion || '',
    horario: (cfg.horario_apertura || '08:00') + ' a ' + (cfg.horario_cierre || '20:00'),
    fecha_prometida: fechaBonita_(orden.fechaPrometida, zonaHoraria_(cfg))
  };

  return rellenarPlantilla_(cfg.whatsapp_plantilla || CONFIG_DEFAULT.whatsapp_plantilla, datos);
}

function getNotificacion(token, id) {
  return conSesion_(token, ['admin', 'staff'], function () {
    var cfg = getConfig_();
    var orden = obtenerOrden_(id);
    var texto = construirMensajeWhatsApp_(orden, cfg);
    var wa = telefonoWhatsapp_(orden.cliente.telefono);
    return {
      texto: texto,
      telefono: orden.cliente.telefono,
      telefonoBonito: orden.cliente.telefonoBonito,
      waUrl: wa ? 'https://wa.me/' + wa + '?text=' + encodeURIComponent(texto) : '',
      linkEstado: linkEstado_(orden.token),
      yaNotificado: orden.notificado,
      fechaNotificacionMs: orden.fechaNotificacionMs
    };
  });
}

function marcarNotificadoInterno_(ordenId, datos, usuario) {
  var fila = ordenPorId_(ordenId);
  var destino = normalizarTelefono_(datos && datos.destino) || normalizarTelefono_(fila.cliente_telefono);
  var canal = String((datos && datos.canal) || 'whatsapp');
  if (['whatsapp', 'copiar', 'manual'].indexOf(canal) === -1) canal = 'whatsapp';

  escribirFilaPorEncabezado_(SHEET_NAMES.NOTIFICACIONES, {
    id: obtenerSiguienteId_(SHEET_NAMES.NOTIFICACIONES),
    orden_id: Number(ordenId),
    canal: canal,
    destino: destino,
    fecha: new Date(),
    usuario: usuario || '',
    nota: limpiarTexto_(datos && datos.nota, 160)
  });

  actualizarFilaPorEncabezado_(SHEET_NAMES.ORDENES, fila.__row, {
    notificado: true,
    fecha_notificacion: new Date()
  });
  registrarEvento_(ordenId, 'notificacion', fila.estado, usuario || '',
    'Aviso enviado por ' + canal);
}

function marcarNotificado(token, id, datos) {
  return conSesion_(token, ['admin', 'staff'], function (ses) {
    marcarNotificadoInterno_(id, datos || {}, ses.rol);
    return { orden: obtenerOrden_(id) };
  });
}

// ----------------------------------------------------------------------------
// ESTADO PÚBLICO
// ----------------------------------------------------------------------------

function descripcionEstado_(estado) {
  var textos = {
    recibida: 'Recibimos tu ropa y ya registramos el pedido.',
    clasificacion: 'Estamos separando y clasificando cada prenda.',
    lavado: 'Tu ropa está en lavado.',
    secado: 'Tu ropa se está secando.',
    planchado: 'Estamos planchando tus prendas.',
    empaquetado: 'Estamos embolsando y etiquetando tu pedido.',
    lista: '¡Tu pedido está listo para retirar!',
    entregada: 'Pedido entregado. ¡Gracias por confiar en nosotros!',
    cancelada: 'Este pedido fue cancelado. Escribinos si tenés dudas.'
  };
  return textos[estado] || '';
}

function pasosPublicos_(orden) {
  var pasos = ESTADOS_ORDEN.filter(function (p) {
    return p.id !== 'planchado' || orden.incluyePlanchado;
  });
  var idx = -1;
  pasos.forEach(function (p, i) { if (p.id === orden.estado) idx = i; });
  var entregada = orden.estado === 'entregada';

  return pasos.map(function (p, i) {
    return {
      id: p.id,
      label: p.label,
      hecho: entregada || (idx > -1 && i < idx),
      actual: p.id === orden.estado
    };
  });
}

function sanitizarOrdenPublica_(orden, cfg) {
  return {
    codigo: orden.codigo,
    cliente: primerNombre_(orden.cliente.nombre),
    estado: orden.estado,
    estadoLabel: orden.estadoLabel,
    estadoDescripcion: orden.estadoDescripcion,
    pasos: pasosPublicos_(orden),
    fechaPrometida: orden.fechaPrometida,
    fechaPrometidaBonita: fechaBonita_(orden.fechaPrometida, zonaHoraria_(cfg)),
    entregaMs: orden.entregaMs,
    prendas: orden.prendas,
    pesoKg: orden.pesoKg,
    incluyePlanchado: orden.incluyePlanchado,
    items: orden.lineas
      .filter(function (l) { return l.tipo === 'general_kg' || l.tipo === 'especial_pieza' || l.tipo === 'planchado_pieza'; })
      .map(function (l) {
        return { descripcion: l.descripcion, cantidad: l.cantidad, subtotal: l.subtotal };
      }),
    total: orden.total,
    pagado: orden.pagado,
    saldo: orden.saldo,
    pagoEstado: orden.pagoEstado,
    actualizadoMs: Date.now(),
    negocio: datosNegocio_(cfg)
  };
}

function consultarEstadoPublico(token) {
  try {
    var cfg = getConfig_();
    var fila = ordenPorToken_(token);
    if (!fila) return { ok: false, error: 'No encontramos ese pedido. Revisá el link.' };
    var orden = obtenerOrden_(fila.id);
    return { ok: true, orden: sanitizarOrdenPublica_(orden, cfg) };
  } catch (err) {
    return { ok: false, error: 'No pudimos cargar el estado. Probá de nuevo en un momento.' };
  }
}

function normalizarCodigo_(codigo) {
  var c = String(codigo || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d+$/.test(c)) c = 'L-' + ('0000' + c).slice(-4);
  if (/^L\d+$/.test(c)) c = 'L-' + c.slice(1);
  return c;
}

/**
 * Recupera el link público con código + últimos 4 dígitos del celular.
 * Rate limit por código para evitar enumeración.
 */
function recuperarEstado(codigo, telefono4) {
  var cod = normalizarCodigo_(codigo);
  if (!cod) return { ok: false, error: 'Ingresá el código de la orden.' };

  var cache = CacheService.getScriptCache();
  var clave = 'lav_rec_' + cod;
  var intentos = Number(cache.get(clave) || 0);
  if (intentos >= 10) {
    return { ok: false, error: 'Demasiados intentos para ese código. Esperá unos minutos.' };
  }

  var digitos = String(telefono4 || '').replace(/\D/g, '');
  var fila = readSheetAsObjects_(SHEET_NAMES.ORDENES).filter(function (f) {
    return String(f.codigo || '').toUpperCase() === cod;
  })[0];

  var ok = false;
  if (fila && digitos.length >= 4) {
    var telefono = normalizarTelefono_(fila.cliente_telefono);
    ok = telefono.slice(-4) === digitos.slice(-4);
  }

  if (!ok) {
    cache.put(clave, String(intentos + 1), 600);
    return { ok: false, error: 'No pudimos verificar el pedido. Revisá el código y los últimos 4 dígitos del celular.' };
  }

  cache.remove(clave);
  return { ok: true, token: String(fila.token || '') };
}

// ----------------------------------------------------------------------------
// REPORTES
// ----------------------------------------------------------------------------

function fechasEnRango_(desde, hasta) {
  var out = [];
  var actual = desde;
  var guardia = 0;
  while (actual <= hasta && guardia < 400) {
    out.push(actual);
    actual = sumarDiasISO_(actual, 1);
    guardia++;
  }
  return out;
}

function getReportes(token, desde, hasta) {
  return conSesion_(token, ['admin'], function () {
    var cfg = getConfig_();
    var zona = zonaHoraria_(cfg);
    var hoy = hoyISO_(zona);
    var d = esFechaISO_(desde) ? String(desde) : sumarDiasISO_(hoy, -6);
    var h = esFechaISO_(hasta) ? String(hasta) : hoy;
    if (h < d) throw new Error('La fecha "hasta" no puede ser anterior a "desde".');
    if (h > sumarDiasISO_(d, 92)) throw new Error('El rango máximo es de 92 días.');

    var ordenes = readSheetAsObjects_(SHEET_NAMES.ORDENES);
    var lineas = readSheetAsObjects_(SHEET_NAMES.LINEAS);
    var pagos = readSheetAsObjects_(SHEET_NAMES.PAGOS);

    var ordenesRango = ordenes.filter(function (f) {
      if (f.estado === 'cancelada') return false;
      var iso = fechaISODeCelda_(f.fecha_recepcion, zona);
      return iso >= d && iso <= h;
    });

    var idsRango = {};
    var kpis = {
      ordenes: ordenesRango.length,
      prendas: 0,
      kg: 0,
      facturado: 0,
      ticketPromedio: 0,
      entregadas: 0,
      entregadasMonto: 0
    };

    ordenesRango.forEach(function (f) {
      idsRango[String(f.id)] = true;
      kpis.prendas += Number(f.prendas) || 0;
      kpis.kg = redondear2_(kpis.kg + (Number(f.peso_kg) || 0));
      kpis.facturado = redondear2_(kpis.facturado + (Number(f.total) || 0));
    });
    kpis.ticketPromedio = kpis.ordenes ? redondear2_(kpis.facturado / kpis.ordenes) : 0;

    ordenes.forEach(function (f) {
      if (f.estado !== 'entregada') return;
      var iso = fechaISODeCelda_(f.fecha_entrega, zona);
      if (iso >= d && iso <= h) {
        kpis.entregadas++;
        kpis.entregadasMonto = redondear2_(kpis.entregadasMonto + (Number(f.total) || 0));
      }
    });

    var porMetodoMap = { efectivo: 0, qr: 0 };
    var porDiaMap = {};
    fechasEnRango_(d, h).forEach(function (iso) {
      porDiaMap[iso] = { fecha: iso, monto: 0, ordenes: 0 };
    });

    var pagosRango = pagos.filter(function (p) {
      var iso = fechaISODeCelda_(p.fecha, zona);
      return iso >= d && iso <= h;
    });
    pagosRango.forEach(function (p) {
      var metodo = p.metodo === 'qr' ? 'qr' : 'efectivo';
      porMetodoMap[metodo] = redondear2_(porMetodoMap[metodo] + (Number(p.monto) || 0));
      var iso = fechaISODeCelda_(p.fecha, zona);
      if (porDiaMap[iso]) porDiaMap[iso].monto = redondear2_(porDiaMap[iso].monto + (Number(p.monto) || 0));
    });

    var ordenesPorDia = {};
    ordenesRango.forEach(function (f) {
      var iso = fechaISODeCelda_(f.fecha_recepcion, zona);
      ordenesPorDia[iso] = (ordenesPorDia[iso] || 0) + 1;
    });
    Object.keys(porDiaMap).forEach(function (iso) {
      porDiaMap[iso].ordenes = ordenesPorDia[iso] || 0;
    });

    var porServicioMap = {};
    var ordenesPorId = {};
    ordenes.forEach(function (f) { ordenesPorId[String(f.id)] = f; });

    lineas.forEach(function (l) {
      var f = ordenesPorId[String(l.orden_id)];
      if (!f || !idsRango[String(f.id)]) return;
      if (l.tipo !== 'general_kg' && l.tipo !== 'especial_pieza') return;
      var esGeneral = l.tipo === 'general_kg';
      var nombre = esGeneral ? String(f.servicio_nombre || 'Lavado por kilo') : String(l.descripcion || 'Especial');
      if (!porServicioMap[nombre]) {
        porServicioMap[nombre] = { nombre: nombre, cantidad: 0, monto: 0, unidad: esGeneral ? 'kg' : 'pieza' };
      }
      porServicioMap[nombre].cantidad = redondear2_(porServicioMap[nombre].cantidad + (Number(l.cantidad) || 0));
      porServicioMap[nombre].monto = redondear2_(porServicioMap[nombre].monto + (Number(l.subtotal) || 0));
    });

    var saldoPendiente = 0;
    var activas = 0;
    ordenes.forEach(function (f) {
      if (f.estado === 'entregada' || f.estado === 'cancelada') return;
      activas++;
      saldoPendiente = redondear2_(saldoPendiente +
        ((Number(f.total) || 0) - (Number(f.total_pagado) || 0)));
    });

    var porServicio = Object.keys(porServicioMap).map(function (k) { return porServicioMap[k]; })
      .sort(function (a, b) { return b.monto - a.monto; });

    var porDia = Object.keys(porDiaMap).sort().map(function (k) { return porDiaMap[k]; });

    return {
      desde: d,
      hasta: h,
      kpis: kpis,
      porServicio: porServicio,
      porMetodo: [
        { metodo: 'efectivo', label: 'Efectivo', monto: porMetodoMap.efectivo },
        { metodo: 'qr', label: 'QR', monto: porMetodoMap.qr }
      ],
      porDia: porDia,
      cobradoEnRango: redondear2_(porMetodoMap.efectivo + porMetodoMap.qr),
      saldoPendiente: redondear2_(saldoPendiente),
      ordenesActivas: activas
    };
  });
}

// ----------------------------------------------------------------------------
// DATOS DE EJEMPLO
// ----------------------------------------------------------------------------

var DEMO_ORDENES = [
  { nombre: 'Ana Quispe', telefono: '71234567', servicioId: 1, pesoKg: 4.2, prendas: 12, notas: 'Ropa de trabajo, sin suavizante.', estados: [] },
  { nombre: 'Carlos Mamani', telefono: '67890123', servicioId: 2, pesoKg: 6.8, prendas: 18, estados: ['clasificacion', 'lavado'] },
  { nombre: 'María Flores', telefono: '76543210', servicioId: 2, pesoKg: 3.5, prendas: 9, express: true, especiales: [{ servicioId: 4, cantidad: 1 }], estados: ['clasificacion', 'lavado', 'secado'], pagado: 60, metodo: 'efectivo' },
  { nombre: 'José Rojas', telefono: '70112233', servicioId: 1, pesoKg: 5, prendas: 15, estados: ['clasificacion', 'lavado', 'secado'] },
  { nombre: 'Lucía Vargas', telefono: '73334455', servicioId: 2, pesoKg: 2.6, prendas: 11, especiales: [{ servicioId: 5, cantidad: 1 }], estados: ['clasificacion', 'lavado', 'secado', 'planchado', 'empaquetado'] },
  { nombre: 'Ana Quispe', telefono: '71234567', servicioId: 1, pesoKg: 7.4, prendas: 22, planchadoExtra: 2, estados: ['clasificacion', 'lavado', 'secado', 'empaquetado', 'lista'] },
  { nombre: 'Carlos Mamani', telefono: '67890123', servicioId: 2, pesoKg: 4, prendas: 12, estados: ['clasificacion', 'lavado', 'secado', 'planchado', 'empaquetado', 'lista', 'entregada'], pagadoCompleto: true, metodo: 'efectivo', notificar: true },
  { nombre: 'María Flores', telefono: '76543210', servicioId: 2, pesoKg: 5.1, prendas: 16, especiales: [{ servicioId: 7, cantidad: 2 }], estados: ['clasificacion', 'lavado', 'secado', 'planchado', 'empaquetado', 'lista'], pagadoCompleto: true, metodo: 'qr', notificar: true }
];

function avanzarDemo_(id, estados) {
  estados.forEach(function (estado) {
    var fila = ordenPorId_(id);
    actualizarFilaPorEncabezado_(SHEET_NAMES.ORDENES, fila.__row, {
      estado: estado,
      fecha_entrega: estado === 'entregada' ? new Date() : ''
    });
    registrarEvento_(id, 'estado', estado, 'demo', 'Dato de ejemplo');
  });
}

/**
 * Carga órdenes de ejemplo en distintos estados. Se ejecuta desde el menú de
 * la hoja o desde Configuración. No duplica si ya hay órdenes.
 */
function sembrarDemo() {
  var paso = setup();
  if (hayOrdenes_()) {
    return { ok: true, mensaje: 'Ya existen órdenes cargadas; no se duplicó nada.', setup: paso };
  }

  var creadas = 0;
  DEMO_ORDENES.forEach(function (ejemplo) {
    var creada = crearOrdenInterna_({
      nombre: ejemplo.nombre,
      telefono: ejemplo.telefono,
      servicioId: ejemplo.servicioId,
      pesoKg: ejemplo.pesoKg,
      prendas: ejemplo.prendas,
      especiales: ejemplo.especiales || [],
      planchadoExtra: ejemplo.planchadoExtra || 0,
      express: !!ejemplo.express,
      observaciones: ejemplo.notas || ''
    }, 'demo');

    if (ejemplo.pagado) {
      registrarPagoInterno_(creada.id, {
        metodo: ejemplo.metodo || 'efectivo',
        monto: ejemplo.pagado,
        nota: 'Pago de ejemplo'
      }, 'demo');
    }

    if (ejemplo.pagadoCompleto) {
      var fila = ordenPorId_(creada.id);
      registrarPagoInterno_(creada.id, {
        metodo: ejemplo.metodo || 'efectivo',
        monto: redondear2_((Number(fila.total) || 0) - (Number(fila.total_pagado) || 0)),
        nota: 'Pago de ejemplo'
      }, 'demo');
    }

    avanzarDemo_(creada.id, ejemplo.estados || []);

    if (ejemplo.notificar) {
      marcarNotificadoInterno_(creada.id, { canal: 'whatsapp' }, 'demo');
    }

    creadas++;
  });

  return { ok: true, ordenesCreadas: creadas, mensaje: 'Datos de ejemplo cargados.' };
}

function vaciarHoja_(nombre) {
  var sh = sheet_(nombre);
  while (sh.getLastRow() > 1) sh.deleteRow(2);
}

function cargarDemoAdmin(token) {
  return conSesion_(token, ['admin'], function () {
    var resumen = sembrarDemo();
    return {
      mensaje: resumen.mensaje || 'Datos de ejemplo cargados.',
      ordenesCreadas: resumen.ordenesCreadas || 0
    };
  });
}

function reiniciarDemoAdmin(token) {
  return conSesion_(token, ['admin'], function () {
    [SHEET_NAMES.LINEAS, SHEET_NAMES.EVENTOS, SHEET_NAMES.PAGOS,
     SHEET_NAMES.NOTIFICACIONES, SHEET_NAMES.ORDENES].forEach(vaciarHoja_);
    var resumen = sembrarDemo();
    return { mensaje: resumen.mensaje || 'Demo reiniciada.', ordenesCreadas: resumen.ordenesCreadas || 0 };
  });
}
