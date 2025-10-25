/***** CONFIG *****/
const SHEET_NAME = 'Hoja 1';              // nombre de tu hoja principal
const STOCK_COL = 3;                      // Columna C
const HEADER_ROWS = 1;
const BACKUP_LOG_SHEET = 'Backup_Log';
const SHADOW_SHEET = 'Shadow_Snapshot';   // espejo de seguridad
const SALES_SHEET = 'Ventas';             // registro de ventas
const ADMIN_EMAIL = 'gaston.huerta.14@gmail.com';

/***** MENÚ *****/
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // Menú de stock
  ui.createMenu('🔒 Control de Stock')
    .addItem('1) Configurar protecciones', 'setupProtections')
    .addItem('2) Crear/actualizar Shadow + Backup_Log + Ventas', 'initSafetySheets')
    .addItem('3) Snapshot manual ahora', 'backupSnapshot')
    .addItem('4) Crear/actualizar backup diario', 'createDailyBackupTrigger')
    .addToUi();
  
  // Menú de catálogo
  ui.createMenu('🧾 Catálogo PDF')
    .addItem('Exportar (Prod + Precio, fondo 1024×1536)', 'exportCatalogoProdPrecioPdf')
    .addToUi();

    // Menú de VENTAS (no interfiere con los tuyos)
ui.createMenu('🧪 Vapes')
  .addItem('Abrir panel de ventas', 'openVapesPanel')
  .addToUi();

}
function openVapesPanel() {
  const html = HtmlService.createTemplateFromFile('ui')
    .evaluate()
    .setTitle('Ventas de Vapes')
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

/***** PROTECCIONES *****/
function setupProtections() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`No encuentro la hoja ${SHEET_NAME}`);

  // Limpio protecciones previas
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => p.remove());
  sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());

  // Protejo hoja completa solo admin
  const prot = sheet.protect();
  prot.setDescription('Protección total solo admin');
  prot.setWarningOnly(false);
  prot.removeEditors(prot.getEditors());
  prot.addEditor(ADMIN_EMAIL);

  // Desprotejo SOLO la col C (desde la primera fila de datos)
  refreshUnprotectedRange_();

  // Validación en C: números >= 0
  const lastRow = Math.max(sheet.getLastRow(), HEADER_ROWS + 1);
  const rangeStock = sheet.getRange(HEADER_ROWS + 1, STOCK_COL, lastRow - HEADER_ROWS, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(false)
    .build();
  rangeStock.setDataValidation(rule);

  initSafetySheets();
  SpreadsheetApp.getUi().alert('Protecciones aplicadas y hojas de seguridad listas.');
}

/***** BACKUP LOG + SHADOW + VENTAS *****/
function initSafetySheets() {
  ensureBackupLogSheet();
  ensureShadowSheet_();
  ensureSalesSheet_();
  shadowFullRefresh_(); // foto completa inicial
}

function ensureBackupLogSheet() {
  const ss = SpreadsheetApp.getActive();
  let log = ss.getSheetByName(BACKUP_LOG_SHEET);
  if (!log) {
    log = ss.insertSheet(BACKUP_LOG_SHEET);
    log.getRange(1,1,1,8).setValues([[
      'timestamp','user','sheet','row','col','producto','oldValue','newValue'
    ]]);
  }
  return log;
}

function ensureShadowSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHADOW_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHADOW_SHEET);
  } else {
    sh.clear();
  }
  return sh;
}

// NUEVO: hoja de Ventas
function ensureSalesSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SALES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SALES_SHEET);
    sh.getRange(1,1,1,9).setValues([[
      'timestamp','user','producto','precio_unitario','cantidad','subtotal','stock_old','stock_new','fila'
    ]]);
  }
  return sh;
}

function shadowFullRefresh_() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const shadow = ss.getSheetByName(SHADOW_SHEET) || ensureShadowSheet_();
  shadow.clear();
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  if (lastRow > 0 && lastCol > 0) {
    const values = sheet.getRange(1,1,lastRow,lastCol).getValues();
    shadow.getRange(1,1,lastRow,lastCol).setValues(values);
  }
}

function logChange({user, sheetName, row, col, producto, oldValue, newValue}) {
  const log = ensureBackupLogSheet();
  log.appendRow([
    new Date(), user || '', sheetName, row, col, producto || '', oldValue ?? '', newValue ?? ''
  ]);
}

