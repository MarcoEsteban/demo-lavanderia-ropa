import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "../src");
const OUT = process.env.OUT_DIR
  ? path.resolve(process.env.OUT_DIR)
  : path.resolve(import.meta.dirname, "../.preview");
const BASE = (process.env.BASE_URL || process.env.URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin.preview.html";
const ESTADO_NAME = process.env.ESTADO_NAME || "Estado.preview.html";
const LANDING = process.env.LANDING === "1";
const ESTADO_URL = `${BASE}/${ESTADO_NAME}`;

const NEGOCIO = {
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
  pagoInstrucciones: "Escaneá el QR y guardá el comprobante.",
};

const TEMA = { primario: "#0B4F60", secundario: "#B7791F", acento: "#E7F1F3" };

function include(nombre) {
  return fs.readFileSync(path.join(SRC, `${nombre}.html`), "utf8");
}

function comunes(html) {
  html = html.replace(/<\?!= include\('([^']+)'\) \?>/g, (_m, n) => include(n));
  html = html.replace(/<\?= tema\.(\w+) \?>/g, (_m, k) => TEMA[k] || "");
  html = html.replace(/<\?= cfg\.negocio_nombre \?>/g, NEGOCIO.nombre);
  html = html.replace(/<\?= cfg\.negocio_direccion \?>/g, NEGOCIO.direccion);
  html = html.replace(/<\?= cfg\.negocio_ciudad \?>/g, NEGOCIO.ciudad);
  html = html.replace(
    /<head>/i,
    `<head>\n  <script>window.__BASE_URL__ = ${JSON.stringify(ESTADO_URL)};</script>\n  <script src="mock.js?v=${Date.now()}"></script>`
  );
  return html;
}

function admin() {
  let html = fs.readFileSync(path.join(SRC, "Admin.html"), "utf8");
  html = comunes(html);
  const boot = {
    negocio: NEGOCIO,
    authConfigurada: true,
    scriptUrl: ESTADO_URL,
  };
  html = html.replace(
    /window\.BOOT = <\?!= jsonSeguro_\([\s\S]*?\) \?>;/,
    `window.BOOT = ${JSON.stringify(boot)};`
  );
  return html;
}

function estado() {
  let html = fs.readFileSync(path.join(SRC, "Estado.html"), "utf8");
  html = comunes(html);
  html = html.replace(/<\?!= jsonSeguro_\(token\) \?>/g, JSON.stringify("tok6"));
  html = html.replace(
    /<\?!= jsonSeguro_\(scriptUrl\) \?>/g,
    JSON.stringify(ESTADO_URL)
  );
  html = html.replace(
    /<\?!= jsonSeguro_\(datosNegocio_\(cfg\)\) \?>/g,
    JSON.stringify(NEGOCIO)
  );
  return html;
}

function landing() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lavandería Demo</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      background: radial-gradient(circle at 20% 0%, #E7F1F3, #F7FAFA 55%);
      color: #10333A; padding: 28px;
    }
    main { width: 100%; max-width: 560px; }
    .tarjeta {
      background: #fff; border: 1px solid #DCE8EA; border-radius: 24px;
      padding: clamp(24px, 5vw, 40px); box-shadow: 0 24px 60px rgba(11, 79, 96, .10);
    }
    .logo {
      width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center;
      background: #0B4F60; color: #fff; margin-bottom: 18px;
    }
    .logo svg { width: 28px; height: 28px; }
    .eyebrow {
      margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: .12em;
      text-transform: uppercase; color: #B7791F;
    }
    h1 { margin: 0 0 10px; font-size: clamp(26px, 5vw, 34px); line-height: 1.1; }
    p { margin: 0 0 20px; color: #4A656B; line-height: 1.6; font-size: 15px; }
    .acciones { display: grid; gap: 10px; }
    a {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 48px; padding: 0 18px; border-radius: 14px; text-decoration: none;
      font-weight: 700; font-size: 15px; transition: transform .15s ease, box-shadow .15s ease;
    }
    a:hover { transform: translateY(-1px); }
    a:focus-visible { outline: 3px solid #B7791F; outline-offset: 2px; }
    .primario { background: #0B4F60; color: #fff; box-shadow: 0 10px 24px rgba(11, 79, 96, .22); }
    .secundario { background: #F1F7F8; color: #0B4F60; border: 1px solid #D6E4E7; }
    .nota {
      margin: 22px 0 0; padding-top: 18px; border-top: 1px dashed #DCE8EA;
      font-size: 12.5px; color: #6B8389;
    }
    .nota strong { color: #10333A; }
  </style>
</head>
<body>
  <main>
    <div class="tarjeta">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5z"/>
          <circle cx="12" cy="13" r="4.2"/>
          <path d="M7 6.5h.01M10 6.5h.01"/>
        </svg>
      </div>
      <p class="eyebrow">Demo interactiva</p>
      <h1>Lavandería Demo</h1>
      <p>Recepción por kilo, tablero de producción, cobros, reportes y estado público del pedido.</p>
      <div class="acciones">
        <a class="primario" href="Admin.html">Abrir panel del local</a>
        <a class="secundario" href="Estado.html?estado=tok6">Ver estado público de un pedido</a>
      </div>
      <p class="nota"><strong>Versión estática:</strong> los datos se simulan en el navegador y se reinician al recargar. La versión real corre sobre <strong>Google Apps Script + Sheets</strong>.</p>
    </div>
  </main>
</body>
</html>`;
}

function verificar(nombre, html) {
  const restantes = html.match(/<\?[^>]*\?>/g);
  if (restantes) throw new Error(`${nombre} dejó template tags: ${restantes.join(", ")}`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, nombre), html);
  console.log(`${nombre}: ${html.length} bytes`);
}

verificar(ADMIN_NAME, admin());
verificar(ESTADO_NAME, estado());
fs.copyFileSync(path.join(import.meta.dirname, "demo-mock.js"), path.join(OUT, "mock.js"));
if (LANDING) verificar("index.html", landing());
console.log("Listo en", OUT);
