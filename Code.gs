// ============================================================
// ACTIVO MOTORS - Tienda en Línea
// Google Apps Script - Code.gs
// Compatible con GitHub Pages (fetch externo)
// ============================================================

const SHEET_ID = '1_EkuvwRd6rE5Ff16XhbN241NTf2YMU14rI5IUH5hQqM';
const LOGO_URL = 'https://i.postimg.cc/1tc59dcg/activo-motors-logo-sin-fondo-Mesa-de-trabajo-1.png';

const EMPRESA = {
  nombre: 'ACTIVO MOTORS',
  direccion: 'San Diego, Valle Verde, cerca de la Avenida Don Julio Centeno',
  telefono: '0412-2004902',
  logo: LOGO_URL
};

// ============================================================
// CORS HEADERS — necesarios para peticiones desde GitHub Pages
// ============================================================
function setCORSHeaders() {
  return ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);
}

function responder(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================================
// doGet — maneja todas las peticiones GET desde la web
// ============================================================
function doGet(e) {
  const accion = e.parameter.accion || '';

  try {
    if (accion === 'productos') {
      const cat = e.parameter.categoria || null;
      return responder({ ok: true, data: obtenerProductos(cat) });
    }

    if (accion === 'categorias') {
      return responder({ ok: true, data: obtenerCategorias() });
    }

    // Sin accion: sirve la web app si se accede directo
    return responder({ ok: true, mensaje: 'API Activo Motors activa' });

  } catch (err) {
    return responder({ ok: false, error: err.message });
  }
}

// ============================================================
// doPost — maneja pedidos enviados desde la web
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const accion = body.accion || '';

    if (accion === 'pedido') {
      const resultado = procesarPedido(body.cliente, body.carrito);
      return responder(resultado);
    }

    return responder({ ok: false, error: 'Acción no reconocida' });

  } catch (err) {
    return responder({ ok: false, error: err.message });
  }
}

