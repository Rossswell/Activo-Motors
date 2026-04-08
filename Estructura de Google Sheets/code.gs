// ============================================================
// ACTIVO MOTORS - Tienda en Línea
// Google Apps Script - Code.gs
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
// RESPONDER
// ============================================================
function responder(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================================
// doGet — maneja TODAS las acciones via GET (cross-origin seguro)
// ============================================================
function doGet(e) {
  const accion = e.parameter.accion || '';
  try {
    if (accion === 'productos') {
      const cat = e.parameter.categoria || null;
      const marca = e.parameter.marca || null;
      return responder({ ok: true, data: obtenerProductos(cat, marca) });
    }
    if (accion === 'categorias') {
      return responder({ ok: true, data: obtenerCategorias() });
    }
    if (accion === 'registrar') {
      const usuario = JSON.parse(e.parameter.usuario);
      return responder(registrarUsuario(usuario));
    }
    if (accion === 'login') {
      return responder(loginUsuario(e.parameter.email, e.parameter.password));
    }
    if (accion === 'pedido') {
      const cliente = JSON.parse(e.parameter.cliente);
      const carrito = JSON.parse(e.parameter.carrito);
      const cupon   = e.parameter.cupon || null;
      return responder(procesarPedido(cliente, carrito, cupon));
    }
    if (accion === 'loginGoogle') {
      return responder(loginConGoogle(
        e.parameter.googleId,
        e.parameter.nombre,
        e.parameter.email,
        e.parameter.foto || ''
      ));
    }
    if (accion === 'actualizarPerfil') {
      return responder(actualizarPerfil(
        e.parameter.email,
        e.parameter.cedula,
        e.parameter.telefono,
        e.parameter.direccion || ''
      ));
    }
    return responder({ ok: true, mensaje: 'API Activo Motors activa' });
  } catch (err) {
    return responder({ ok: false, error: err.message });
  }
}

// ============================================================
// doPost
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const accion = body.accion || '';

    if (accion === 'pedido') {
      const cliente = typeof body.cliente === 'string' ? JSON.parse(body.cliente) : body.cliente;
      const carrito = typeof body.carrito === 'string' ? JSON.parse(body.carrito) : body.carrito;
      return responder(procesarPedido(cliente, carrito));
    }

    if (accion === 'registrar') {
      const usuario = typeof body.usuario === 'string' ? JSON.parse(body.usuario) : body.usuario;
      return responder(registrarUsuario(usuario));
    }

    if (accion === 'login') {
      return responder(loginUsuario(body.email, body.password));
    }

    if (accion === 'loginGoogle') {
      return responder(loginConGoogle(body.googleId, body.nombre, body.email, body.foto || ''));
    }

    if (accion === 'actualizarPerfil') {
      return responder(actualizarPerfil(body.email, body.cedula, body.telefono, body.direccion || ''));
    }

    return responder({ ok: false, error: 'Acción no reconocida' });
  } catch (err) {
    return responder({ ok: false, error: err.message });
  }
}

