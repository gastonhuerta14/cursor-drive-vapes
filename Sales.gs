/***** ===== CONFIG LOCAL ===== *****/
// OJO: Este ES el ID de la PLANILLA (empieza con "1..."), NO el ID de la webapp.
const SS_ID  = '1nrfYiT05uO9NLzchAJL2-Wlks0c0U8Ev27tSIfNhAyk';
const SS_URL = 'https://docs.google.com/spreadsheets/d/1nrfYiT05uO9NLzchAJL2-Wlks0c0U8Ev27tSIfNhAyk/edit';

const VAPES_CFG = {
  SELLERS_SHEET: 'Vendedores',  // col A: nombres
  CATEG_SHEET:   'Categorias',  // A: Categoria, B: ImagenURL (pública)
};

// Abrir SIEMPRE por ID (robusto para Web App)
function getSS_() {
  try { return SpreadsheetApp.openById(SS_ID); }
  catch (e) {
    try { if (SS_URL) return SpreadsheetApp.openByUrl(SS_URL); }
    catch (_) {}
    return SpreadsheetApp.getActive(); // fallback si corrés desde editor adjunto a la hoja
  }
}

/***** Helpers *****/
function norm_(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase(); }
function toNum_(v){
  if (typeof v==='number') return isNaN(v)?0:v;
  const s=String(v||'').replace(/\s+/g,'').replace(/\./g,'').replace(',', '.').replace(/[^\d.\-]/g,'');
  const n=parseFloat(s); return isNaN(n)?0:n;
}
function splitCatSabor_(nombre){
  const s=String(nombre||'');
  for (const sep of [' - ',' – ',' — ']) {
    const p=s.split(sep);
    if (p.length>=2) return { categoria:p[0].trim(), sabor:p.slice(1).join(sep).trim() };
  }
  return { categoria:s.trim(), sabor:'' };
}
function findHeaders_(sheet){
  const lastCol=Math.max(3, sheet.getLastColumn());
  const maxScan=Math.min(25, Math.max(1, sheet.getLastRow()));
  let headerRow=1, headers=[];
  for(let r=1;r<=maxScan;r++){
    const row=sheet.getRange(r,1,1,lastCol).getValues()[0];
    const norm=row.map(norm_);
    if (norm.includes('PRODUCTO') && norm.includes('PRECIO') && norm.includes('CANTIDAD')){
      headerRow=r; headers=norm; break;
    }
  }
  if (!headers.length) headers=sheet.getRange(1,1,1,lastCol).getValues()[0].map(norm_);
  const idx=name=>{ const i=headers.indexOf(norm_(name)); if(i<0) throw new Error('Falta columna: '+name); return i+1; };
  return { headerRow, PROD:idx('PRODUCTO'), PRECIO:idx('PRECIO'), CANT:idx('CANTIDAD'),
           ACTIVO:(()=>{ const i=headers.indexOf('ACTIVO'); return i>=0? i+1 : null; })() };
}

/***** Vendedores (tiles) *****/
function listSellers(){
  const ss = getSS_();
  let sh = ss.getSheetByName(VAPES_CFG.SELLERS_SHEET);
  if (!sh){
    sh = ss.insertSheet(VAPES_CFG.SELLERS_SHEET);
    sh.getRange(1,1,5,1).setValues([['Gastón'],['Nicolás'],['Laucha'],['Juanchi'],['Agus']]);
  }
  const last = Math.max(1, sh.getLastRow());
  const names = sh.getRange(1,1,last,1).getValues().map(r=>String(r[0]).trim()).filter(Boolean);
  const uniq = Array.from(new Set(names));
  return uniq;
}

/***** Categorías (con imagen) *****/
function listCategories(){
  const ss = getSS_();
  const stock = ss.getSheetByName(SHEET_NAME); // SHEET_NAME viene de Código.gs
  if(!stock) throw new Error('No encuentro '+SHEET_NAME);
  const H = findHeaders_(stock);
  const start = H.headerRow+1;
  const data = (stock.getLastRow()>H.headerRow)
    ? stock.getRange(start,1,stock.getLastRow()-H.headerRow, Math.max(H.CANT,H.PRECIO,H.PROD,H.ACTIVO||0)).getValues()
    : [];
  const cats = new Set();
  for (const r of data){
    const prod=r[H.PROD-1]; if(!prod) continue;
    const cant=toNum_(r[H.CANT-1]);
    const active = H.ACTIVO ? (String(r[H.ACTIVO-1]).toUpperCase()!=='FALSE') : true;
    if (cant>0 && active) cats.add(splitCatSabor_(prod).categoria);
  }
  return Array.from(cats).sort((a,b)=>a.localeCompare(b,'es'));
}
function listCategoriesWithImages(){
  const cats = listCategories();
  const ss = getSS_();
  const sh = ss.getSheetByName(VAPES_CFG.CATEG_SHEET);
  const map = new Map();
  if (sh && sh.getLastRow()>0){
    const vals = sh.getRange(1,1,sh.getLastRow(),2).getValues();
    vals.forEach(([cat,url])=>{ if(cat) map.set(norm_(cat), String(url||'').trim()); });
  }
  return cats.map(c => ({ categoria:c, img: map.get(norm_(c)) || '' }));
}