// ============================================================
// INICIALIZAR HOJAS
// ============================================================
function inicializarHojas() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // PRODUCTOS
  let hProd = ss.getSheetByName('PRODUCTOS');
  if (!hProd) hProd = ss.insertSheet('PRODUCTOS');
  hProd.clearContents();
  const hP = ['ID','NOMBRE','CATEGORÍA','DESCRIPCIÓN','PRECIO','STOCK','IMAGEN_URL','ACTIVO'];
  hProd.getRange(1,1,1,hP.length).setValues([hP]);
  hProd.getRange(1,1,1,hP.length).setBackground('#CC0000').setFontColor('#fff').setFontWeight('bold');
  hProd.setFrozenRows(1);
  [60,200,130,280,90,70,250,70].forEach((w,i) => hProd.setColumnWidth(i+1,w));

  const muestra = [
    ['P001','Filtro de Aceite Toyota','Filtros','Filtro de aceite original para Toyota Corolla, Camry y Yaris 2015-2023',8.50,50,LOGO_URL,'SI'],
    ['P002','Pastillas de Freno Delanteras','Frenos','Pastillas de freno cerámicas de alto rendimiento para vehículos compactos',22.00,30,LOGO_URL,'SI'],
    ['P003','Bujías NGK Iridium (x4)','Motor','Set de 4 bujías NGK Iridium de larga duración, compatibilidad universal',35.00,40,LOGO_URL,'SI'],
    ['P004','Correa de Distribución','Motor','Correa de distribución reforzada para motores 1.6L y 2.0L',45.00,20,LOGO_URL,'SI'],
    ['P005','Amortiguador Trasero Monroe','Suspensión','Amortiguador trasero Monroe Gas-Magnum para sedán y SUV',55.00,15,LOGO_URL,'SI'],
    ['P006','Batería 12V 60Ah Bosch','Eléctrico','Batería Bosch libre de mantenimiento 12V 60Ah para automóviles',85.00,12,LOGO_URL,'SI'],
    ['P007','Filtro de Aire K&N','Filtros','Filtro de aire de alto flujo K&N, lavable y reutilizable',42.00,25,LOGO_URL,'SI'],
    ['P008','Aceite Motor 5W-30 (4L)','Lubricantes','Aceite sintético Castrol EDGE 5W-30 para motores modernos, garrafa 4L',28.00,60,LOGO_URL,'SI'],
    ['P009','Disco de Freno Ventilado','Frenos','Disco de freno ventilado 280mm de diámetro, compatible con varios modelos',38.00,18,LOGO_URL,'SI'],
    ['P010','Kit Embrague Completo','Transmisión','Kit completo de embrague: disco, plato de presión y collarín para vehículos 1.4-2.0L',95.00,10,LOGO_URL,'SI'],
    ['P011','Radiador Aluminio Universal','Refrigeración','Radiador de aluminio de 2 filas, alto rendimiento para motores 4 cilindros',110.00,8,LOGO_URL,'SI'],
    ['P012','Sensor O2 / Lambda','Eléctrico','Sensor de oxígeno O2 universal 4 cables, compatible Bosch y Denso',32.00,22,LOGO_URL,'SI'],
  ];
  if (hProd.getLastRow() < 2) {
    hProd.getRange(2,1,muestra.length,hP.length).setValues(muestra);
  }

  // PEDIDOS
  let hPed = ss.getSheetByName('PEDIDOS');
  if (!hPed) hPed = ss.insertSheet('PEDIDOS');
  hPed.clearContents();
  const hPedH = ['N° PEDIDO','FECHA','CLIENTE','EMAIL','TELÉFONO','DIRECCIÓN','PRODUCTOS','SUBTOTAL','IVA (16%)','TOTAL','ESTADO'];
  hPed.getRange(1,1,1,hPedH.length).setValues([hPedH]);
  hPed.getRange(1,1,1,hPedH.length).setBackground('#1a1a1a').setFontColor('#fff').setFontWeight('bold');
  hPed.setFrozenRows(1);
  hPed.setColumnWidths(1,hPedH.length,140);

  // CLIENTES
  let hCli = ss.getSheetByName('CLIENTES');
  if (!hCli) hCli = ss.insertSheet('CLIENTES');
  hCli.clearContents();
  const hCliH = ['ID CLIENTE','NOMBRE','EMAIL','TELÉFONO','DIRECCIÓN','FECHA REGISTRO','TOTAL COMPRAS'];
  hCli.getRange(1,1,1,hCliH.length).setValues([hCliH]);
  hCli.getRange(1,1,1,hCliH.length).setBackground('#CC0000').setFontColor('#fff').setFontWeight('bold');
  hCli.setFrozenRows(1);
  hCli.setColumnWidths(1,hCliH.length,160);

  return { ok: true, mensaje: 'Hojas inicializadas correctamente.' };
}

// ============================================================
// OBTENER PRODUCTOS
// ============================================================
function obtenerProductos(categoria) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName('PRODUCTOS');
    if (!hoja || hoja.getLastRow() < 2) return [];

    let prods = hoja.getRange(2,1,hoja.getLastRow()-1,8).getValues()
      .filter(r => r[0] !== '' && r[7] === 'SI')
      .map(r => ({
        id: String(r[0]),
        nombre: r[1],
        categoria: r[2],
        descripcion: r[3],
        precio: parseFloat(r[4]) || 0,
        stock: parseInt(r[5]) || 0,
        imagen: r[6] || LOGO_URL
      }));

    if (categoria && categoria !== 'TODOS') {
      prods = prods.filter(p => p.categoria === categoria);
    }
    return prods;
  } catch(e) {
    Logger.log('Error obtenerProductos: ' + e.message);
    return [];
  }
}

// ============================================================
// OBTENER CATEGORÍAS
// ============================================================
function obtenerCategorias() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName('PRODUCTOS');
    if (!hoja || hoja.getLastRow() < 2) return [];
    const datos = hoja.getRange(2,1,hoja.getLastRow()-1,3).getValues();
    return [...new Set(datos.filter(r => r[0] !== '').map(r => r[2]))];
  } catch(e) { return []; }
}

