Vapes Sales Web App (Google Sheets + Apps Script)

Sistema liviano para registrar ventas de vapes desde celulares/tablets, conectado a un Google Sheet para descontar stock y registrar ventas. Interfaz mobile en 3 pasos: Vendedor → Categoría → Producto (con imagen) y confirmación.

⚙️ Base segura: el archivo Código.gs protege fórmulas/celdas, mantiene un shadow de seguridad, registra backups y exporta catálogo en PDF.
🧩 La Web App (archivos WebApp.gs, Sales.gs, app.html/css/js, ui.html) no toca esa lógica: solo la usa.

✨ Características

UI mobile (pantalla completa) optimizada para táctil.

Flujo paso-a-paso: Vendedor → Categoría (con imagen) → Producto → Confirmar.

Descuenta stock (columna C) y registra venta en hoja Ventas.

Catálogo PDF (Producto + Precio con fondo).

Protecciones para impedir ediciones accidentales en la planilla.

Fallbacks seguros: si no hay lista de vendedores/categorías, se muestran alternativas.

🗂 Estructura del proyecto
.
├─ Código.gs           # Base (protecciones, shadow, backups, catálogo, menú)
├─ Sales.gs            # Lógica de negocio (abre planilla por ID, listar, vender)
├─ WebApp.gs           # doGet() + include() para servir la Web App
├─ app.html            # Vista principal (3 pasos + sheet de confirmación)
├─ app_css.html        # Estilos mobile-first (tiles, cards, sheet)
├─ app_js.html         # Lógica front (carga de datos y navegación)
└─ ui.html             # Sidebar en Sheets con botón para abrir la Web App

🧾 Estructura del Google Sheet

Hoja principal (Hoja 1) — definida en Código.gs como SHEET_NAME

Columnas esperadas (títulos en alguna de las primeras 25 filas):

Producto (texto)

Precio (número)

Cantidad (número; stock actual)

Activo (opcional) TRUE/FALSE

Hoja Vendedores — Columna A: un nombre por fila (Gastón, Nicolás, …)

Hoja Categorias (opcional):

Col A: Categoria (debe coincidir con el prefijo del Producto, ej. “LIFE POD KIT 10K – Sabor Mango” → categoría “LIFE POD KIT 10K”)

Col B: ImagenURL pública (Drive: https://drive.google.com/uc?export=view&id=ID)

🔎 La categoría se deduce del texto antes de “ - ” / “ – ” / “ — ” en el nombre del producto.

🔧 Configuración

Clonar el repo y abrirlo con Apps Script (o pegar archivos en un proyecto de Apps Script).

En Sales.gs, configurá el ID de tu planilla:

const SS_ID  = '1nrfYiT05uO9NLzchAJL2-Wlks0c0U8Ev27tSIfNhAyk'; // tu Spreadsheet ID
const SS_URL = 'https://docs.google.com/spreadsheets/d/1nrfYiT05uO9NLzchAJL2-Wlks0c0U8Ev27tSIfNhAyk/edit';


Verificá que en Código.gs estén:

const SHEET_NAME = 'Hoja 1';
const STOCK_COL = 3; // Col C


(Opcional) Cargá imágenes de categorías en la hoja Categorias.

🚀 Publicación (Web App)

Menú Implementar → Implementaciones → Nueva implementación

Tipo: Aplicación web

Ejecutar como: Tú

Acceso: Cualquiera con el enlace (o el que necesites)

Copiá la URL generada y pegala en ui.html:

<script>
  document.getElementById('openLink').href = 'PEGÁ_ACÁ_TU_URL_WEBAPP';
</script>


Guardá y, si querés, re-implementá para actualizar ui.html.

▶️ Uso

Abrí la URL de la Web App (o desde el menú en Sheets: 🧪 Vapes → Abrir panel de ventas).

Elegí vendedor (botones grandes).

Elegí categoría (cards con imagen).

Elegí producto → confirmá cantidad → Registrar venta.

Verás:

Stock actualizado en Hoja 1 (col C).

Nueva fila en Ventas con: timestamp, user, producto, precio unitario, cantidad, subtotal, stock_old, stock_new, fila.

🛡️ Seguridad y buenas prácticas

Código.gs protege todo salvo la columna de stock para no admins.

La Web App usa SpreadsheetApp.openById(SS_ID): no depende de la planilla activa.

Se usa LockService al vender para evitar condiciones de carrera.

Si alguien edita stock directo en la planilla, el shadow y logs ayudan a auditar y revertir.

🧪 Pruebas rápidas

En Sales.gs:

function debugEverything(){
  Logger.log('Sellers: ' + JSON.stringify(listSellers()));
  Logger.log('Cats: ' + JSON.stringify(listCategoriesWithImages()));
  const cats = listCategories();
  if (cats.length) Logger.log('Prods 1ra cat: ' + JSON.stringify(listProductsByCategory({categoria: cats[0]})));
}


Ver → Registro de ejecución: confirmá que hay vendedores, categorías y productos.

🐞 Problemas comunes

No aparecen vendedores

Verificar hoja Vendedores (col A) y SS_ID correcto en Sales.gs.

El panel de confirmación aparece solo al cargar

Confirmar que en app_css.html existe .hidden{display:none !important;} y que en el init se fuerza #sheet a hidden.

No hay categorías

Chequear que existan productos con Cantidad > 0 y que los encabezados contengan Producto/Precio/Cantidad.

🗺️ Roadmap (ideas)

Resumen por día/vendedor (dashboard).

Autenticación simple para rol admin (PIN).

Precios por combo/promos.

Exportación de ventas a PDF/WhatsApp.

📄 Licencia

Libre uso con atribución. Personalizá los nombres de hojas, estilos y flujo según tu operación.