/***** Productos *****/
function listProductsByCategory(payload){
  const categoria=String(payload?.categoria||'').trim(); if(!categoria) return [];
  const ss=getSS_();
  const stock=ss.getSheetByName(SHEET_NAME);
  const H=findHeaders_(stock);
  const start=H.headerRow+1;
  const data=(stock.getLastRow()>H.headerRow)
    ? stock.getRange(start,1,stock.getLastRow()-H.headerRow, Math.max(H.CANT,H.PRECIO,H.PROD,H.ACTIVO||0)).getValues()
    : [];
  const out=[];
  for (const r of data){
    const prod=r[H.PROD-1]; if(!prod) continue;
    const {categoria:cat}=splitCatSabor_(prod);
    const cant=toNum_(r[H.CANT-1]);
    const price=toNum_(r[H.PRECIO-1]);
    const active=H.ACTIVO ? (String(r[H.ACTIVO-1]).toUpperCase()!=='FALSE') : true;
    if (norm_(cat)===norm_(categoria) && cant>0 && active)
      out.push({ producto:String(prod), precio:price, cantidad:cant });
  }
  return out;
}
function getProductInfo(payload){
  const nombre=String(payload?.producto||'').trim(); if(!nombre) throw new Error('Producto requerido');
  const ss=getSS_();
  const stock=ss.getSheetByName(SHEET_NAME);
  const H=findHeaders_(stock);
  const start=H.headerRow+1;
  const data=(stock.getLastRow()>H.headerRow)
    ? stock.getRange(start,1,stock.getLastRow()-H.headerRow, Math.max(H.CANT,H.PRECIO,H.PROD,H.ACTIVO||0)).getValues()
    : [];
  for (let i=0;i<data.length;i++){
    if (norm_(data[i][H.PROD-1]) === norm_(nombre)){
      const price=toNum_(data[i][H.PRECIO-1]);
      const qty=toNum_(data[i][H.CANT-1]);
      const active=H.ACTIVO ? (String(data[i][H.ACTIVO-1]).toUpperCase()!=='FALSE') : true;
      return { producto:nombre, precio:price, cantidad:qty, activo:Boolean(active), row:start+i };
    }
  }
  throw new Error('Producto no encontrado');
}

/***** Venta (usa STOCK_COL global de Código.gs) *****/
function sell(payload){
  const vendedor=String(payload?.vendedor||'').trim();
  const producto=String(payload?.producto||'').trim();
  const cantidadVendida=Number(payload?.cantidadVendida||1);
  if(!vendedor) return {ok:false,error:'Elegí vendedor'};
  if(!producto) return {ok:false,error:'Elegí producto'};
  if(!Number.isInteger(cantidadVendida)||cantidadVendida<=0) return {ok:false,error:'Cantidad inválida'};

  const lock=LockService.getDocumentLock(); lock.waitLock(10000);
  try{
    const ss=getSS_();
    const stock=ss.getSheetByName(SHEET_NAME);
    const info=getProductInfo({producto});
    if(!info.activo) return {ok:false,error:'Producto inactivo'};
    if(cantidadVendida>info.cantidad) return {ok:false,error:`Stock insuficiente (disp: ${info.cantidad})`};

    const newQty=info.cantidad-cantidadVendida;
    stock.getRange(info.row, STOCK_COL).setValue(newQty);

    // Actualiza shadow si existe esa función en Código.gs
    try{
      const rowVals=stock.getRange(info.row,1,1,stock.getLastColumn()).getValues();
      if (typeof updateShadowRange_==='function') updateShadowRange_(info.row,1,rowVals);
    }catch(_){ }

    // Asegura hoja Ventas (9 columnas)
    const sales=ss.getSheetByName('Ventas')||ss.insertSheet('Ventas');
    if (sales.getLastRow()===0){
      sales.getRange(1,1,1,9).setValues([['timestamp','user','producto','precio_unitario','cantidad','subtotal','stock_old','stock_new','fila']]);
    }
    const now=new Date();
    const subtotal=info.precio*cantidadVendida;
    const pedidoId='P'+Utilities.formatDate(now,Session.getScriptTimeZone(),'yyyyMMdd-HHmmss')+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
    sales.appendRow([now, vendedor, info.producto, info.precio, cantidadVendida, subtotal, info.cantidad, newQty, info.row]);

    return {ok:true,pedidoId,nuevoStock:newQty};
  } finally { lock.releaseLock(); }
}

/***** Debug opcional *****/
function debugEverything(){
  Logger.log('Sellers: ' + JSON.stringify(listSellers()));
  Logger.log('Cats: ' + JSON.stringify(listCategoriesWithImages()));
  const cats = listCategories();
  if (cats.length) Logger.log('Prods 1ra cat: ' + JSON.stringify(listProductsByCategory({categoria: cats[0]})));
}