// ============================================================
// PROCESAR PEDIDO
// ============================================================
function procesarPedido(cliente, carrito) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const hPed  = ss.getSheetByName('PEDIDOS');
    const hCli  = ss.getSheetByName('CLIENTES');
    const hProd = ss.getSheetByName('PRODUCTOS');

    const ahora = new Date();
    const nPedido = 'PED-' + Utilities.formatDate(ahora,'America/Caracas','yyyyMMdd') + '-' + Math.floor(Math.random()*9000+1000);

    let subtotal = 0;
    const resumen = [];
    carrito.forEach(item => {
      subtotal += item.precio * item.cantidad;
      resumen.push(`${item.nombre} x${item.cantidad} ($${(item.precio*item.cantidad).toFixed(2)})`);
    });
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    hPed.appendRow([
      nPedido,
      Utilities.formatDate(ahora,'America/Caracas','dd/MM/yyyy HH:mm'),
      cliente.nombre, cliente.email, cliente.telefono, cliente.direccion,
      resumen.join(' | '),
      subtotal.toFixed(2), iva.toFixed(2), total.toFixed(2),
      'CONFIRMADO'
    ]);

    guardarCliente(hCli, cliente, total);
    actualizarStock(hProd, carrito);

    const pdfBlob = generarPDF(nPedido, cliente, carrito, subtotal, iva, total, ahora);
    enviarCorreo(cliente, nPedido, pdfBlob, subtotal, iva, total, carrito, ahora);

    return { ok: true, numeroPedido: nPedido, total: total.toFixed(2) };
  } catch(e) {
    Logger.log('Error procesarPedido: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// GUARDAR CLIENTE
// ============================================================
function guardarCliente(hoja, cliente, total) {
  const datos = hoja.getLastRow() > 1 ? hoja.getRange(2,1,hoja.getLastRow()-1,7).getValues() : [];
  const idx = datos.findIndex(r => r[2] === cliente.email);
  if (idx >= 0) {
    hoja.getRange(idx+2,7).setValue((parseFloat(datos[idx][6]||0)+total).toFixed(2));
  } else {
    hoja.appendRow(['CLI-'+hoja.getLastRow(), cliente.nombre, cliente.email,
      cliente.telefono, cliente.direccion,
      Utilities.formatDate(new Date(),'America/Caracas','dd/MM/yyyy'),
      total.toFixed(2)]);
  }
}

// ============================================================
// ACTUALIZAR STOCK
// ============================================================
function actualizarStock(hoja, carrito) {
  if (hoja.getLastRow() < 2) return;
  const datos = hoja.getRange(2,1,hoja.getLastRow()-1,6).getValues();
  carrito.forEach(item => {
    const idx = datos.findIndex(r => String(r[0]) === String(item.id));
    if (idx >= 0) {
      hoja.getRange(idx+2,6).setValue(Math.max(0, parseInt(datos[idx][5])-item.cantidad));
    }
  });
}

// ============================================================
// GENERAR PDF
// ============================================================
function generarPDF(nPedido, cliente, carrito, subtotal, iva, total, fecha) {
  const fechaStr = Utilities.formatDate(fecha,'America/Caracas','dd/MM/yyyy HH:mm');
  let filas = '';
  carrito.forEach((item,i) => {
    filas += `<tr style="background:${i%2===0?'#1a1a1a':'#242424'}">
      <td style="padding:10px 14px;color:#e0e0e0;font-size:13px">${item.nombre}</td>
      <td style="padding:10px 14px;color:#aaa;font-size:13px;text-align:center">${item.cantidad}</td>
      <td style="padding:10px 14px;color:#CC0000;font-size:13px;text-align:right;font-weight:bold">$${parseFloat(item.precio).toFixed(2)}</td>
      <td style="padding:10px 14px;color:#fff;font-size:13px;text-align:right;font-weight:bold">$${(item.precio*item.cantidad).toFixed(2)}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Open Sans',sans-serif;background:#0d0d0d;color:#e0e0e0}
.page{width:794px;min-height:1123px;margin:0 auto;background:#111;padding:50px}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:36px;padding-bottom:24px;border-bottom:3px solid #CC0000}
.logo img{height:70px}.co{text-align:right}.cn{font-size:28px;color:#CC0000;font-weight:700;letter-spacing:3px}
.cs{font-size:11px;color:#888;margin-top:4px;line-height:1.6}
.dt{background:linear-gradient(135deg,#CC0000,#990000);border-radius:8px;padding:18px 28px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center}
.dt h1{font-size:26px;color:#fff;font-weight:700;letter-spacing:4px}.dt .num{font-size:14px;color:rgba(255,255,255,.8)}
.ig{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
.ib{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:18px}
.ib h3{font-size:13px;color:#CC0000;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;border-bottom:1px solid #2a2a2a;padding-bottom:6px}
.ib p{font-size:12px;color:#ccc;line-height:1.8}.ib strong{color:#fff}
table{width:100%;border-collapse:collapse;margin-bottom:20px;border-radius:8px;overflow:hidden}
thead tr{background:#CC0000}thead th{padding:12px 14px;font-size:13px;color:#fff;text-align:left;letter-spacing:1.5px;text-transform:uppercase}
.tot{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px 24px;width:280px;margin-left:auto}
.tr{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#aaa;border-bottom:1px solid #222}
.tr:last-child{border:none;font-size:17px;font-weight:700;color:#CC0000;margin-top:8px;padding-top:10px}
.ft{margin-top:40px;padding-top:20px;border-top:1px solid #2a2a2a;text-align:center}
.ft p{font-size:11px;color:#555;line-height:1.8}.ft .th{font-size:16px;color:#CC0000;letter-spacing:3px;margin-bottom:8px}
.badge{display:inline-block;background:#CC0000;color:#fff;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:1px;margin-top:10px}
</style></head><body><div class="page">
<div class="header"><div class="logo"><img src="${LOGO_URL}" alt="AM"></div>
<div class="co"><div class="cn">ACTIVO MOTORS</div><div class="cs">San Diego, Valle Verde<br>Av. Don Julio Centeno<br>Tlf: 0412-2004902</div></div></div>
<div class="dt"><h1>FACTURA / PEDIDO</h1><div class="num"><strong style="color:#fff">N° ${nPedido}</strong><br><span style="font-size:12px">${fechaStr}</span></div></div>
<div class="ig">
<div class="ib"><h3>Datos del Cliente</h3><p><strong>${cliente.nombre}</strong><br>${cliente.email}<br>${cliente.telefono}<br>${cliente.direccion}</p></div>
<div class="ib"><h3>Detalles del Pedido</h3><p><strong>N° Pedido:</strong> ${nPedido}<br><strong>Fecha:</strong> ${fechaStr}<br><strong>Estado:</strong> <span style="color:#4CAF50;font-weight:600">✔ CONFIRMADO</span><br><strong>Pago:</strong> Por Acordar</p></div>
</div>
<table><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${filas}</tbody></table>
<div class="tot">
<div class="tr"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
<div class="tr"><span>IVA (16%)</span><span>$${iva.toFixed(2)}</span></div>
<div class="tr"><span>TOTAL A PAGAR</span><span>$${total.toFixed(2)}</span></div>
</div>
<div class="ft"><div class="th">¡GRACIAS POR TU PREFERENCIA!</div>
<p>Pedido coordinado directamente con nuestro equipo.<br><strong style="color:#CC0000">0412-2004902</strong> · ACTIVO MOTORS, San Diego</p>
<div class="badge">ACTIVO MOTORS · REPUESTOS AUTOMOTRICES</div></div>
</div></body></html>`;

  const blob = Utilities.newBlob(html,'text/html','factura.html');
  const tmp = DriveApp.createFile(blob);
  const pdf = tmp.getAs('application/pdf').setName(`Pedido_${nPedido}.pdf`);
  tmp.setTrashed(true);
  return pdf;
}

// ============================================================
// ENVIAR CORREO
// ============================================================
function enviarCorreo(cliente, nPedido, pdfBlob, subtotal, iva, total, carrito, fecha) {
  const fechaStr = Utilities.formatDate(fecha,'America/Caracas','dd/MM/yyyy HH:mm');
  let items = '';
  carrito.forEach(item => {
    items += `<tr><td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;color:#ddd;font-size:14px">${item.nombre}</td>
    <td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;color:#aaa;text-align:center;font-size:14px">${item.cantidad}</td>
    <td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;color:#CC0000;font-weight:700;text-align:right;font-size:14px">$${(item.precio*item.cantidad).toFixed(2)}</td></tr>`;
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif}
.w{max-width:640px;margin:30px auto;background:#111;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a}
.tb{background:#CC0000;height:6px}.hd{padding:32px 40px;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;gap:20px}
.cn{font-size:24px;color:#CC0000;font-weight:800;letter-spacing:4px}.cs{font-size:12px;color:#888;margin-top:3px}
.hero{background:linear-gradient(135deg,#1a1a1a,#111);padding:40px;text-align:center;border-bottom:1px solid #2a2a2a}
.hero h1{color:#fff;font-size:28px;font-weight:700;margin-bottom:8px}.hero p{color:#888;font-size:15px}
.bk{display:inline-block;background:#CC0000;color:#fff;padding:8px 24px;border-radius:30px;font-size:13px;font-weight:700;letter-spacing:2px;margin-top:16px}
.sec{padding:28px 40px}.sec h3{color:#CC0000;font-size:13px;letter-spacing:3px;text-transform:uppercase;margin-bottom:14px;border-bottom:1px solid #2a2a2a;padding-bottom:8px}
.ir{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid #1e1e1e}
.ir span:first-child{color:#888}.ir span:last-child{color:#ddd;font-weight:600}
table{width:100%;border-collapse:collapse}thead th{background:#CC0000;color:#fff;padding:10px 16px;text-align:left;font-size:13px}
.tb2{background:#1a1a1a;margin:0 40px 28px;border-radius:8px;padding:16px 20px;border:1px solid #2a2a2a}
.tr2{display:flex;justify-content:space-between;padding:5px 0;font-size:14px;color:#aaa;border-bottom:1px solid #222}
.tr2:last-child{border:none;font-size:18px;font-weight:700;color:#CC0000;padding-top:10px;margin-top:4px}
.ft2{background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #2a2a2a}
.ft2 p{color:#555;font-size:12px;line-height:1.8}
</style></head><body><div class="w">
<div class="tb"></div>
<div class="hd"><img src="${LOGO_URL}" height="55" alt="AM"><div><div class="cn">ACTIVO MOTORS</div><div class="cs">Repuestos Automotrices · San Diego, Valle Verde</div></div></div>
<div class="hero"><h1>¡Pedido Confirmado!</h1><p>Hola <strong style="color:#fff">${cliente.nombre}</strong>, hemos recibido tu pedido.</p><div class="bk">✔ CONFIRMADO</div></div>
<div class="sec"><h3>Información del Pedido</h3>
<div class="ir"><span>N° de Pedido</span><span style="color:#CC0000">${nPedido}</span></div>
<div class="ir"><span>Fecha</span><span>${fechaStr}</span></div>
<div class="ir"><span>Cliente</span><span>${cliente.nombre}</span></div>
<div class="ir"><span>Teléfono</span><span>${cliente.telefono}</span></div>
<div class="ir"><span>Dirección</span><span>${cliente.direccion}</span></div></div>
<div class="sec" style="padding-bottom:4px"><h3>Productos Solicitados</h3>
<table><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Total</th></tr></thead>
<tbody style="background:#151515">${items}</tbody></table></div>
<div class="tb2">
<div class="tr2"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
<div class="tr2"><span>IVA (16%)</span><span>$${iva.toFixed(2)}</span></div>
<div class="tr2"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div></div>
<div class="ft2"><p>Nuestro equipo se pondrá en contacto para coordinar el pago y la entrega.<br>
<strong style="color:#CC0000">0412-2004902</strong> · San Diego, Valle Verde, Av. Don Julio Centeno<br>
Adjunto encontrarás la factura en PDF.</p></div>
</div></body></html>`;

  GmailApp.sendEmail(
    cliente.email,
    `✅ Pedido Confirmado ${nPedido} - ACTIVO MOTORS`,
    `Hola ${cliente.nombre},\n\nTu pedido ${nPedido} fue confirmado por $${total.toFixed(2)}.\n\nActivo Motors - 0412-2004902`,
    { htmlBody: html, attachments: [pdfBlob], name: 'ACTIVO MOTORS - Tienda en Línea' }
  );
}