// ============================================================
// REGISTRAR USUARIO — contraseña guardada en CLIENTES col I
// ============================================================
function registrarUsuario(usuario) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let hCli = ss.getSheetByName('CLIENTES');
    if (!hCli) {
      hCli = ss.insertSheet('CLIENTES');
      const h = ['ID CLIENTE','NOMBRE','EMAIL','CEDULA','TELÉFONO','DIRECCIÓN','FECHA REGISTRO','TOTAL COMPRAS','CONTRASEÑA'];
      hCli.getRange(1,1,1,h.length).setValues([h]).setBackground('#AE040F').setFontColor('#fff').setFontWeight('bold');
      hCli.setFrozenRows(1);
    }

    // Asegurar que exista el encabezado de CONTRASEÑA en col I
    if (hCli.getLastRow() >= 1) {
      const headerI = hCli.getRange(1,9).getValue();
      if (!headerI || headerI === '') hCli.getRange(1,9).setValue('CONTRASEÑA');
    }

    // Verificar duplicados (buscar en 9 columnas ahora)
    if (hCli.getLastRow() >= 2) {
      const datos = hCli.getRange(2, 1, hCli.getLastRow() - 1, 9).getValues();
      const existeEmail  = datos.find(r => r[2] === usuario.email);
      const existeCedula = datos.find(r => String(r[3]) === String(usuario.cedula));
      if (existeEmail)  return { ok: false, error: 'Ya existe una cuenta con ese correo. Por favor inicia sesión.' };
      if (existeCedula) return { ok: false, error: 'Ya existe una cuenta con esa cédula. Por favor inicia sesión.' };
    }

    const idCliente = 'CLI-' + Utilities.formatDate(new Date(), 'America/Caracas', 'yyyyMMddHHmmss');
    const fechaReg  = Utilities.formatDate(new Date(), 'America/Caracas', 'dd/MM/yyyy HH:mm');

    // Columnas: A=ID | B=NOMBRE | C=EMAIL | D=CEDULA | E=TELÉFONO | F=DIRECCIÓN | G=FECHA | H=TOTAL | I=CONTRASEÑA
    hCli.appendRow([
      idCliente,
      usuario.nombre,
      usuario.email,
      usuario.cedula,
      usuario.telefono,
      usuario.direccion || '',
      fechaReg,
      '0.00',
      usuario.password   // ← contraseña en columna I
    ]);

    return {
      ok: true,
      usuario: { id: idCliente, nombre: usuario.nombre, email: usuario.email,
                 cedula: usuario.cedula, telefono: usuario.telefono, direccion: usuario.direccion || '' }
    };
  } catch (e) {
    Logger.log('Error registrarUsuario: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// LOGIN USUARIO — verifica contra CLIENTES col I (contraseña)
// ============================================================
function loginUsuario(email, password) {
  try {
    const ss  = SpreadsheetApp.openById(SHEET_ID);
    const hCli = ss.getSheetByName('CLIENTES');
    if (!hCli || hCli.getLastRow() < 2) {
      return { ok: false, error: 'No existe ninguna cuenta registrada aún.' };
    }

    // Leer 9 columnas: A-I (incluye contraseña en col I = índice 8)
    const datos = hCli.getRange(2, 1, hCli.getLastRow() - 1, 9).getValues();
    const fila  = datos.find(r => r[2] === email);

    if (!fila) {
      return { ok: false, error: 'No existe una cuenta con ese correo.' };
    }
    // col I = índice 8 = contraseña
    if (String(fila[8]) !== String(password)) {
      return { ok: false, error: 'Correo o contraseña incorrectos.' };
    }

    return {
      ok: true,
      usuario: {
        id: fila[0], nombre: fila[1], email: fila[2],
        cedula: fila[3], telefono: fila[4], direccion: fila[5]
      }
    };
  } catch (e) {
    Logger.log('Error loginUsuario: ' + e.message);
    return { ok: false, error: e.message };
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
  if (hProd.getLastRow() < 1) {
    const hP = ['ID','NOMBRE','CATEGORÍA','DESCRIPCIÓN','MARCA','PRECIO','STOCK','IMAGEN_URL','ACTIVO'];
    hProd.getRange(1,1,1,hP.length).setValues([hP]);
    hProd.getRange(1,1,1,hP.length).setBackground('#CC0000').setFontColor('#fff').setFontWeight('bold');
    hProd.setFrozenRows(1);
  }

  // PEDIDOS
  let hPed = ss.getSheetByName('PEDIDOS');
  if (!hPed) hPed = ss.insertSheet('PEDIDOS');
  if (hPed.getLastRow() < 1) {
    const hPedH = ['N° PEDIDO','FECHA','HORA','CLIENTE','EMAIL','CEDULA','TELÉFONO','DIRECCIÓN','PRODUCTOS','SUBTOTAL','DESCUENTO','TOTAL','ESTADO'];
    hPed.getRange(1,1,1,hPedH.length).setValues([hPedH]);
    hPed.getRange(1,1,1,hPedH.length).setBackground('#1a1a1a').setFontColor('#fff').setFontWeight('bold');
    hPed.setFrozenRows(1);
  }

  // CLIENTES
  let hCli = ss.getSheetByName('CLIENTES');
  if (!hCli) hCli = ss.insertSheet('CLIENTES');
  if (hCli.getLastRow() < 1) {
    const hCliH = ['ID CLIENTE','NOMBRE','EMAIL','CEDULA','TELÉFONO','DIRECCIÓN','FECHA REGISTRO','TOTAL COMPRAS'];
    hCli.getRange(1,1,1,hCliH.length).setValues([hCliH]);
    hCli.getRange(1,1,1,hCliH.length).setBackground('#CC0000').setFontColor('#fff').setFontWeight('bold');
    hCli.setFrozenRows(1);
  }

  // PEDIDOS MANUALES
  let hPedMan = ss.getSheetByName('PEDIDOS MANUALES');
  if (!hPedMan) hPedMan = ss.insertSheet('PEDIDOS MANUALES');
  if (hPedMan.getLastRow() < 1) {
    const hPedManH = ['N° PEDIDO','FECHA','CLIENTE','TELÉFONO','PRODUCTOS','SUBTOTAL','TOTAL','ESTADO','NOTAS'];
    hPedMan.getRange(1,1,1,hPedManH.length).setValues([hPedManH]);
    hPedMan.getRange(1,1,1,hPedManH.length).setBackground('#1a1a1a').setFontColor('#fff').setFontWeight('bold');
    hPedMan.setFrozenRows(1);
  }

  // CUPONES
  let hCup = ss.getSheetByName('CUPONES');
  if (!hCup) hCup = ss.insertSheet('CUPONES');
  if (hCup.getLastRow() < 1) {
    const hCupH = ['CÓDIGO','VALIDO DESDE','VALIDO HASTA','RESTAR $','CANJEADO'];
    hCup.getRange(1,1,1,hCupH.length).setValues([hCupH]);
    hCup.getRange(1,1,1,hCupH.length).setBackground('#1a1a1a').setFontColor('#fff').setFontWeight('bold');
    hCup.setFrozenRows(1);
  }

  return { ok: true, mensaje: 'Hojas verificadas correctamente.' };
}

// ============================================================
// OBTENER PRODUCTOS
// ============================================================
function obtenerProductos(categoria, marca) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName('PRODUCTOS');
    if (!hoja || hoja.getLastRow() < 2) return [];

    const headerRow = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    const hasMarca = headerRow[4] && headerRow[4].toString().toUpperCase() === 'MARCA';
    const numCols = hasMarca ? 9 : 8;

    let prods = hoja.getRange(2, 1, hoja.getLastRow() - 1, numCols).getValues()
      .filter(r => r[0] !== '')
      .filter(r => {
        const activo = hasMarca ? r[8] : r[7];
        return activo === 'SI' || activo === true || activo === 1;
      })
      .map(r => {
        if (hasMarca) {
          return {
            id:          String(r[0]),
            nombre:      r[1],
            categoria:   r[2],
            descripcion: r[3],
            marca:       r[4] || '',
            precio:      parseFloat(r[5]) || 0,
            stock:       parseInt(r[6])   || 0,
            imagen:      r[7] || LOGO_URL
          };
        } else {
          const nombreLower = String(r[1]).toLowerCase();
          let marcaInferida = '';
          if (nombreLower.includes('toyota') || nombreLower.includes('hilux') || nombreLower.includes('corolla') || nombreLower.includes('yaris') || nombreLower.includes('fortuner') || nombreLower.includes('prado') || nombreLower.includes('avanza') || nombreLower.includes('4runner')) {
            marcaInferida = 'Toyota';
          } else if (nombreLower.includes('mitsubishi') || nombreLower.includes('lancer') || nombreLower.includes('montero') || nombreLower.includes('signo')) {
            marcaInferida = 'Mitsubishi';
          }
          return {
            id:          String(r[0]),
            nombre:      r[1],
            categoria:   r[2],
            descripcion: r[3],
            marca:       marcaInferida,
            precio:      parseFloat(r[4]) || 0,
            stock:       parseInt(r[5])   || 0,
            imagen:      r[6] || LOGO_URL
          };
        }
      });

    if (categoria && categoria !== 'TODOS') {
      prods = prods.filter(p => p.categoria.toUpperCase() === categoria.toUpperCase());
    }
    if (marca && marca !== 'TODOS') {
      prods = prods.filter(p => p.marca.toUpperCase() === marca.toUpperCase());
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
function procesarPedido(cliente, carrito, codigoCupon) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const hPed  = ss.getSheetByName('PEDIDOS');
    const hCli  = ss.getSheetByName('CLIENTES');
    if (!hPed) return { ok: false, error: 'Hoja PEDIDOS no encontrada.' };

    const ahora = new Date();
    const nPedido = 'PED-' + Utilities.formatDate(ahora,'America/Caracas','yyyyMMdd') + '-' + Math.floor(Math.random()*9000+1000);

    let subtotal = 0;
    const resumen = [];
    carrito.forEach(item => {
      subtotal += item.precio * item.cantidad;
      resumen.push(`• ${item.nombre} x${item.cantidad} ($${(item.precio*item.cantidad).toFixed(2)})`);
    });

    let descuento = 0;
    let cuponUsado = '';
    if (codigoCupon) {
      const resCupon = validarCupon(codigoCupon);
      if (resCupon.ok) {
        descuento = parseFloat(resCupon.monto) || 0;
        cuponUsado = codigoCupon.toUpperCase();
        marcarCuponCanjeado(codigoCupon);
      }
    }
    const total = Math.max(0, subtotal - descuento);

    hPed.appendRow([
      nPedido,
      Utilities.formatDate(ahora,'America/Caracas','dd/MM/yyyy'),
      Utilities.formatDate(ahora,'America/Caracas','HH:mm'),
      cliente.nombre, cliente.email, cliente.cedula || 'N/A', cliente.telefono, cliente.direccion || 'No especificada',
      resumen.join('\n'),
      subtotal.toFixed(2), descuento > 0 ? `-$${descuento.toFixed(2)}${cuponUsado?' ('+cuponUsado+')':''}` : '$0.00', total.toFixed(2),
      'CONFIRMADO'
    ]);

    if (hCli) actualizarTotalCliente(hCli, cliente, total);

    try {
      const pdfBlob = generarPDF(nPedido, cliente, carrito, subtotal, descuento, total, cuponUsado, ahora);
      enviarCorreo(cliente, nPedido, pdfBlob, subtotal, descuento, total, cuponUsado, carrito, ahora);
    } catch(emailErr) {
      Logger.log('Error email/PDF (no crítico): ' + emailErr.message);
    }

    return { ok: true, success: true, numeroPedido: nPedido, total: total.toFixed(2) };
  } catch(e) {
    Logger.log('Error procesarPedido: ' + e.message);
    return { ok: false, success: false, error: e.message };
  }
}

// ============================================================
// VALIDAR CUPÓN
// ============================================================
function validarCupon(codigo) {
  try {
    if (!codigo) return { ok: false, error: 'Código de cupón vacío' };
    const ss   = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName('CUPONES');
    if (!hoja || hoja.getLastRow() < 2) return { ok: false, error: 'Cupón no válido' };

    const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, 5).getValues();
    const fila = datos.find(r => String(r[0]).trim().toUpperCase() === codigo.trim().toUpperCase());

    if (!fila) return { ok: false, error: 'Cupón no válido' };

    const canjeado = String(fila[4]).trim().toUpperCase();
    if (canjeado === 'SI' || canjeado === 'TRUE') {
      return { ok: false, error: 'Este cupón ya fue reclamado' };
    }

    const monto = parseFloat(fila[3]) || 0;
    return { ok: true, monto: monto, codigo: codigo.trim().toUpperCase() };
  } catch(e) {
    return { ok: false, error: 'Error al validar el cupón' };
  }
}

// ============================================================
// MARCAR CUPÓN COMO CANJEADO
// ============================================================
function marcarCuponCanjeado(codigo) {
  try {
    const ss   = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName('CUPONES');
    if (!hoja || hoja.getLastRow() < 2) return;
    const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, 5).getValues();
    const idx   = datos.findIndex(r => String(r[0]).trim().toUpperCase() === codigo.trim().toUpperCase());
    if (idx >= 0) hoja.getRange(idx + 2, 5).setValue('SI');
  } catch(e) {}
}