// NUEVO: log de ventas
function logSales_(sheet, startRow, numRows, oldVals, newVals, userEmail) {
  const sales = ensureSalesSheet_();
  const now = new Date();
  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    const oldV = Number(oldVals[i][0]);
    const newV = Number(newVals[i][0]);
    if (!isNaN(oldV) && !isNaN(newV) && newV < oldV) {
      const qty = oldV - newV;
      const producto = sheet.getRange(row, 1).getValue();        // col A
      const precio = Number(sheet.getRange(row, 2).getValue());  // col B
      const subtotal = precio * qty;
      sales.appendRow([
        now, (userEmail || 'anon'), producto, precio, qty, subtotal, oldV, newV, row
      ]);
    }
  }
}

/***** EDIT & CHANGE GUARD *****/
function onEdit(e) {
  const ss = e.source;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const userEmail = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const isAdmin = userEmail === ADMIN_EMAIL.toLowerCase();

  const r = e.range;
  const nRows = r.getNumRows();
  const nCols = r.getNumColumns();
  const startRow = r.getRow();
  const startCol = r.getColumn();

  const touchesOutsideC = !(startCol === STOCK_COL && nCols === 1);
  if (!isAdmin && touchesOutsideC) {
    restoreFromShadow_(sheet, r);
    ss.toast('Solo Columna C editable por no-admin. Cambios revertidos.', 'Bloqueado', 3);
    return;
  }

  if (startCol === STOCK_COL && nCols === 1 && !isAdmin) {
    const currentVals = r.getValues();
    const shadowVals = getShadowRange_(startRow, STOCK_COL, nRows, 1).getValues();

    for (let i = 0; i < nRows; i++) {
      const oldV = Number(shadowVals[i][0]);
      const newVraw = currentVals[i][0];
      const newVnum = Number(newVraw);
      if (newVraw === '' || isNaN(newVnum)) {
        currentVals[i][0] = oldV;
      } else if (newVnum > oldV) {
        currentVals[i][0] = oldV;
      } else if (newVnum < 0) {
        currentVals[i][0] = 0;
      } else {
        currentVals[i][0] = newVnum;
      }
    }

    logSales_(sheet, startRow, nRows, shadowVals, currentVals, userEmail || 'anon');
    r.setValues(currentVals);
    updateShadowRange_(startRow, STOCK_COL, currentVals);

    for (let i=0;i<nRows;i++){
      const row = startRow + i;
      const producto = sheet.getRange(row, 1).getValue();
      const oldV = shadowVals[i][0];
      const newV = currentVals[i][0];
      if (oldV !== newV) {
        logChange({
          user: userEmail || 'anon', sheetName: SHEET_NAME,
          row, col: STOCK_COL, producto, oldValue: oldV, newValue: newV
        });
      }
    }
    return;
  }

  if (isAdmin) {
    const newVals = r.getValues();
    if (startCol === STOCK_COL && nCols === 1) {
      const shadowVals = getShadowRange_(startRow, STOCK_COL, nRows, 1).getValues();
      logSales_(sheet, startRow, nRows, shadowVals, newVals, userEmail || ADMIN_EMAIL);
    }
    updateShadowRange_(startRow, startCol, newVals);

    if (nRows === 1 && nCols === 1) {
      const producto = sheet.getRange(startRow, 1).getValue();
      logChange({
        user: userEmail || ADMIN_EMAIL,
        sheetName: SHEET_NAME,
        row: startRow, col: startCol,
        producto,
        oldValue: e.oldValue, newValue: e.value
      });
    }
  }
}

function onChange(e) {
  const userEmail = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const isAdmin = userEmail === ADMIN_EMAIL.toLowerCase();
  if (isAdmin) return;

  const ct = e.changeType;
  if (['REMOVE_ROW','REMOVE_COLUMN','INSERT_ROW','INSERT_COLUMN','OTHER'].includes(ct)) {
    restoreWholeFromShadow_();
    SpreadsheetApp.getActive().toast('Cambios no permitidos revertidos.', 'Bloqueado', 3);
  }
}

/***** SHADOW OPS *****/
function getShadowRange_(row, col, numRows, numCols) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHADOW_SHEET) || ensureShadowSheet_();
  return sh.getRange(row, col, numRows, numCols);
}

function updateShadowRange_(row, col, values2D) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHADOW_SHEET) || ensureShadowSheet_();
  sh.getRange(row, col, values2D.length, values2D[0].length).setValues(values2D);
}

