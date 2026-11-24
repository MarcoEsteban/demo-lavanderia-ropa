/* Mock de google.script.run para previsualizar el panel sin Apps Script. */
(function () {
  "use strict";

  var HOY = new Date().toISOString().slice(0, 10);
  var ahora = Date.now();
  function hace(horas) { return ahora - horas * 3600000; }

  var NEGOCIO = {
    nombre: "Lavandería Demo",
    telefono: "70012345",
    whatsapp: "70012345",
    telefonoBonito: "700 123 45",
    direccion: "Av. Siempre Fresca 123, entre 2do y 3er anillo",
    ciudad: "Santa Cruz de la Sierra",
    horario: "08:00 a 20:00",
    monedaSimbolo: "Bs.",
    zonaHoraria: "America/La_Paz",
    pagoQrUrl: "https://quickchart.io/qr?size=240&text=PAGO-DEMO-LAVANDERIA",
    pagoInstrucciones: "Escaneá el QR y guardá el comprobante. Registramos el pago al confirmarlo."
  };

  var CFG = {
    minimoKg: 2, recargoExpress: 15, precioPlanchadoPieza: 5,
    diasEntregaLavado: 2, diasEntregaPlanchado: 3, diasEntregaExpress: 1,
    diasCerrados: [0], horarioApertura: "08:00", horarioCierre: "20:00",
    piePagina: "¡Gracias por confiar en nosotros!"
  };

  var SERVICIOS = [
    { id: 1, nombre: "Lavado por kilo", tipo: "kg", categoria: "general", precio: 12, incluyePlanchado: false, activo: true, descripcion: "Ropa de uso diario, secada al aire" },
    { id: 2, nombre: "Lavado + planchado por kilo", tipo: "kg", categoria: "general", precio: 18, incluyePlanchado: true, activo: true, descripcion: "Ropa lista para colgar" },
    { id: 3, nombre: "Edredón 1 plaza", tipo: "pieza", categoria: "especial", precio: 25, incluyePlanchado: true, activo: true, descripcion: "Lavado y planchado" },
    { id: 4, nombre: "Edredón 2 plazas", tipo: "pieza", categoria: "especial", precio: 35, incluyePlanchado: true, activo: true, descripcion: "Lavado y planchado" },
    { id: 5, nombre: "Quilt / colcha", tipo: "pieza", categoria: "especial", precio: 40, incluyePlanchado: true, activo: true, descripcion: "Lavado y planchado" },
    { id: 6, nombre: "Alfombra", tipo: "pieza", categoria: "especial", precio: 50, incluyePlanchado: false, activo: true, descripcion: "Lavado y secado, sin planchado" },
    { id: 7, nombre: "Cortina (por paño)", tipo: "pieza", categoria: "especial", precio: 20, incluyePlanchado: true, activo: true, descripcion: "Lavado y planchado" }
  ];

  var ESTADOS = [
    { id: "recibida", label: "Recibida" },
    { id: "clasificacion", label: "Clasificación" },
    { id: "lavado", label: "Lavado" },
    { id: "secado", label: "Secado" },
    { id: "planchado", label: "Planchado" },
    { id: "empaquetado", label: "Empaquetado" },
    { id: "lista", label: "Lista" },
    { id: "entregada", label: "Entregada" }
  ];

  var DESCRIPCION = {
    recibida: "Recibimos tu ropa y ya registramos el pedido.",
    clasificacion: "Estamos separando y clasificando cada prenda.",
    lavado: "Tu ropa está en lavado.",
    secado: "Tu ropa se está secando.",
    planchado: "Estamos planchando tus prendas.",
    empaquetado: "Estamos embolsando y etiquetando tu pedido.",
    lista: "¡Tu pedido está listo para retirar!",
    entregada: "Pedido entregado. ¡Gracias por confiar en nosotros!",
    cancelada: "Este pedido fue cancelado. Escribinos si tenés dudas."
  };

  function resumen(over) {
    return Object.assign({
      id: 1, codigo: "L-0001", estado: "recibida", estadoLabel: "Recibida",
      clienteNombre: "Ana Quispe", clienteTelefono: "71234567",
      prendas: 12, pesoKg: 4.2, servicioNombre: "Lavado por kilo",
      incluyePlanchado: false, total: 50.4, pagado: 0, saldo: 50.4,
      pagoEstado: "pendiente", notificado: false,
      fechaPrometida: "2026-11-23", recepcionMs: hace(2), entregaMs: 0
    }, over);
  }

  var ORDENES = [
    resumen({ id: 1, codigo: "L-0001", estado: "recibida", estadoLabel: "Recibida" }),
    resumen({ id: 2, codigo: "L-0002", estado: "clasificacion", estadoLabel: "Clasificación", clienteNombre: "Carlos Mamani", clienteTelefono: "67890123", prendas: 18, pesoKg: 6.8, servicioNombre: "Lavado + planchado por kilo", incluyePlanchado: true, total: 122.4, saldo: 122.4, recepcionMs: hace(4) }),
    resumen({ id: 3, codigo: "L-0003", estado: "lavado", estadoLabel: "Lavado", clienteNombre: "José Rojas", clienteTelefono: "70112233", prendas: 15, pesoKg: 5, total: 60, saldo: 60, fechaPrometida: "2026-11-20", recepcionMs: hace(26) }),
    resumen({ id: 4, codigo: "L-0004", estado: "secado", estadoLabel: "Secado", clienteNombre: "Lucía Vargas", clienteTelefono: "73334455", prendas: 11, pesoKg: 2.6, servicioNombre: "Lavado + planchado por kilo", incluyePlanchado: true, total: 46.8, pagado: 20, saldo: 26.8, pagoEstado: "parcial", fechaPrometida: "2026-11-24", recepcionMs: hace(20) }),
    resumen({ id: 5, codigo: "L-0005", estado: "empaquetado", estadoLabel: "Empaquetado", clienteNombre: "María Flores", clienteTelefono: "76543210", prendas: 16, pesoKg: 5.1, servicioNombre: "Lavado + planchado por kilo", incluyePlanchado: true, total: 91.8, pagado: 91.8, saldo: 0, pagoEstado: "pagado", fechaPrometida: "2026-11-21", recepcionMs: hace(30) }),
    resumen({ id: 6, codigo: "L-0006", estado: "lista", estadoLabel: "Lista", clienteNombre: "Ana Quispe", clienteTelefono: "71234567", prendas: 22, pesoKg: 7.4, servicioNombre: "Lavado por kilo", total: 128.8, pagado: 40, saldo: 88.8, pagoEstado: "parcial", notificado: false, fechaPrometida: "2026-11-22", recepcionMs: hace(48) }),
    resumen({ id: 7, codigo: "L-0007", estado: "lista", estadoLabel: "Lista", clienteNombre: "Carlos Mamani", clienteTelefono: "67890123", prendas: 12, pesoKg: 4, servicioNombre: "Lavado + planchado por kilo", incluyePlanchado: true, total: 72, pagado: 72, saldo: 0, pagoEstado: "pagado", notificado: true, fechaPrometida: "2026-11-21", recepcionMs: hace(52) }),
    resumen({ id: 8, codigo: "L-0008", estado: "entregada", estadoLabel: "Entregada", clienteNombre: "María Flores", clienteTelefono: "76543210", prendas: 16, pesoKg: 5.1, servicioNombre: "Lavado + planchado por kilo", incluyePlanchado: true, total: 91.8, pagado: 91.8, saldo: 0, pagoEstado: "pagado", notificado: true, fechaPrometida: "2026-11-21", recepcionMs: hace(72), entregaMs: hace(1) })
  ];

  function panel() {
    var activas = ORDENES.filter(function (o) { return o.estado !== "entregada" && o.estado !== "cancelada"; });
    var resumenPanel = {
      recibidasHoy: 3, activas: activas.length, listas: 0, sinNotificar: 0,
      entregadasHoy: 1, saldoPendiente: 0, prendasEnProceso: 0
    };
    activas.forEach(function (o) {
      resumenPanel.prendasEnProceso += o.prendas;
      resumenPanel.saldoPendiente += o.saldo;
      if (o.estado === "lista") resumenPanel.listas++;
      if (o.estado === "lista" && !o.notificado) resumenPanel.sinNotificar++;
    });
    return { resumen: resumenPanel, ordenes: ORDENES.slice(), estados: ESTADOS, hoy: HOY };
  }

  function detalle(id) {
    var base = ORDENES.filter(function (o) { return o.id === Number(id); })[0];
    if (!base) return null;
    var incluyePlanchado = base.incluyePlanchado;
    var pasos = ESTADOS.filter(function (e) { return e.id !== "planchado" || incluyePlanchado; });
    var idx = -1;
    pasos.forEach(function (p, i) { if (p.id === base.estado) idx = i; });
    var hechos = pasos.map(function (p, i) {
      return { id: p.id, label: p.label, hecho: base.estado === "entregada" || (idx > -1 && i < idx), actual: p.id === base.estado };
    });
    var kg = base.pesoKg;
    var precioKg = incluyePlanchado ? 18 : 12;
    var lineas = [
      { tipo: "general_kg", descripcion: base.servicioNombre + " · " + String(kg).replace(".", ",") + " kg", cantidad: kg, precioUnitario: precioKg, subtotal: Math.round(kg * precioKg * 100) / 100 }
    ];
    if (base.id === 6) {
      lineas.push({ tipo: "especial_pieza", descripcion: "Quilt / colcha", cantidad: 1, precioUnitario: 40, subtotal: 40 });
      lineas.push({ tipo: "recargo", descripcion: "Servicio express", cantidad: 1, precioUnitario: 15, subtotal: 15 });
      lineas.push({ tipo: "descuento", descripcion: "Descuento", cantidad: 1, precioUnitario: -15, subtotal: -15 });
    }
    var eventos = [
      { tipo: "estado", estado: "recibida", estadoLabel: "Recibida", fechaMs: base.recepcionMs, usuario: "staff", nota: "" },
      { tipo: "estado", estado: "lavado", estadoLabel: "Lavado", fechaMs: base.recepcionMs + 3600000, usuario: "staff", nota: "" }
    ];
    if (base.estado === "entregada") eventos.push({ tipo: "estado", estado: "entregada", estadoLabel: "Entregada", fechaMs: base.entregaMs, usuario: "staff", nota: "Retirado en mostrador" });
    var pagos = base.pagado > 0 ? [{ metodo: "efectivo", metodoLabel: "Efectivo", monto: base.pagado, fechaMs: base.recepcionMs + 7200000, usuario: "staff", nota: "Pago de ejemplo" }] : [];

    return Object.assign({}, base, {
      token: "tok" + base.id,
      linkEstado: "https://script.google.com/macros/s/DEMO/exec?estado=tok" + base.id,
      estadoDescripcion: DESCRIPCION[base.estado],
      cliente: { id: base.id, nombre: base.clienteNombre, telefono: base.clienteTelefono, telefonoBonito: base.clienteTelefono.replace(/(\d{3})(\d{3})(\d{2})/, "$1 $2 $3") },
      pesoCobrado: Math.max(kg, 2),
      observaciones: base.id === 1 ? "Ropa de trabajo, sin suavizante." : "",
      lineas: lineas,
      subtotal: base.total,
      descuento: base.id === 6 ? 15 : 0,
      recargo: base.id === 6 ? 15 : 0,
      eventos: eventos,
      pagos: pagos,
      notificaciones: [],
      pasos: hechos,
      permitidas: [],
      siguiente: base.estado === "lista" ? "entregada" : "",
      puedeCancelar: base.estado === "recibida" || base.estado === "clasificacion",
      puedeEntregar: base.estado === "lista" && base.saldo <= 0.005,
      puedeNotificar: base.estado === "lista"
    });
  }

  function actualizar(id, cambios) {
    for (var i = 0; i < ORDENES.length; i++) {
      if (ORDENES[i].id === Number(id)) {
        ORDENES[i] = Object.assign({}, ORDENES[i], cambios);
        return detalle(id);
      }
    }
    return null;
  }

  var CONFIG_ADMIN = {
    negocio_nombre: "Lavandería Demo",
    negocio_ciudad: "Santa Cruz de la Sierra",
    negocio_whatsapp: "70012345",
    negocio_telefono: "70012345",
    negocio_direccion: "Av. Siempre Fresca 123, entre 2do y 3er anillo",
    horario_apertura: "08:00",
    horario_cierre: "20:00",
    minimo_kg: "2",
    recargo_express: "15",
    precio_planchado_pieza: "5",
    dias_entrega_lavado: "2",
    dias_entrega_planchado: "3",
    dias_entrega_express: "1",
    dias_cerrados: "0",
    color_primario: "#0B4F60",
    color_secundario: "#B7791F",
    color_acento: "#E7F1F3",
    whatsapp_plantilla: "¡Hola {cliente}! Tu pedido {codigo} de {negocio} está listo para retirar.\n\nTotal: {total}\nSaldo: {saldo}\nRetiralo en {direccion}, de {horario}.\n\nEstado: {link}",
    pago_qr_url: "https://quickchart.io/qr?size=240&text=PAGO-DEMO-LAVANDERIA",
    pago_instrucciones: "Escaneá el QR y guardá el comprobante.",
    pie_pagina_recibo: "¡Gracias por confiar en nosotros!"
  };

  function reportes(desde, hasta) {
    var dias = [];
    var base = new Date(desde + "T12:00:00Z");
    var fin = new Date(hasta + "T12:00:00Z");
    var montos = [320, 410, 280, 530, 460, 610, 390];
    var i = 0;
    while (base <= fin && i < 40) {
      dias.push({
        fecha: base.toISOString().slice(0, 10),
        monto: montos[i % montos.length],
        ordenes: 2 + (i % 4)
      });
      base = new Date(base.getTime() + 86400000);
      i++;
    }
    var total = dias.reduce(function (s, d) { return s + d.monto; }, 0);
    return {
      desde: desde, hasta: hasta,
      kpis: { ordenes: 31, prendas: 214, kg: 96.4, facturado: 2410.6, ticketPromedio: 77.76, entregadas: 26, entregadasMonto: 1980.4 },
      porServicio: [
        { nombre: "Lavado + planchado por kilo", unidad: "kg", cantidad: 62.4, monto: 1123.2 },
        { nombre: "Lavado por kilo", unidad: "kg", cantidad: 34, monto: 408 },
        { nombre: "Quilt / colcha", unidad: "pieza", cantidad: 4, monto: 160 },
        { nombre: "Edredón 2 plazas", unidad: "pieza", cantidad: 3, monto: 105 },
        { nombre: "Cortina (por paño)", unidad: "pieza", cantidad: 5, monto: 100 }
      ],
      porMetodo: [
        { metodo: "efectivo", label: "Efectivo", monto: Math.round(total * 0.62) },
        { metodo: "qr", label: "QR", monto: Math.round(total * 0.38) }
      ],
      porDia: dias,
      cobradoEnRango: total,
      saldoPendiente: 286.8,
      ordenesActivas: 8
    };
  }

  var api = {
    getContexto: function () {
      return { ok: true, sesion: { rol: "admin", nombre: "Administración" }, negocio: NEGOCIO, cfg: CFG, servicios: SERVICIOS, estados: ESTADOS, hoy: HOY };
    },
    iniciarSesion: function (credenciales) {
      return { ok: true, token: "demo-token", rol: credenciales.rol, nombre: credenciales.rol === "admin" ? "Administración" : "Mostrador" };
    },
    cerrarSesion: function () { return { ok: true }; },
    getPanel: function () { return Object.assign({ ok: true }, panel()); },
    getOrden: function (token, id) {
      var o = detalle(id);
      return o ? { ok: true, orden: o } : { ok: false, error: "Orden inexistente." };
    },
    listarOrdenes: function (token, filtros) {
      var lista = ORDENES.filter(function (o) { return !filtros || !filtros.estado || filtros.estado === "todas" || o.estado === filtros.estado; });
      return { ok: true, total: lista.length, ordenes: lista };
    },
    buscarClientes: function () {
      return { ok: true, clientes: [
        { id: 1, nombre: "Ana Quispe", telefono: "71234567", telefonoBonito: "712 345 67" },
        { id: 2, nombre: "Carlos Mamani", telefono: "67890123", telefonoBonito: "678 901 23" }
      ] };
    },
    crearOrden: function (token, datos) {
      var id = ORDENES.length + 1;
      var kg = Number(String(datos.pesoKg).replace(",", "."));
      var base = SERVICIOS.filter(function (s) { return s.id === Number(datos.servicioId); })[0] || SERVICIOS[0];
      var pesoCobrado = Math.max(kg, Number(CFG.minimoKg) || 0);
      var total = pesoCobrado * base.precio;
      (datos.especiales || []).forEach(function (item) {
        var s = SERVICIOS.filter(function (x) { return x.id === Number(item.servicioId); })[0];
        if (s) total += (Number(item.cantidad) || 0) * s.precio;
      });
      if (datos.express) total += Number(CFG.recargoExpress) || 0;
      if (datos.planchadoExtra) total += (Number(datos.planchadoExtra) || 0) * (Number(CFG.precioPlanchadoPieza) || 0);
      total -= Number(String(datos.descuento || "0").replace(",", ".")) || 0;
      total = Math.round(total * 100) / 100;

      var o = Object.assign({}, ORDENES[0], {
        id: id, codigo: "L-000" + id, estado: "recibida", estadoLabel: "Recibida",
        clienteNombre: datos.nombre, clienteTelefono: datos.telefono,
        cliente: { id: 9, nombre: datos.nombre, telefono: datos.telefono, telefonoBonito: datos.telefono },
        pesoKg: kg, pesoCobrado: pesoCobrado, prendas: datos.prendas,
        servicioNombre: base.nombre, incluyePlanchado: !!base.incluyePlanchado,
        total: total, pagado: 0, saldo: total, pagoEstado: "pendiente",
        fechaPrometida: datos.fechaPrometida || "2026-11-24", recepcionMs: Date.now(),
        notificado: false, observaciones: datos.observaciones || "",
        token: "tok" + id,
        linkEstado: (window.__BASE_URL__ || "https://script.google.com/macros/s/DEMO/exec") + "?estado=tok" + id
      });
      ORDENES.push(o);
      return { ok: true, orden: o };
    },
    avanzarEstado: function (token, id, estado) {
      var o = actualizar(id, { estado: estado, estadoLabel: ESTADOS.filter(function (e) { return e.id === estado; })[0].label, entregaMs: estado === "entregada" ? Date.now() : 0 });
      return o ? { ok: true, orden: o } : { ok: false, error: "No se pudo avanzar." };
    },
    retrocederEstado: function (token, id) { return { ok: true, orden: detalle(id) }; },
    cancelarOrden: function (token, id) { return { ok: true, orden: actualizar(id, { estado: "cancelada", estadoLabel: "Cancelada" }) }; },
    registrarPago: function (token, id, datos) {
      var o = detalle(id);
      var pagado = Math.round((o.pagado + Number(datos.monto)) * 100) / 100;
      var saldo = Math.round((o.total - pagado) * 100) / 100;
      return { ok: true, orden: actualizar(id, { pagado: pagado, saldo: saldo, pagoEstado: saldo <= 0.005 ? "pagado" : "parcial" }) };
    },
    getNotificacion: function (token, id) {
      var o = detalle(id);
      return {
        ok: true, texto: "¡Hola " + o.cliente.nombre.split(" ")[0] + "! Tu pedido " + o.codigo + " está listo para retirar.\n\nTotal: Bs. " + o.total.toFixed(2) + "\nSaldo: Bs. " + o.saldo.toFixed(2) + "\n\nEstado: " + o.linkEstado,
        telefono: o.cliente.telefono, telefonoBonito: o.cliente.telefonoBonito,
        waUrl: "https://wa.me/591" + o.cliente.telefono,
        linkEstado: o.linkEstado, yaNotificado: o.notificado, fechaNotificacionMs: 0
      };
    },
    marcarNotificado: function (token, id) { return { ok: true, orden: actualizar(id, { notificado: true }) }; },
    getReportes: function (token, desde, hasta) { return Object.assign({ ok: true }, reportes(desde, hasta)); },
    getConfigAdmin: function () { return { ok: true, config: CONFIG_ADMIN, servicios: SERVICIOS.slice(), clavesProtegidas: ["zona_horaria", "moneda", "moneda_simbolo"] }; },
    guardarConfigAdmin: function () { return { ok: true, mensaje: "Configuración guardada." }; },
    guardarServicioAdmin: function (token, datos) {
      var serv = { id: datos.id || 8, nombre: datos.nombre, tipo: datos.tipo, categoria: datos.tipo === "kg" ? "general" : "especial", precio: Number(String(datos.precio).replace(",", ".")), incluyePlanchado: !!datos.incluyePlanchado, activo: !!datos.activo, descripcion: datos.descripcion || "" };
      return { ok: true, servicio: serv };
    },
    cambiarServicioActivoAdmin: function (token, id, activo) {
      var s = SERVICIOS.filter(function (x) { return x.id === Number(id); })[0];
      return { ok: true, servicio: Object.assign({}, s, { activo: !!activo }) };
    },
    cargarDemoAdmin: function () { return { ok: true, mensaje: "Datos de ejemplo cargados.", ordenesCreadas: 8 }; },
    reiniciarDemoAdmin: function () { return { ok: true, mensaje: "Demo reiniciada.", ordenesCreadas: 8 }; },
    limpiarCacheAdmin: function () { return { ok: true, mensaje: "Caché de configuración y catálogos limpio." }; },
    consultarEstadoPublico: function () {
      var o = detalle(6);
      return { ok: true, orden: {
        codigo: o.codigo, cliente: "Ana", estado: o.estado, estadoLabel: o.estadoLabel,
        estadoDescripcion: o.estadoDescripcion, pasos: o.pasos,
        fechaPrometida: "2026-11-25", fechaPrometidaBonita: "mié 25/11",
        entregaMs: 0, prendas: 22, pesoKg: 7.4, incluyePlanchado: false,
        items: [
          { descripcion: "Lavado por kilo · 7,4 kg", cantidad: 7.4, subtotal: 88.8 },
          { descripcion: "Quilt / colcha", cantidad: 1, subtotal: 40 },
          { descripcion: "Servicio express", cantidad: 1, subtotal: 15 },
          { descripcion: "Descuento", cantidad: 1, subtotal: -15 }
        ],
        total: 128.8, pagado: 40, saldo: 88.8, pagoEstado: "parcial",
        actualizadoMs: Date.now(), negocio: NEGOCIO
      } };
    },
    recuperarEstado: function (codigo, tel) {
      if (String(codigo).toUpperCase().indexOf("6") > -1 && String(tel).length === 4) {
        return { ok: true, token: "tok6" };
      }
      return { ok: false, error: "No pudimos verificar el pedido. Revisá el código y los últimos 4 dígitos del celular." };
    }
  };

  function crearRunner() {
    var exito = null;
    var fallo = null;
    var proxy = new Proxy({}, {
      get: function (target, prop) {
        if (prop === "withSuccessHandler") {
          return function (fn) { exito = fn; return proxy; };
        }
        if (prop === "withFailureHandler") {
          return function (fn) { fallo = fn; return proxy; };
        }
        return function () {
          var args = Array.prototype.slice.call(arguments);
          window.setTimeout(function () {
            try {
              var fn = api[prop];
              if (!fn) throw new Error("Función mock no implementada: " + prop);
              var res = fn.apply(null, args);
              if (exito) exito(res);
            } catch (err) {
              if (fallo) fallo(err);
              else console.error(err);
            }
          }, 25);
        };
      }
    });
    return proxy;
  }

  window.google = {
    script: {
      run: crearRunner(),
      host: { close: function () {} }
    }
  };

  window.__MOCK__ = { ORDENES: ORDENES, NEGOCIO: NEGOCIO, CFG: CFG, SERVICIOS: SERVICIOS };

  try {
    sessionStorage.setItem("lav_sesion", JSON.stringify({ token: "demo-token", rol: "admin", nombre: "Administración" }));
  } catch (err) { /* noop */ }
})();