// ============================================================
// ACTUALIZAR TOTAL CLIENTE
// ============================================================
function actualizarTotalCliente(hoja, cliente, total) {
  if (hoja.getLastRow() < 2) return;
  const datos = hoja.getRange(2,1,hoja.getLastRow()-1,8).getValues();
  const idx = datos.findIndex(r => r[2] === cliente.email);
  if (idx >= 0) {
    hoja.getRange(idx+2, 8).setValue((parseFloat(datos[idx][7]||0)+total).toFixed(2));
  }
}

// ============================================================
// GENERAR PDF
// ============================================================
function generarPDF(nPedido, cliente, carrito, subtotal, descuento, total, cuponUsado, fecha) {
  const fechaStr = Utilities.formatDate(fecha,'America/Caracas','dd/MM/yyyy HH:mm');
  let filas = '';
  carrito.forEach((item,i) => {
    filas += `<tr style="background:${i%2===0?'#fff5f5':'#fff'}">
      <td style="padding:10px 14px;color:#333;font-size:13px">${item.nombre}</td>
      <td style="padding:10px 14px;color:#666;font-size:13px;text-align:center">${item.cantidad}</td>
      <td style="padding:10px 14px;color:#CC0000;font-size:13px;text-align:right;font-weight:bold">$${parseFloat(item.precio).toFixed(2)}</td>
      <td style="padding:10px 14px;color:#333;font-size:13px;text-align:right;font-weight:bold">$${(item.precio*item.cantidad).toFixed(2)}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Open Sans',sans-serif;background:#fff;color:#333}
.page{width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:50px}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:36px;padding-bottom:24px;border-bottom:3px solid #CC0000}
.logo img{height:70px}.co{text-align:right}.cn{font-size:28px;color:#CC0000;font-weight:700;letter-spacing:3px}
.cs{font-size:11px;color:#888;margin-top:4px;line-height:1.6}
.dt{background:linear-gradient(135deg,#CC0000,#990000);border-radius:8px;padding:18px 28px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center}
.dt h1{font-size:26px;color:#fff;font-weight:700;letter-spacing:4px}.dt .num{font-size:14px;color:rgba(255,255,255,.8)}
.ig{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
.ib{background:#fff5f5;border:1px solid #ffd0d0;border-radius:8px;padding:18px}
.ib h3{font-size:13px;color:#CC0000;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;border-bottom:1px solid #ffd0d0;padding-bottom:6px}
.ib p{font-size:12px;color:#555;line-height:1.8}.ib strong{color:#333}
table{width:100%;border-collapse:collapse;margin-bottom:20px;border-radius:8px;overflow:hidden;border:1px solid #ffd0d0}
thead tr{background:#CC0000}thead th{padding:12px 14px;font-size:13px;color:#fff;text-align:left;letter-spacing:1.5px;text-transform:uppercase}
.tot{background:#fff5f5;border:1px solid #ffd0d0;border-radius:8px;padding:20px 24px;width:280px;margin-left:auto}
.tr{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#666;border-bottom:1px solid #ffd0d0}
.tr:last-child{border:none;font-size:17px;font-weight:700;color:#CC0000;margin-top:8px;padding-top:10px}
.ft{margin-top:40px;padding-top:20px;border-top:1px solid #ffd0d0;text-align:center}
.ft p{font-size:11px;color:#888;line-height:1.8}.ft .th{font-size:16px;color:#CC0000;letter-spacing:3px;margin-bottom:8px}
.badge{display:inline-block;background:#CC0000;color:#fff;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:1px;margin-top:10px}
</style></head><body><div class="page">
<div class="header"><div class="logo"><img src="${LOGO_URL}" alt="AM"></div>
<div class="co"><div class="cn">ACTIVO MOTORS</div><div class="cs">San Diego, Valle Verde<br>Av. Don Julio Centeno<br>Tlf: 0412-2004902</div></div></div>
<div class="dt"><h1>FACTURA / PEDIDO</h1><div class="num"><strong style="color:#fff">N° ${nPedido}</strong><br><span style="font-size:12px">${fechaStr}</span></div></div>
<div class="ig">
<div class="ib"><h3>Datos del Cliente</h3><p><strong>${cliente.nombre}</strong><br>${cliente.email}<br>${cliente.telefono}<br>${cliente.direccion||'No especificada'}</p></div>
<div class="ib"><h3>Detalles del Pedido</h3><p><strong>N° Pedido:</strong> ${nPedido}<br><strong>Fecha:</strong> ${fechaStr}<br><strong>Estado:</strong> <span style="color:#4CAF50;font-weight:600">✔ CONFIRMADO</span><br><strong>Pago:</strong> Por Acordar</p></div>
</div>
<table><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${filas}</tbody></table>
<div class="tot">
<div class="tr"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
<div class="tr"><span>Descuento${cuponUsado?' ('+cuponUsado+')':''}</span><span style="color:#22c55e">-$${descuento.toFixed(2)}</span></div>
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
function enviarCorreo(cliente, nPedido, pdfBlob, subtotal, descuento, total, cuponUsado, carrito, fecha) {
  const fechaStr = Utilities.formatDate(fecha,'America/Caracas','dd/MM/yyyy HH:mm');
  let items = '';
  carrito.forEach(item => {
    items += `<tr><td style="padding:10px 16px;border-bottom:1px solid #ffd0d0;color:#333;font-size:14px">${item.nombre}</td>
    <td style="padding:10px 16px;border-bottom:1px solid #ffd0d0;color:#666;text-align:center;font-size:14px">${item.cantidad}</td>
    <td style="padding:10px 16px;border-bottom:1px solid #ffd0d0;color:#CC0000;font-weight:700;text-align:right;font-size:14px">$${(item.precio*item.cantidad).toFixed(2)}</td></tr>`;
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{margin:0;padding:0;background:#fff5f5;font-family:'Segoe UI',Arial,sans-serif}
.w{max-width:640px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ffd0d0}
.tb{background:#CC0000;height:6px}
.hd{padding:32px 40px;border-bottom:1px solid #ffd0d0;display:flex;align-items:center;gap:20px;background:#fff5f5}
.cn{font-size:24px;color:#CC0000;font-weight:800;letter-spacing:4px}.cs{font-size:12px;color:#888;margin-top:3px}
.hero{background:linear-gradient(135deg,#CC0000,#990000);padding:40px;text-align:center}
.hero h1{color:#fff;font-size:28px;font-weight:700;margin-bottom:8px}.hero p{color:rgba(255,255,255,0.8);font-size:15px}
.bk{display:inline-block;background:#fff;color:#CC0000;padding:8px 24px;border-radius:30px;font-size:13px;font-weight:700;letter-spacing:2px;margin-top:16px}
.sec{padding:28px 40px}.sec h3{color:#CC0000;font-size:13px;letter-spacing:3px;text-transform:uppercase;margin-bottom:14px;border-bottom:1px solid #ffd0d0;padding-bottom:8px}
.ir{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid #fff0f0}
.ir span:first-child{color:#888}.ir span:last-child{color:#333;font-weight:600}
table{width:100%;border-collapse:collapse}thead th{background:#CC0000;color:#fff;padding:10px 16px;text-align:left;font-size:13px}
.tb2{background:#fff5f5;margin:0 40px 28px;border-radius:8px;padding:16px 20px;border:1px solid #ffd0d0}
.tr2{display:flex;justify-content:space-between;padding:5px 0;font-size:14px;color:#666;border-bottom:1px solid #ffd0d0}
.tr2:last-child{border:none;font-size:18px;font-weight:700;color:#CC0000;padding-top:10px;margin-top:4px}
.ft2{background:#fff5f5;padding:24px 40px;text-align:center;border-top:1px solid #ffd0d0}
.ft2 p{color:#888;font-size:12px;line-height:1.8}
</style></head><body><div class="w">
<div class="tb"></div>
<div class="hd"><img src="${LOGO_URL}" height="55" alt="AM"><div><div class="cn">ACTIVO MOTORS</div><div class="cs">Repuestos Automotrices · San Diego, Valle Verde</div></div></div>
<div class="hero"><h1>¡Pedido Confirmado!</h1><p>Hola <strong>${cliente.nombre}</strong>, hemos recibido tu pedido.</p><div class="bk">✔ CONFIRMADO</div></div>
<div class="sec"><h3>Información del Pedido</h3>
<div class="ir"><span>N° de Pedido</span><span style="color:#CC0000">${nPedido}</span></div>
<div class="ir"><span>Fecha</span><span>${fechaStr}</span></div>
<div class="ir"><span>Cliente</span><span>${cliente.nombre}</span></div>
<div class="ir"><span>Teléfono</span><span>${cliente.telefono}</span></div>
<div class="ir"><span>Dirección</span><span>${cliente.direccion||'No especificada'}</span></div></div>
<div class="sec" style="padding-bottom:4px"><h3>Productos Solicitados</h3>
<table><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Total</th></tr></thead>
<tbody style="background:#fff">${items}</tbody></table></div>
<div class="tb2">
<div class="tr2"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
<div class="tr2"><span>Descuento${cuponUsado?' ('+cuponUsado+')':''}</span><span style="color:#22c55e">-$${descuento.toFixed(2)}</span></div>
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

// ============================================================
// LOGIN / REGISTRO CON GOOGLE
// ============================================================
function loginConGoogle(googleId, nombre, email, foto) {
  try {
    const ss   = SpreadsheetApp.openById(SHEET_ID);
    let hCli   = ss.getSheetByName('CLIENTES');
    if (!hCli) {
      hCli = ss.insertSheet('CLIENTES');
      const h = ['ID CLIENTE','NOMBRE','EMAIL','CEDULA','TELÉFONO',
                 'DIRECCIÓN','FECHA REGISTRO','TOTAL COMPRAS','CONTRASEÑA'];
      hCli.getRange(1,1,1,h.length).setValues([h])
          .setBackground('#AE040F').setFontColor('#fff').setFontWeight('bold');
      hCli.setFrozenRows(1);
    }

    // Buscar si ya existe por email
    if (hCli.getLastRow() >= 2) {
      const datos = hCli.getRange(2,1,hCli.getLastRow()-1,9).getValues();
      const idx   = datos.findIndex(r => r[2] === email);
      
      if (idx >= 0) {
        const fila = datos[idx];
        const passActual = String(fila[8]);

        // Si ya existe pero no tiene el marcador "Google", lo actualizamos si viene por Google
        if (passActual === 'GOOGLE_AUTH' || passActual === '') {
          hCli.getRange(idx + 2, 9).setValue('Google');
        }

        return {
          ok: true,
          usuario: {
            id: fila[0], nombre: fila[1], email: fila[2],
            cedula: fila[3], telefono: fila[4], direccion: fila[5]
          }
        };
      }
    }

    // No existe → crear cuenta automáticamente
    const idCliente = 'CLI-G-' + Utilities.formatDate(
      new Date(), 'America/Caracas', 'yyyyMMddHHmmss');
    const fechaReg  = Utilities.formatDate(
      new Date(), 'America/Caracas', 'dd/MM/yyyy HH:mm');

    hCli.appendRow([
      idCliente, nombre, email,
      '', '',          // cédula y teléfono vacíos (puede completar luego)
      '',              // dirección
      fechaReg, '0.00',
      'Google'         // Marcador de cuenta Google
    ]);

    return {
      ok: true,
      esNuevo: true,
      usuario: {
        id: idCliente, nombre, email,
        cedula: '', telefono: '', direccion: ''
      }
    };
  } catch(e) {
    Logger.log('Error loginConGoogle: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ============================================================
// ACTUALIZAR PERFIL (Cédula, Teléfono, Dirección)
// ============================================================
function actualizarPerfil(email, cedula, telefono, direccion) {
  try {
    const ss   = SpreadsheetApp.openById(SHEET_ID);
    const hCli = ss.getSheetByName('CLIENTES');
    if (!hCli) return { ok: false, error: 'Hoja CLIENTES no encontrada' };

    const datos = hCli.getRange(2, 1, hCli.getLastRow() - 1, 9).getValues();
    const idx   = datos.findIndex(r => r[2] === email);

    if (idx < 0) return { ok: false, error: 'Usuario no encontrado' };

    // Actualizar columnas D (4), E (5) y F (6)
    if (cedula)    hCli.getRange(idx + 2, 4).setValue(cedula);
    if (telefono)  hCli.getRange(idx + 2, 5).setValue(telefono);
    if (direccion) hCli.getRange(idx + 2, 6).setValue(direccion);

    return { ok: true, mensaje: 'Perfil actualizado correctamente' };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}