function restoreFromShadow_(sheet, range) {
  const vals = getShadowRange_(range.getRow(), range.getColumn(), range.getNumRows(), range.getNumColumns()).getValues();
  range.setValues(vals);
}

function restoreWholeFromShadow_() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const sh = ss.getSheetByName(SHADOW_SHEET);
  if (!sheet || !sh) return;
  const lastRow = Math.max(sh.getLastRow(), 1);
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  sheet.clear();
  sheet.getRange(1,1,lastRow,lastCol).setValues(vals);
  refreshUnprotectedRange_();
}

/***** BACKUPS *****/
function backupSnapshot() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`No encuentro la hoja ${SHEET_NAME}`);
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const copy = sheet.copyTo(ss).setName(`${SHEET_NAME}_BK_${ts}`);
  ss.setActiveSheet(copy);
  ss.moveActiveSheet(ss.getNumSheets());
  shadowFullRefresh_();
  SpreadsheetApp.getUi().alert(`Backup creado: ${copy.getName()}`);
}

function createDailyBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'backupSnapshot') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupSnapshot').timeBased().everyDays(1).atHour(3).create();
}

/***** HELPERS *****/
function refreshUnprotectedRange_() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const prot = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0];
  if (!prot) return;
  const lastRow = Math.max(sheet.getLastRow(), HEADER_ROWS + 1);
  const rangeStock = sheet.getRange(HEADER_ROWS + 1, STOCK_COL, Math.max(1,lastRow - HEADER_ROWS), 1);
  prot.setUnprotectedRanges([rangeStock]);
}






/***** ====== CATÁLOGO PDF (Producto + Precio con fondo) ====== *****/
const HEADER_ROWS_CATALOGO = 6; 
const BACKGROUND_FILE_ID = '1x8VcJHw0Ihad4CxSs626lP3pwSdEiltE'; 

const SAFE = {
  PAGE_W: 1024,
  PAGE_H: 1536,
  LEFT:   120,
  RIGHT:  120,
  TOP:    330,
  BOTTOM: 230
};

const STYLE = {
  title:  42,
  sub:    26,
  gap:    14,
  row:    18,
  rowH:   40,
  currencyPrefix: 'ARS $ '
};

function exportCatalogoProdPrecioPdf() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { ui.alert('No encuentro la hoja ' + SHEET_NAME); return; }

  const HEADER_ROWS_CATALOGO = 6;  // primera fila con datos reales bajo el header
  const lastRow = sh.getLastRow();
  if (lastRow <= HEADER_ROWS_CATALOGO) { ui.alert('No hay datos para exportar.'); return; }

  // === Leer A (producto), B (precio), C (stock) ===
  let rows = sh.getRange(HEADER_ROWS_CATALOGO + 1, 1, lastRow - HEADER_ROWS_CATALOGO, 3).getValues();

  // Filtrar: producto no vacío + STOCK > 0
  rows = rows.filter(r => String(r[0]).trim() !== '' && Number(r[2]) > 0);

  // Sacar encabezados sueltos por si vienen en el rango
  const BLOCK = ['DESCRIPCION DEL PRODUCTO','DESCRIPCIÓN DEL PRODUCTO','PRODUCTO','DESCRIPCION','DESCRIPCIÓN','PRECIO','CANTIDAD'];
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  rows = rows.filter(r => !BLOCK.includes(norm(r[0])) && !BLOCK.includes(norm(r[1])));

  if (!rows.length) { ui.alert('No hay filas con stock para exportar.'); return; }

  // ================== FONDO ==================
  const bgBlob = DriveApp.getFileById(BACKGROUND_FILE_ID).getBlob();
  const bgMime = bgBlob.getContentType();
  const bgDataUri = 'data:' + bgMime + ';base64,' + Utilities.base64Encode(bgBlob.getBytes());

  // ================== LAYOUT (MISMA TIPOGRAFÍA) ==================
  const PAGE_W = 1024, PAGE_H = 1536;

  // caja dentro del pergamino
  const CONTENT_TOP    = 520;  // << bajamos el header un poco (antes 470)
  const CONTENT_BOTTOM = 240;  // arriba del borde inferior
  const INNER_WIDTH    = 560;  // ancho total del listado centrado

  // columnas “tipo planilla”
  const COL_PRODUCT = 440;   // ancho producto
  const COL_PRICE   = 90;    // ancho precio
  const COL_GAP     = 8;     // separación chica

  // títulos (mantenemos tamaños)
  const TITLE_SIZE = 28;
  const SUB_SIZE   = 18;
  const GAP_TOP    = 20;     // << más aire entre subtítulo y listado (antes 6)

  // filas (mantenemos tamaños para que entren 20)
  const ROW_FONT   = 14;
  const ROW_HEIGHT = 24;

  // === Salto de página fijo: 20 productos por hoja ===
  const PER_PAGE = 20;
  const pages = [];
  for (let i = 0; i < rows.length; i += PER_PAGE) pages.push(rows.slice(i, i + PER_PAGE));

  // ================== HTML ==================
  const html =
