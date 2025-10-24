// ==== WebApp.gs ====
// Permite incluir subplantillas (app_css, app_js, etc.)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Punto de entrada de la Web App (pantalla completa)
function doGet() {
  return HtmlService
    .createTemplateFromFile('app') // app.html
    .evaluate()
    .setTitle('Vapes | Ventas');
}
