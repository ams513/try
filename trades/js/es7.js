/* Stark Trades 2.5.0. Spanish (US trades) for the supplier price list import and the accounting export. Keys are the exact English text.
   Register as in the rest of the app: usted; "partida" for item, "lista de precios" for price book, "respaldo" for backup. CSV column names, file names and product names stay in English. */
(function (root) {
  'use strict';
  const I = root.StarkI18n || require('./i18n.js');
  Object.assign(I.ES, {






"cost \"{v}\" is not a clear number{hint}": "el costo \"{v}\" no es un número claro{hint}",







































"Your note on the payment, such as \"check 1042\".": "Su nota sobre el pago, como \"cheque 1042\".",



"In the date order you pick in the export; choose the same one at QuickBooks' mapping step.": "En el orden de fecha que elija al exportar; elija el mismo en el paso de asignación de columnas de QuickBooks.",



"A CSV in the layout QuickBooks Online's help page describes, checked on {date}; not tested inside QuickBooks, not affiliated.": "Un CSV en el formato que describe la página de ayuda de QuickBooks Online, verificado el {date}; no probado dentro de QuickBooks, sin afiliación.",












"Tab": "Tabulador",














"Row": "Fila",
"Code": "Código",












"Pick a CSV or tab-separated file from your supplier or your own spreadsheet. It is read on this computer only. You see what will be added, updated and skipped before anything changes. Existing items are matched by supplier code, otherwise by exact name and unit. A cost you import is your supplier's price in the file; Stark does not look anything up.": "Elija un archivo CSV o separado por tabuladores de su proveedor o de su propia hoja de cálculo. Se lee solo en esta computadora. Verá qué se agregará, se actualizará y se omitirá antes de que cambie algo. Las partidas existentes se emparejan por código de proveedor y, si no hay, por nombre y unidad exactos. El costo que importa es el precio de su proveedor que figura en el archivo; Stark no consulta ningún precio.",

























"Accounting export": "Exportación contable",





"Open Share and backup": "Abrir Compartir y respaldar",



});
})(typeof globalThis !== 'undefined' ? globalThis : this);