'<!doctype html><html><head><meta charset="utf-8"><style>' +
'@page { size:' + PAGE_W + 'px ' + PAGE_H + 'px; margin:0; }' +
'html,body{ margin:0; padding:0; background:transparent; }' +
'.page{ width:' + PAGE_W + 'px; height:' + PAGE_H + 'px; position:relative; page-break-after:always; overflow:hidden; }' +
'.page:last-child{ page-break-after:auto; }' +
'.bg{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0; }' +
'.content{ position:absolute; z-index:1; ' +
         'left:' + ((PAGE_W - INNER_WIDTH)/2) + 'px; ' +
         'right:' + ((PAGE_W - INNER_WIDTH)/2) + 'px; ' +
         'top:' + CONTENT_TOP + 'px; bottom:' + CONTENT_BOTTOM + 'px; ' +
         'font-family:"Georgia","Times New Roman",serif; color:#000; display:flex; flex-direction:column; }' +
'.title{ text-align:center; font-weight:800; font-size:' + TITLE_SIZE + 'px; line-height:1.1; letter-spacing:0.3px; }' +
'.sub{ text-align:center; font-weight:600; font-size:' + SUB_SIZE + 'px; margin-top:1px; }' +
'.gapTop{ height:' + GAP_TOP + 'px; }' +
'.row{ display:grid; grid-template-columns:' + COL_PRODUCT + 'px ' + COL_PRICE + 'px; column-gap:' + COL_GAP + 'px; ' +
      'align-items:center; font-size:' + ROW_FONT + 'px; line-height:1.18; font-weight:600; height:' + ROW_HEIGHT + 'px; ' +
      'border-top:1px solid rgba(0,0,0,0.08); }' +
'.row:first-child{ border-top:0; }' +
'.prod{ overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }' +
'.price{ text-align:right; font-weight:700; }' +
'</style></head><body>' +
pages.map(slice =>
  '<div class="page">' +
    '<img class="bg" src="' + bgDataUri + '" alt="">' +
    '<div class="content">' +
      '<div class="title">VAPES BROTHER’S BARBERSHOP</div>' +
      '<div class="sub">O’higgins 2014, Lanús</div>' +
      '<div class="gapTop"></div>' +
      slice.map(r => {
        const prod  = String(r[0]).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
        const price = (function(n){ try { return Number(n||0).toLocaleString("es-AR",{minimumFractionDigits:2, maximumFractionDigits:2}); } catch(_){ return Utilities.formatString("%s",(Number(n||0)).toFixed(2)).replace(".",",").replace(/\B(?=(\d{3})+(?!\d))/g,"."); } })(r[1]);
        return '<div class="row"><div class="prod">' + prod + '</div><div class="price">$ ' + price + '</div></div>';
      }).join('') +
    '</div>' +
  '</div>'
).join('') +
'</body></html>';

  // Exportar y abrir
  const pdf = HtmlService.createHtmlOutput(html).getAs('application/pdf')
    .setName('CATALOGO_VAPERS_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(),'yyyyMMdd_HHmm') + '.pdf');
  const file = DriveApp.createFile(pdf);
  const url = file.getUrl();
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput('<script>window.open("' + url + '","_blank");google.script.host.close();</script>').setWidth(120).setHeight(30),
    'Abriendo catálogo...'
  );
  return url;
}
 


// Helpers
function fmtNumber_(n){
  try { return n.toLocaleString('es-AR',{minimumFractionDigits:2, maximumFractionDigits:2}); }
  catch(_) { return Utilities.formatString('%s', n.toFixed(2)).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
}
function esc_(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function norm_(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase(); } 








