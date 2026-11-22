/* Stark Ledger. Spanish for the main flows. The views write English; when Spanish is on, a MutationObserver swaps any text
   node, placeholder, aria-label, title or optgroup label that matches the dictionary (exact text first, then patterns).
   User data rarely matches a whole phrase exactly, and typed values (inputs, textareas) are never touched. */
(function () {
  'use strict';
  const L = (typeof window !== 'undefined' && window.L) || {};
  const ES = {
    // shell, lock screen, navigation
    'Search': 'Buscar', 'Theme': 'Tema', 'Lock': 'Bloquear', 'Switch to English': 'Cambiar a inglés', 'Switch light and dark theme': 'Cambiar tema claro u oscuro', 'Stark Ledger home': 'Inicio de Stark Ledger', 'Main': 'Principal', '◐ Theme': '◐ Tema', '🔒 Lock': '🔒 Bloquear', 'Offline and encrypted': 'Sin conexión y cifrado', 'Main books': 'Libros principales', 'Books': 'Libros',
    'Sales': 'Ventas', 'Purchases': 'Compras', 'Banking': 'Banco', 'Reports': 'Informes', 'Company': 'Empresa',
    'Dashboard': 'Panel', 'Reconcile': 'Conciliar', 'Ask your books': 'Pregunta a tus libros', 'Books Doctor': 'Doctor de libros', 'Run Books Doctor': 'Ejecutar el Doctor de libros', 'Reconcile the bank': 'Conciliar el banco', 'Answer': 'Respuesta', 'Invoices': 'Facturas', 'Estimates': 'Presupuestos', 'Clients': 'Clientes', 'Receivables': 'Cuentas por cobrar', 'Reminders': 'Recordatorios', 'Time': 'Tiempo',
    'Bills and orders': 'Recibidas y pedidos', 'Vendors': 'Proveedores', 'Products and stock': 'Productos e inventario', 'Transactions': 'Movimientos', 'Receipts': 'Recibos', 'Import CSV': 'Importar CSV',
    'Recurring': 'Recurrentes', 'Mileage': 'Kilometraje', 'Cash forecast': 'Previsión de caja', 'Budgets': 'Presupuestos de gasto', 'Sales tax': 'Impuesto sobre ventas', 'VAT / GST': 'IVA / GST', 'Tax worksheet': 'Hoja de impuestos',
    'Year-end': 'Cierre de año', 'Backup': 'Copia de seguridad', 'Settings': 'Ajustes',
    'Create your passphrase': 'Crea tu frase de contraseña', 'Unlock your books': 'Desbloquea tus libros', 'Passphrase': 'Frase de contraseña', 'Repeat passphrase': 'Repite la frase de contraseña',
    'Create encrypted books': 'Crear libros cifrados', 'Unlock': 'Desbloquear', '+ Separate books for another business': '+ Libros separados para otro negocio', 'Separate books': 'Libros separados',
    'Create separate books': 'Crear libros separados', 'Business name': 'Nombre del negocio', 'Name for the new books': 'Nombre de los nuevos libros',
    'Offline bookkeeping and invoicing. Everything stays on this computer.': 'Contabilidad y facturación sin conexión. Todo se queda en este ordenador.',
    'Your books and receipts are encrypted with this passphrase before they are saved in this browser. Nothing is sent anywhere. There is no recovery: if you forget it, the data cannot be opened. Make backups.': 'Tus libros y recibos se cifran con esta frase antes de guardarse en este navegador. No se envía nada a ningún sitio. No hay recuperación: si la olvidas, los datos no se pueden abrir. Haz copias de seguridad.',
    'Each business gets its own encrypted books with its own passphrase. The name below is stored without encryption so you can pick the books before unlocking, so a nickname is fine.': 'Cada negocio tiene sus propios libros cifrados con su propia frase. El nombre de abajo se guarda sin cifrar para poder elegir los libros antes de desbloquear, así que basta con un apodo.',
    'Stark Ledger is bookkeeping software, not tax advice. Check with a tax professional.': 'Stark Ledger es un programa de contabilidad, no asesoría fiscal. Consulta a un profesional de impuestos.',
    'Use at least 10 characters. A few random words work well.': 'Usa al menos 10 caracteres. Unas cuantas palabras al azar funcionan bien.', 'The two passphrases differ.': 'Las dos frases no coinciden.', 'Wrong passphrase.': 'Frase de contraseña incorrecta.',
    'Locked after 15 quiet minutes.': 'Bloqueado tras 15 minutos sin actividad.', 'Something went wrong': 'Algo salió mal',
    // quick search
    'Pages, actions, clients, invoices, amounts...': 'Páginas, acciones, clientes, facturas, importes...', 'Arrow keys move, Enter opens, Esc closes. Ctrl+K opens search from anywhere.': 'Las flechas mueven, Intro abre, Esc cierra. Ctrl+K abre la búsqueda desde cualquier sitio.',
    'Nothing found.': 'Sin resultados.', 'Page': 'Página', 'Action': 'Acción', 'Client': 'Cliente', 'Vendor': 'Proveedor', 'Item': 'Artículo', 'Invoice': 'Factura', 'Estimate': 'Presupuesto', 'Bill': 'Factura recibida', 'Order': 'Pedido', 'Entry': 'Asiento',
    'New invoice': 'Nueva factura', 'New estimate': 'Nuevo presupuesto', 'New bill': 'Nueva factura recibida', 'New purchase order': 'Nuevo pedido de compra', 'Money in': 'Entrada de dinero', 'Money out': 'Salida de dinero',
    'Log time': 'Registrar tiempo', 'Write payment reminders': 'Escribir recordatorios de pago', 'Download backup': 'Descargar copia de seguridad', 'Accountant package': 'Paquete para el contable', 'Switch language': 'Cambiar idioma', 'Switch theme': 'Cambiar tema', 'Lock now': 'Bloquear ahora',
    // common words and buttons
    'Save': 'Guardar', 'Cancel': 'Cancelar', 'Delete': 'Eliminar', 'Edit': 'Editar', 'Back': 'Volver', 'Close': 'Cerrar', 'Remove': 'Quitar', 'View': 'Ver', 'Void': 'Anular', 'Duplicate': 'Duplicar', 'Repeat': 'Repetir', 'Statement': 'Estado de cuenta',
    'Please confirm': 'Confirma, por favor', 'Print / save as PDF': 'Imprimir / guardar como PDF', 'In the print window choose "Save as PDF" as the printer.': 'En la ventana de impresión elige "Guardar como PDF" como impresora.',
    'Date': 'Fecha', 'Due': 'Vence', 'Amount': 'Importe', 'Total': 'Total', 'Subtotal': 'Subtotal', 'Balance': 'Saldo', 'Status': 'Estado', 'Name': 'Nombre', 'Email': 'Correo electrónico', 'Phone': 'Teléfono', 'Address': 'Dirección', 'Notes': 'Notas',
    'Description': 'Descripción', 'Qty': 'Cant.', 'Unit price': 'Precio unitario', 'Unit cost': 'Coste unitario', 'Category': 'Categoría', 'Memo': 'Concepto', 'Reference': 'Referencia', 'Year': 'Año', 'From': 'Desde', 'To': 'Hasta', 'As of': 'A fecha de',
    'Paid': 'Pagado', 'Total due': 'Total a pagar', 'Terms': 'Condiciones', 'Due on receipt': 'Pago a la recepción', 'Bill to': 'Facturar a', 'Your business name': 'Nombre de tu negocio', 'Type': 'Tipo', 'Rate': 'Tasa', 'Price': 'Precio', 'Value': 'Valor',
    'Draft': 'Borrador', 'draft': 'borrador', 'open': 'abierta', 'partial': 'pago parcial', 'overdue': 'vencida', 'paid': 'pagada', 'void': 'anulada', 'sent': 'enviado', 'accepted': 'aceptado', 'declined': 'rechazado', 'expired': 'caducado', 'invoiced': 'facturado',
    'billed': 'facturado', 'cancelled': 'cancelado', 'unbilled': 'sin facturar', 'not billable': 'no facturable', 'stock': 'inventario', 'item': 'artículo', 'duplicate': 'duplicado', 'passed': 'pasado',
    'All': 'Todos', 'Sent': 'Enviados', 'Accepted': 'Aceptados', 'Declined': 'Rechazados', 'Expired': 'Caducados', 'Invoiced': 'Facturados', 'Open': 'Abiertas', 'Partly paid': 'Pago parcial', 'Overdue': 'Vencidas',
    'Yes': 'Sí', 'No': 'No', 'None': 'Ninguno', 'None yet': 'Ninguno todavía', 'Never': 'Nunca', 'Add': 'Añadir', 'Added': 'Añadido', 'Saved.': 'Guardado.', 'Copied.': 'Copiado.', 'No change.': 'Sin cambios.', 'No changes.': 'Sin cambios.',
    'Status filter': 'Filtro de estado', 'Draft saved.': 'Borrador guardado.', 'Copied to a new draft.': 'Copiado a un nuevo borrador.', 'Delete this draft?': '¿Eliminar este borrador?', 'Delete draft': 'Eliminar borrador', 'Preview': 'Vista previa',
    'Not found.': 'No encontrado.', 'Go back': 'Volver', 'Guide only.': 'Solo como guía.', 'Not tax advice. Check with a tax professional.': 'No es asesoría fiscal. Consulta a un profesional de impuestos.',
    // dashboard
    '+ Money in': '+ Entrada de dinero', '+ Money out': '+ Salida de dinero', 'Cash in checking': 'Efectivo en la cuenta', 'all time': 'desde el inicio', 'before any tax': 'antes de impuestos', 'Last six months': 'Últimos seis meses', 'Income': 'Ingresos', 'Expenses': 'Gastos',
    'Owed to you': 'Te deben', 'Nothing is past due.': 'No hay nada vencido.', 'Aged receivables': 'Antigüedad de cuentas por cobrar', 'Recent activity': 'Actividad reciente', 'Nothing yet. Add money in or out, or import a bank CSV.': 'Nada todavía. Añade entradas o salidas de dinero, o importa un CSV del banco.',
    'To do': 'Pendiente', 'Nothing needs you right now.': 'Nada requiere tu atención ahora.', 'Income and expenses for the last six months': 'Ingresos y gastos de los últimos seis meses',
    'Stark Ledger keeps your books on this computer, encrypted. It is bookkeeping software, not tax, legal or accounting advice.': 'Stark Ledger guarda tus libros en este ordenador, cifrados. Es un programa de contabilidad, no asesoría fiscal, legal ni contable.',
    // money dialog and transactions
    'Direction': 'Dirección', 'Amount ($)': 'Importe ($)', 'What was it for?': '¿Para qué fue?', 'Receipt image (optional)': 'Imagen del recibo (opcional)', 'Encrypted with your passphrase before it is stored.': 'Se cifra con tu frase antes de guardarse.', 'Schedule C lines are a guide only.': 'Las líneas del Schedule C son solo una guía.',
    'Search memo or category': 'Buscar concepto o categoría', 'All years': 'Todos los años', 'Everything': 'Todo', 'Bank only': 'Solo banco', 'Added by hand': 'Añadidos a mano', 'Imported': 'Importados', 'Payments': 'Pagos', 'No entries match.': 'Ningún asiento coincide.',
    'Show journal lines': 'Ver líneas del diario', 'Delete entry': 'Eliminar asiento', '+ receipt': '+ recibo', 'Delete this entry and its receipts?': '¿Eliminar este asiento y sus recibos?', 'Account': 'Cuenta', 'Debit': 'Debe', 'Credit': 'Haber', '(no memo)': '(sin concepto)',
    'Under the hood every entry is double-entry: tap ⋯ to see the debits and credits. Books balanced:': 'Internamente cada asiento es de partida doble: toca ⋯ para ver el debe y el haber. Libros cuadrados:',
    // clients
    '+ New client': '+ Nuevo cliente', 'New client': 'Nuevo cliente', 'Edit client': 'Editar cliente', 'Billing address': 'Dirección de facturación', 'Billed': 'Facturado', 'Owes': 'Debe', 'Add your first client to start invoicing.': 'Añade tu primer cliente para empezar a facturar.',
    'Give the client a name.': 'Ponle un nombre al cliente.', 'This client has invoices, estimates or time, so it can not be deleted.': 'Este cliente tiene facturas, presupuestos o tiempo, así que no se puede eliminar.',
    // invoices and documents
    '+ New invoice': '+ Nueva factura', 'Number': 'Número', 'No invoices here yet.': 'Aún no hay facturas.', 'Edit draft': 'Editar borrador', 'Invoice date': 'Fecha de factura', 'Terms (days)': 'Plazo (días)', 'Choose a client': 'Elige un cliente', 'Choose a vendor': 'Elige un proveedor',
    'Add a client first on the Clients page.': 'Primero añade un cliente en la página Clientes.', 'Add a vendor first on the Vendors page.': 'Primero añade un proveedor en la página Proveedores.', 'Income category': 'Categoría de ingreso', 'Expense category': 'Categoría de gasto',
    '+ Add line': '+ Añadir línea', '+ Add from products and services': '+ Añadir de productos y servicios', 'Add a product or service': 'Añadir un producto o servicio', 'Tax lines': 'Líneas de impuesto', 'Tax name': 'Nombre del impuesto', 'Rate %': 'Tasa %', 'Tax rate percent': 'Porcentaje del impuesto', 'Add tax line': 'Añadir impuesto',
    'Notes shown on the document': 'Notas que aparecen en el documento', 'Save draft': 'Guardar borrador', 'Issue invoice': 'Emitir factura', 'Save and mark sent': 'Guardar y marcar como enviado', 'Enter bill': 'Registrar factura recibida', 'Remove line': 'Quitar línea', 'Quantity': 'Cantidad',
    'Choose a client.': 'Elige un cliente.', 'Choose a vendor.': 'Elige un proveedor.', 'Pick a valid date.': 'Elige una fecha válida.', 'Add at least one line.': 'Añade al menos una línea.', 'Enter a tax name and a rate such as 8.25.': 'Escribe un nombre de impuesto y una tasa como 8.25.',
    'Record payment': 'Registrar pago', 'Payment recorded.': 'Pago registrado.', 'Check number, transfer reference...': 'Número de cheque, referencia de transferencia...', 'Remove payment': 'Quitar pago', 'Remove this payment?': '¿Quitar este pago?', 'Write a reminder': 'Escribir un recordatorio',
    'Void invoice': 'Anular factura', 'Inventory': 'Inventario', "Vendor's invoice number": 'Número de factura del proveedor', 'Their invoice number': 'Su número de factura', 'Estimate date': 'Fecha del presupuesto', 'Valid for (days)': 'Válido durante (días)', 'Bill date': 'Fecha de la factura',
    'Order date': 'Fecha del pedido', 'Expected in (days)': 'Llega en (días)', 'Edit estimate': 'Editar presupuesto', 'Edit draft bill': 'Editar factura recibida', 'Edit purchase order': 'Editar pedido de compra',
    'INVOICE': 'FACTURA', 'ESTIMATE': 'PRESUPUESTO', 'BILL': 'FACTURA RECIBIDA', 'PURCHASE ORDER': 'PEDIDO DE COMPRA', 'STATEMENT': 'ESTADO DE CUENTA', 'VOID': 'ANULADA', 'DRAFT': 'BORRADOR', 'Prepared for': 'Preparado para', 'Valid until': 'Válido hasta', 'Order from': 'Pedido a', 'Expected': 'Llegada prevista',
    // receivables, reminders, statements
    'Current': 'Al día', 'Open invoices': 'Facturas abiertas', 'Days late': 'Días de retraso', 'Nothing is owed as of this date.': 'No se debe nada a esta fecha.', 'Payment reminders': 'Recordatorios de pago',
    'Overdue invoices, latest first. The suggested tone steps up with how late a payment is: friendly up to 14 days, firm up to 44, then a final notice.': 'Facturas vencidas, las más atrasadas primero. El tono sugerido sube según el retraso: amable hasta 14 días, firme hasta 44 y luego un aviso final.',
    'Suggested tone': 'Tono sugerido', 'Last reminder': 'Último recordatorio', 'Write reminder': 'Escribir recordatorio', 'Friendly': 'Amable', 'Firm': 'Firme', 'Final notice': 'Aviso final', 'Nothing is overdue.': 'No hay nada vencido.', 'Tone': 'Tono', 'Letter language': 'Idioma de la carta',
    'Subject': 'Asunto', 'Message': 'Mensaje', 'Copy text': 'Copiar texto', 'Mark as sent': 'Marcar como enviado', 'Reminder logged.': 'Recordatorio registrado.', 'This client has no email address on file.': 'Este cliente no tiene correo electrónico guardado.', 'Press Ctrl+C to copy the selected text.': 'Pulsa Ctrl+C para copiar el texto seleccionado.',
    'Stark Ledger never sends email. Copy the text into your own email program, then mark it as sent so the history stays complete.': 'Stark Ledger nunca envía correos. Copia el texto en tu programa de correo y márcalo como enviado para que el historial quede completo.',
    'Client statements': 'Estados de cuenta de clientes', 'A printable statement lists every invoice, payment and credit for a period, with a running balance and how late the open amounts are.': 'Un estado de cuenta imprimible lista cada factura, pago y abono de un periodo, con saldo acumulado y el retraso de lo pendiente.',
    'Statement for': 'Estado de cuenta de', 'Balance due': 'Saldo pendiente', 'Charges': 'Cargos', 'Payments and credits': 'Pagos y abonos', 'Opening balance': 'Saldo inicial',
    // estimates
    '+ New estimate': '+ Nuevo presupuesto', 'Awaiting an answer': 'Esperando respuesta', 'Win rate': 'Tasa de éxito', 'accepted out of decided': 'aceptados de los decididos', 'Accepted, not invoiced': 'Aceptados sin facturar', 'Turn into invoice': 'Convertir en factura',
    'Edit (back to draft)': 'Editar (volver a borrador)', 'Marked accepted.': 'Marcado como aceptado.', 'Marked declined.': 'Marcado como rechazado.', 'Back to draft.': 'De vuelta a borrador.',
    'No estimates here yet. An estimate becomes an invoice in one click once the client says yes.': 'Aún no hay presupuestos. Un presupuesto se convierte en factura con un clic cuando el cliente acepta.',
    // vendors, bills, orders
    '+ New vendor': '+ Nuevo proveedor', 'New vendor': 'Nuevo proveedor', 'Edit vendor': 'Editar proveedor', 'Payment terms (days)': 'Plazo de pago (días)', 'Usual category': 'Categoría habitual', 'You owe': 'Debes', 'Bills': 'Facturas recibidas',
    'Add the suppliers you buy from. Bills and purchase orders use them.': 'Añade los proveedores a los que compras. Las facturas y los pedidos los usan.', 'Give the vendor a name.': 'Ponle un nombre al proveedor.', 'This vendor has bills or orders, so it can not be deleted.': 'Este proveedor tiene facturas o pedidos, así que no se puede eliminar.',
    '+ Purchase order': '+ Pedido de compra', '+ New bill': '+ Nueva factura recibida', 'Purchase orders': 'Pedidos de compra', 'Payables aging': 'Antigüedad de cuentas por pagar', 'You owe vendors': 'Debes a proveedores', 'accounts payable': 'cuentas por pagar', 'Due in the next 7 days': 'Vence en los próximos 7 días',
    'Past due': 'Vencido', 'pay these first': 'paga esto primero', 'nothing late': 'nada atrasado', 'Their ref': 'Su referencia', 'Pay bill': 'Pagar factura', 'Bill payment recorded.': 'Pago de factura registrado.', 'Void bill': 'Anular factura recibida',
    'No bills yet. Enter the bills your suppliers send, then pay them here so you always know what you owe.': 'Aún no hay facturas recibidas. Regístralas y págalas aquí para saber siempre lo que debes.',
    'No purchase orders yet. Send one to a supplier, then turn it into a bill when the goods arrive.': 'Aún no hay pedidos de compra. Envía uno a un proveedor y conviértelo en factura cuando llegue la mercancía.', 'You owe nothing to vendors as of today.': 'Hoy no debes nada a proveedores.',
    'Goods arrived: make the bill': 'Llegó la mercancía: crear la factura', 'Cancel order': 'Cancelar pedido', 'From order': 'Del pedido', 'From estimate': 'Del presupuesto', 'Invoice:': 'Factura:', 'Bill:': 'Factura recibida:',
    // products and stock
    'Order low stock': 'Pedir lo que falta', '+ New product or service': '+ Nuevo producto o servicio', 'New product or service': 'Nuevo producto o servicio', 'Edit product or service': 'Editar producto o servicio', 'Stock value': 'Valor del inventario', 'at average cost': 'a coste medio',
    'Stocked products': 'Productos con inventario', 'At or below reorder level': 'En o bajo el punto de pedido', 'all good': 'todo bien', 'On hand': 'Existencias', 'Avg cost': 'Coste medio', 'Reorder at': 'Pedir al llegar a', 'Count': 'Contar', 'Stocked product': 'Producto con inventario',
    'Product': 'Producto', 'Service': 'Servicio', 'SKU or code (optional)': 'SKU o código (opcional)', 'Track stock (products only)': 'Controlar inventario (solo productos)', 'Sale price ($)': 'Precio de venta ($)', 'Purchase cost ($)': 'Coste de compra ($)',
    'Expense category (when not stocked)': 'Categoría de gasto (sin inventario)', 'Opening quantity': 'Cantidad inicial', 'Posts to inventory at the purchase cost.': 'Se registra en inventario al coste de compra.', 'Preferred vendor': 'Proveedor preferido', 'No preferred vendor': 'Sin proveedor preferido',
    'Counted quantity': 'Cantidad contada', 'Save count': 'Guardar recuento', 'Enter what is on the shelf. The difference posts to cost of goods sold at average cost.': 'Escribe lo que hay en el estante. La diferencia va al coste de ventas a coste medio.', 'Stock adjusted and posted to cost of goods.': 'Inventario ajustado y registrado en el coste de ventas.',
    'Make draft order': 'Crear pedido en borrador', 'Makes a draft purchase order for products at or below their reorder level, ordering up to twice the reorder level.': 'Crea un pedido de compra en borrador para los productos en o bajo su punto de pedido, hasta el doble de ese nivel.',
    'Add what you sell. Products can track stock: bills add to it at cost, invoices take from it and post cost of goods sold.': 'Añade lo que vendes. Los productos pueden llevar inventario: las facturas de proveedor lo aumentan al coste y las facturas de venta lo reducen y registran el coste de ventas.',
    'Average-cost inventory for small shops. Selling more than you have is allowed and shows in red; it is costed at the last purchase cost until new stock arrives. Not a warehouse or point-of-sale system.': 'Inventario a coste medio para pequeños negocios. Se puede vender más de lo que hay y se muestra en rojo; se valora al último coste de compra hasta que llegue más. No es un sistema de almacén ni de punto de venta.',
    'This item is on documents or has stock, so it can not be deleted.': 'Este artículo está en documentos o tiene existencias, así que no se puede eliminar.',
    // time
    'Timer': 'Cronómetro', 'Timer running': 'Cronómetro en marcha', 'Task': 'Tarea', 'Hourly rate ($)': 'Tarifa por hora ($)', '▶ Start timer': '▶ Iniciar cronómetro', 'Stop and save': 'Parar y guardar', 'Discard': 'Descartar', 'What are you working on?': '¿En qué estás trabajando?', 'No description': 'Sin descripción',
    'The timer keeps running while Stark Ledger is locked or closed, because it only stores the start time.': 'El cronómetro sigue contando aunque Stark Ledger esté bloqueado o cerrado, porque solo guarda la hora de inicio.', 'Billable': 'Facturable', 'Time logged.': 'Tiempo registrado.', 'Time saved.': 'Tiempo guardado.',
    'Unbilled time': 'Tiempo sin facturar', 'Entries': 'Registros', 'Hours': 'Horas', 'Create invoice': 'Crear factura', 'Recent time': 'Tiempo reciente', 'Nothing logged yet.': 'Aún no hay nada registrado.', 'No unbilled time. Start the timer or log time above.': 'No hay tiempo sin facturar. Inicia el cronómetro o registra tiempo arriba.',
    'Bill exact minutes': 'Facturar minutos exactos', 'Round each entry up to 6 minutes': 'Redondear cada registro a 6 minutos', 'Round each entry up to 15 minutes': 'Redondear cada registro a 15 minutos', 'Rounding': 'Redondeo', '1:30, 1.5 or 90m': '1:30, 1.5 o 90m', 'Delete time entry': 'Eliminar registro de tiempo',
    'Draft invoice made from unbilled time.': 'Factura en borrador creada con el tiempo sin facturar.', 'Enter time like 1:30, 1.5 or 90m.': 'Escribe el tiempo como 1:30, 1.5 o 90m.',
    // recurring
    'Recurring expenses': 'Gastos recurrentes', 'Recurring invoices': 'Facturas recurrentes', 'Post what is due': 'Registrar lo vencido', '+ New expense': '+ Nuevo gasto', 'Expense': 'Gasto', 'Repeats': 'Se repite', 'Next': 'Siguiente', 'Mode': 'Modo', 'Pause': 'Pausar', 'Resume': 'Reanudar', 'Paused': 'En pausa', 'Finished': 'Terminado',
    'Weekly': 'Semanal', 'Monthly': 'Mensual', 'Every 3 months': 'Cada 3 meses', 'Yearly': 'Anual', 'Issued automatically': 'Se emite sola', 'Draft to check': 'Borrador para revisar', 'Repeat this invoice': 'Repetir esta factura', 'Each new invoice': 'Cada factura nueva', 'First date': 'Primera fecha', 'Ends (optional)': 'Termina (opcional)',
    'Make a draft for me to check': 'Crear un borrador para revisarlo', 'Issue it automatically': 'Emitirla automáticamente', 'Nothing is due.': 'No hay nada pendiente.', 'No recurring expenses yet.': 'Aún no hay gastos recurrentes.', 'Open any invoice and choose Repeat to bill a client on a schedule.': 'Abre cualquier factura y elige Repetir para facturar a un cliente de forma periódica.',
    'Copies the lines, taxes and terms of this invoice. Invoices are made when you unlock Stark Ledger on or after each date; nothing runs while it is closed.': 'Copia las líneas, impuestos y condiciones de esta factura. Las facturas se crean al desbloquear Stark Ledger en cada fecha o después; nada funciona mientras está cerrado.',
    // sales tax, budgets, forecast, year-end
    'Download CSV': 'Descargar CSV', 'Record a tax payment': 'Registrar un pago de impuestos', 'Record a sales tax payment': 'Registrar un pago del impuesto sobre ventas', 'This quarter': 'Este trimestre', 'Last quarter': 'Trimestre pasado', 'This year': 'Este año', 'Last year': 'Año pasado',
    'Tax collected': 'Impuesto cobrado', 'on invoices in this period': 'en facturas de este periodo', 'Paid to tax agencies': 'Pagado a la administración', 'in this period': 'en este periodo', 'Owed now': 'Debido ahora', 'sales tax payable today': 'impuesto sobre ventas por pagar hoy',
    'Tax': 'Impuesto', 'Taxable sales': 'Ventas gravadas', 'Untaxed sales': 'Ventas sin impuesto', 'No taxed invoices in this period.': 'No hay facturas con impuesto en este periodo.', 'Sales tax payment recorded.': 'Pago del impuesto sobre ventas registrado.', 'Posts the payment from checking against sales tax payable.': 'Registra el pago desde la cuenta contra el impuesto sobre ventas por pagar.', 'Tax agency and period': 'Administración y periodo',
    'Fill from last year': 'Rellenar con el año pasado', 'Save budgets': 'Guardar presupuestos', 'Compare': 'Comparar', 'Income vs budget': 'Ingresos frente al presupuesto', 'Expenses vs budget': 'Gastos frente al presupuesto', 'Net vs budget': 'Neto frente al presupuesto', 'Annual budget': 'Presupuesto anual', 'Budget to date': 'Presupuesto hasta la fecha',
    'Actual': 'Real', 'Variance': 'Diferencia', 'Used': 'Usado', 'no budget': 'sin presupuesto', '+ Budget another category': '+ Presupuestar otra categoría', 'Add a category': 'Añadir una categoría', 'Budgets saved.': 'Presupuestos guardados.', 'Through month': 'Hasta el mes',
    'Annual amounts are spread evenly across the twelve months. A positive variance is good news: more income or less spending than planned.': 'Los importes anuales se reparten por igual entre los doce meses. Una diferencia positiva es buena noticia: más ingresos o menos gasto de lo previsto.',
    'Next 13 weeks': 'Próximas 13 semanas', 'Next 26 weeks': 'Próximas 26 semanas', 'Horizon': 'Horizonte', 'Cash today': 'Caja hoy', 'cash accounts': 'cuentas de efectivo', 'Lowest point': 'Punto más bajo', 'Projected balance': 'Saldo previsto', 'Week of': 'Semana del', 'In': 'Entra', 'Out': 'Sale', 'What is expected': 'Lo que se espera', 'What': 'Qué',
    'Projected cash balance by week': 'Saldo de caja previsto por semana', 'Nothing scheduled. Open invoices, bills and recurring items appear here.': 'Nada previsto. Aquí aparecen las facturas abiertas, las de proveedores y los recurrentes.',
    'A projection, not a promise. It assumes clients pay on the due date (overdue invoices this week), bills are paid on their due date, and recurring expenses and invoices continue. It leaves out sales tax payments, owner draws and anything not yet in the books.': 'Una previsión, no una promesa. Supone que los clientes pagan al vencimiento (las vencidas, esta semana), que las facturas recibidas se pagan a su vencimiento y que los recurrentes siguen. No incluye pagos de impuestos sobre ventas, retiradas del dueño ni nada que no esté en los libros.',
    'Close a year': 'Cerrar un año', 'Close year': 'Cerrar año', 'Year to close': 'Año a cerrar', 'Reopen': 'Reabrir', 'Closed on': 'Cerrado el', 'Total assets': 'Total de activos', 'Net profit': 'Beneficio neto', 'Nothing to close: only finished years can be closed.': 'Nada que cerrar: solo se pueden cerrar años terminados.',
    'No year is closed yet. Closing locks a finished year so nothing in it can change by accident.': 'Aún no hay ningún año cerrado. Cerrar bloquea un año terminado para que nada cambie por accidente.',
    'Download accountant package (.zip)': 'Descargar paquete para el contable (.zip)', 'Accountant package (.zip)': 'Paquete para el contable (.zip)', 'Accountant package saved to your downloads.': 'Paquete para el contable guardado en tus descargas.', 'Balance sheet as of': 'Balance a fecha de',
    'One zip with the journal, general ledger, trial balance, chart of accounts, profit and loss, balance sheet, Schedule C guide, invoices, bills, open receivables and payables, sales tax, inventory, mileage and time, as CSV files most accounting programs and spreadsheets import. Not encrypted: store it safely.': 'Un zip con el diario, el libro mayor, el balance de comprobación, el plan de cuentas, pérdidas y ganancias, el balance, la guía del Schedule C, facturas, facturas recibidas, cobros y pagos pendientes, impuesto sobre ventas, inventario, kilometraje y tiempo, en CSV que importan la mayoría de programas contables y hojas de cálculo. Sin cifrar: guárdalo en un lugar seguro.',
    'Closing is a lock, not a tax filing. Retained earnings are worked out from the books, so no closing entry is posted. Not tax advice.': 'Cerrar es un bloqueo, no una declaración de impuestos. Las ganancias acumuladas se calculan a partir de los libros, así que no se registra asiento de cierre. No es asesoría fiscal.',
    'Assets': 'Activos', 'Liabilities': 'Pasivos', 'Equity': 'Patrimonio', 'Retained earnings (earlier years)': 'Ganancias acumuladas (años anteriores)', 'Earnings this year': 'Resultado de este año', 'Liabilities and equity': 'Pasivos y patrimonio', 'Total liabilities': 'Total de pasivos', 'Total equity': 'Total de patrimonio',
    'Balanced: assets equal liabilities plus equity.': 'Cuadrado: los activos son iguales a pasivos más patrimonio.', 'Out of balance!': '¡Descuadrado!',
    // reports and other pages (headings)
    'Profit and loss': 'Pérdidas y ganancias', 'Balance sheet': 'Balance', 'Cash flow': 'Flujo de caja', 'Schedule C guide': 'Guía del Schedule C', 'Trial balance': 'Balance de comprobación', 'Totals': 'Totales', 'Balanced: debits equal credits.': 'Cuadrado: el debe es igual al haber.',
    'Mileage log': 'Registro de kilometraje', 'Import bank CSV': 'Importar CSV del banco', 'Backup and export': 'Copia de seguridad y exportación', 'Encrypted backup': 'Copia cifrada', 'Restore from backup': 'Restaurar desde una copia', 'Year-end export': 'Exportación de fin de año', 'Danger zone': 'Zona de peligro',
    'Erase everything': 'Borrar todo', 'Restore': 'Restaurar', 'Backup file': 'Archivo de copia', 'Quarterly tax worksheet': 'Hoja trimestral de impuestos', 'Your business (shown on invoices)': 'Tu negocio (aparece en las facturas)', 'Save settings': 'Guardar ajustes', 'Settings saved.': 'Ajustes guardados.',
    'Estimates and purchase orders': 'Presupuestos y pedidos de compra', 'Estimate prefix': 'Prefijo de presupuesto', 'Next estimate': 'Siguiente presupuesto', 'Order prefix': 'Prefijo de pedido', 'Next order': 'Siguiente pedido', 'About and honesty': 'Acerca de y honestidad', 'Invoice footer': 'Pie de factura', 'Number prefix': 'Prefijo de número', 'Next number': 'Siguiente número', 'Default terms (days)': 'Plazo por defecto (días)', 'Filing status': 'Estado civil fiscal',

    // receipts, import, recurring, mileage
    'Choose receipt image': 'Elegir imagen del recibo', 'No receipts yet.': 'Aún no hay recibos.', 'Added': 'Añadido', 'File': 'Archivo', 'Size': 'Tamaño', 'Transaction': 'Movimiento', '(entry deleted)': '(asiento eliminado)', 'Delete this receipt image?': '¿Eliminar esta imagen de recibo?',
    'Receipt images are encrypted with your passphrase (AES-GCM, key from PBKDF2) before they are saved in this browser. Attach them from the Transactions page.': 'Las imágenes de recibos se cifran con tu frase (AES-GCM, clave de PBKDF2) antes de guardarse en este navegador. Adjúntalas desde la página Movimientos.',
    'Download a CSV from your bank and choose it here. It is read in this browser only. Columns needed: Date and Amount (or Debit and Credit); Description is used for rules. Positive amounts are money in, negative are money out.': 'Descarga un CSV de tu banco y elígelo aquí. Solo se lee en este navegador. Columnas necesarias: Date y Amount (o Debit y Credit); la descripción se usa para las reglas. Los importes positivos son entradas y los negativos, salidas.',
    'CSV file': 'Archivo CSV', 
    
    
    'Match': 'Coincidencia', 'No usable rows found.': 'No se encontraron filas válidas.', 
    
    'Rent, software, insurance. Due items post to your books automatically each time you unlock Stark Ledger. This is an offline app, so nothing runs while it is closed.': 'Alquiler, software, seguros. Lo vencido se registra solo cada vez que desbloqueas Stark Ledger. Es una aplicación sin conexión, así que nada funciona mientras está cerrada.',
    'New recurring expense': 'Nuevo gasto recurrente', 'Edit recurring expense': 'Editar gasto recurrente', 'Starts': 'Empieza', 'Past dates post immediately.': 'Las fechas pasadas se registran al momento.', 'Give it a name.': 'Ponle un nombre.', 'Pick a start date.': 'Elige una fecha de inicio.',
    'Miles': 'Millas', 'Trip': 'Trayecto', 'Cents per mile': 'Centavos por milla', 'IRS standard rate for the year; check irs.gov.': 'Tarifa estándar del IRS del año; compruébala en irs.gov.', 'Log trip': 'Registrar trayecto', 'No trips logged yet.': 'Aún no hay trayectos.', 'From - to': 'Origen - destino', 'Business purpose': 'Motivo de negocio', 'Purpose': 'Motivo', 'Deduction': 'Deducción', 'Trip logged.': 'Trayecto registrado.', 'Delete trip': 'Eliminar trayecto',
    'Each trip posts to Car and truck expenses (Schedule C line 9) with an offset to owner contributions. Keep a contemporaneous log; the standard rate may not suit every vehicle.': 'Cada trayecto se registra en gastos de vehículos (línea 9 del Schedule C) con contrapartida en aportaciones del dueño. Lleva un registro al día; la tarifa estándar puede no servir para todos los vehículos.',
    // reports, tax worksheet
    'Total income': 'Total de ingresos', 'Total expenses': 'Total de gastos', 'Accrual basis: invoices count as income when issued. Owner draws and contributions are not income or expense.': 'Base de devengo: las facturas cuentan como ingreso al emitirse. Las retiradas y aportaciones del dueño no son ingresos ni gastos.',
    'Reports are produced from the books you enter. Estimate only: check with a tax professional.': 'Los informes salen de los libros que introduces. Solo una estimación: consulta a un profesional de impuestos.', 'Cash at start': 'Caja al inicio', 'Cash at end': 'Caja al final', 'Operating': 'Operaciones', 'Owner (contributions and draws)': 'Dueño (aportaciones y retiradas)', 'Customer payments': 'Cobros de clientes', 'Line': 'Línea',
    'Net profit (line 31 guide)': 'Beneficio neto (guía de la línea 31)', 'Estimate, check with a tax professional.': 'Estimación, consulta a un profesional de impuestos.', 'Tax year': 'Año fiscal', 'Single': 'Soltero', 'Married filing jointly': 'Casados, declaración conjunta', 'Head of household': 'Cabeza de familia', 'Other income, if any ($)': 'Otros ingresos, si los hay ($)', 'State tax rate (%)': 'Tasa estatal (%)',
    'This worksheet is a rough guide to US federal estimated tax for sole proprietors. It is not tax advice and can be wrong for your situation.': 'Esta hoja es una guía aproximada del impuesto federal estimado de EE. UU. para autónomos. No es asesoría fiscal y puede no ajustarse a tu caso.',
    'Projected annual profit ($)': 'Beneficio anual previsto ($)', 'Estimated tax already paid ($)': 'Impuesto estimado ya pagado ($)', 'Apply the 20% QBI deduction (simplified, ignores income limits)': 'Aplicar la deducción QBI del 20% (simplificada, sin límites de ingresos)',
    'Projected full-year profit': 'Beneficio previsto del año', 'Projected full-year profit (your figure)': 'Beneficio previsto del año (tu cifra)', 'Self-employment tax (15.3% of 92.35%)': 'Impuesto de autónomos (15,3% del 92,35%)', 'Half of SE tax deducted': 'Mitad del impuesto de autónomos deducida', 'Standard deduction': 'Deducción estándar', '20% qualified business income deduction (simplified)': 'Deducción del 20% por ingresos de negocio (simplificada)',
    'Taxable income': 'Base imponible', 'Federal income tax': 'Impuesto federal sobre la renta', 'State income tax (your rate)': 'Impuesto estatal (tu tasa)', 'Estimated total tax for the year': 'Impuesto total estimado del año', 'Already paid': 'Ya pagado', 'Still to pay': 'Pendiente de pago', 'Quarterly payments': 'Pagos trimestrales', 'Quarter': 'Trimestre', 'Suggested': 'Sugerido',
    'The remaining balance is split evenly across quarters that have not passed. Due dates move when they fall on a weekend or holiday.': 'El saldo pendiente se reparte por igual entre los trimestres que no han pasado. Las fechas se mueven si caen en fin de semana o festivo.',
    // backup, settings, paper footer
    'One file holding your whole books and every receipt, encrypted with your passphrase. Keep a copy on a USB stick or another drive. Without the passphrase nobody can open it, including us.': 'Un archivo con todos tus libros y recibos, cifrado con tu frase. Guarda una copia en un USB u otro disco. Sin la frase nadie puede abrirlo, ni siquiera nosotros.',
    "Restoring replaces everything in this browser with the backup, and the backup's passphrase becomes your passphrase.": 'Restaurar sustituye todo lo de este navegador por la copia, y la frase de la copia pasa a ser tu frase.', 'Passphrase the backup was made with': 'Frase con la que se hizo la copia',
    'Plain CSV files for your accountant or tax software. These are NOT encrypted, so store them somewhere safe.': 'Archivos CSV sencillos para tu contable o programa de impuestos. NO están cifrados, así que guárdalos en un lugar seguro.', 'Printable Schedule C guide': 'Guía imprimible del Schedule C',
    'journal': 'diario', 'schedule-c-guide': 'guía Schedule C', 'invoices': 'facturas', 'mileage': 'kilometraje', 'bills': 'facturas recibidas', 'time': 'tiempo', 'Backup saved to your downloads.': 'Copia guardada en tus descargas.', 'Choose a backup file.': 'Elige un archivo de copia.', 'Restored.': 'Restaurado.',
    'This deletes the encrypted books and all receipts from this browser. Download a backup first. Type ERASE to confirm.': 'Esto borra los libros cifrados y todos los recibos de este navegador. Descarga antes una copia. Escribe ERASE para confirmar.', 'Type ERASE': 'Escribe ERASE', 'Erase': 'Borrar', 'Type ERASE to confirm.': 'Escribe ERASE para confirmar.',
    'Default tax lines for new invoices': 'Impuestos por defecto para facturas nuevas', 'Thank you for your business.': 'Gracias por confiar en nosotros.',
    'Your data never leaves this computer: there is no network code, no account and no tracking. Local protections: AES-GCM encryption with a 600,000-round passphrase key, a last-good save copy, checked and validated backups, and auto-lock. If you forget your passphrase there is no recovery.': 'Tus datos nunca salen de este ordenador: no hay código de red, ni cuenta, ni rastreo. Protecciones locales: cifrado AES-GCM con una clave de 600.000 rondas, copia del último guardado correcto, copias verificadas y bloqueo automático. Si olvidas tu frase no hay recuperación.',
    'Totals what your issued invoices charged, by tax name and rate; voided invoices are left out. Filing rules, exemptions and due dates are set by your state and city: check them with your tax agency or a tax professional.': 'Suma lo que cobraron tus facturas emitidas, por impuesto y tasa; las anuladas no cuentan. Las reglas de presentación, exenciones y plazos los fijan tu estado y tu ciudad: consúltalos con la administración o un profesional de impuestos.',
    // accounts (chart of accounts names)
    'Checking': 'Cuenta corriente', 'Accounts receivable': 'Cuentas por cobrar', 'Accounts payable': 'Cuentas por pagar', 'Sales tax payable': 'Impuesto sobre ventas por pagar', 'Opening balance equity': 'Patrimonio de saldo inicial', "Owner's contributions": 'Aportaciones del dueño', "Owner's draws": 'Retiradas del dueño',
    'Services income': 'Ingresos por servicios', 'Product sales': 'Venta de productos', 'Other income': 'Otros ingresos', 'Uncategorized income': 'Ingresos sin categoría', 'Cost of goods sold': 'Coste de ventas', 'Advertising': 'Publicidad', 'Car and truck': 'Vehículos', 'Commissions and fees': 'Comisiones y honorarios',
    'Contract labor': 'Trabajo subcontratado', 'Depreciation': 'Amortización', 'Insurance (not health)': 'Seguros (no de salud)', 'Interest': 'Intereses', 'Legal and professional': 'Servicios legales y profesionales', 'Office expense': 'Gastos de oficina', 'Rent: equipment': 'Alquiler: equipos', 'Rent: space': 'Alquiler: local',
    'Repairs and maintenance': 'Reparaciones y mantenimiento', 'Supplies': 'Suministros', 'Taxes and licenses': 'Impuestos y licencias', 'Travel': 'Viajes', 'Meals': 'Comidas', 'Utilities': 'Servicios públicos', 'Wages': 'Salarios', 'Software and subscriptions': 'Software y suscripciones', 'Bank and card fees': 'Comisiones bancarias y de tarjeta',
    'Home office': 'Oficina en casa', 'Other expenses': 'Otros gastos', 'Uncategorized expense': 'Gasto sin categoría', 'Owner': 'Dueño', "Owner's contribution (not income)": 'Aportación del dueño (no es ingreso)', "Owner's draw (not an expense)": 'Retirada del dueño (no es gasto)', "Owner's contribution": 'Aportación del dueño', "Owner's draw": 'Retirada del dueño',
    // feedback and free trial
    'Send feedback': 'Enviar comentarios', 'Open my email app': 'Abrir mi correo', 'Your rating (1 is poor, 5 is great)': 'Tu valoración (1 es mala, 5 es excelente)', 'What you like': 'Lo que te gusta', 'What is missing': 'Lo que falta',
    'Own it forever: buy on itch.io': 'Tuyo para siempre: compra en itch.io', 'Free trial.': 'Prueba gratuita.', 'Your trial data carries over.': 'Los datos de tu prueba se conservan.'
  };
  /* 1.4 Months of cover (never overrides an existing entry) */
  const ES14 = {
    'Household': 'Hogar',
    'Months of cover': 'Meses de cobertura',
    
    
    
    
    
    'Print': 'Imprimir',
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    'Kind': 'Tipo',
    
    
    
    
    
    
    
    
    
    
    'Supplies': 'Suministros',
    'Utilities': 'Servicios',
    
    
    'Other': 'Otros',
    
    
    'Remove': 'Quitar',
    
    
    
    
    
    
    
    'month': 'mes',
    'months': 'meses',
    'person': 'persona',
    
    
    
    
    
    
    
    
    
    
    
    
    
    '1 month': '1 mes',
    '3 months': '3 meses',
    
    
    
    
    
    
    
    
    'Line': 'Línea',
    
    
    
    
    'If': 'Si',
    
    
    
    
    'Months': 'Meses',
    
    
    
    
    
    
    
    
    
    
    
    
    'Item': 'Artículo',
    
    'Unit': 'Unidad',
    
    
    
    'Cost': 'Coste',
    
    
    
    'Add a food line': 'Añadir una línea de comida',
    'Add a fuel (gas) line': 'Añadir una línea de combustible',
    'Add a supplies line': 'Añadir una línea de suministros',
    
    
    
    
    
    
    
    
    
    
    
    'Name': 'Nombre',
    
    'Date': 'Fecha',
    'Status': 'Estado',
    'Notes': 'Notas',
    
    
    
    
    
    
    
    
    
    
    
    
  }; Object.keys(ES14).forEach(k => { if (ES[k] == null) ES[k] = ES14[k]; });
  const PAT = [
    [/^(\d{4}) (.+)$/, (m, n, x) => ES[x] != null ? n + ' ' + ES[x] : m], [/^yes \((.+) in debits and credits\)$/, 'sí ($1 en el debe y el haber)'], [/^Invoice ([A-Z0-9-]+)$/, 'Factura $1'], [/^Bill ([A-Z0-9-]+)$/, 'Factura recibida $1'],
    [/^Profit and loss, (.+) to (.+)$/, 'Pérdidas y ganancias, $1 a $2'], [/^Cash flow, (.+) to (.+)$/, 'Flujo de caja, $1 a $2'], [/^Schedule C guide, (.+) to (.+)$/, 'Guía del Schedule C, $1 a $2'], [/^Trial balance as of (.+)$/, 'Balance de comprobación a $1'], [/^Total (income|expenses)$/, m => m === 'Total income' ? 'Total de ingresos' : 'Total de gastos'],
    [/^Net (operating|owner \(contributions and draws\))$/, m => m === 'Net operating' ? 'Neto de operaciones' : 'Neto del dueño'], [/^Estimate for (\d{4})$/, 'Estimación para $1'], [/^Net profit so far \(to (.+)\)$/, 'Beneficio hasta ahora (al $1)'], [/^Blank uses your books to (.+), scaled to a full year\.$/, 'En blanco usa tus libros hasta el $1, extrapolados al año completo.'],
    [/^(\d{4}): ([\d.]+) miles, (.+) deduction$/, '$1: $2 millas, $3 de deducción'], [/^(\d+) rows ready$/, '$1 filas listas'], [/^Imported (\d+) transactions\.$/, 'Importados $1 movimientos.'], [/^Posted (\d+) due entries\.$/, 'Registrados $1 asientos vencidos.'],
    [/^Annual budget for (.+)$/, (m, x) => 'Presupuesto anual de ' + (ES[x] || x)], [/^Stark Ledger ([\d.]+) is bookkeeping software\. It is not tax, legal or accounting advice\. Schedule C mappings and the tax worksheet are guides that can be wrong for your situation\. Check with a tax professional\.$/, 'Stark Ledger $1 es un programa de contabilidad. No es asesoría fiscal, legal ni contable. Las correspondencias con el Schedule C y la hoja de impuestos son guías que pueden no ajustarse a tu caso. Consulta a un profesional de impuestos.'],
    [/^Built with (\d{4}) federal figures: .*$/, 'Calculado con cifras federales de $1 (deducción estándar, tramos y base salarial de la Seguridad Social). Cambian cada año: compruébalas con el IRS antes de pagar. No incluye: impuesto adicional de Medicare, créditos, AMT, el límite SALT, reglas estatales, ganancias de capital, otros ingresos de autónomo ni los límites de ingresos de QBI.'],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, m => MON[m]], [/^Through (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, (m, x) => 'Hasta ' + MON[x]], [/^(\d+-\d+|90\+) days$/, '$1 días'],
    [/^(.+), (-?[\d.]+) in stock$/, '$1, $2 en inventario'], [/^Stark Ledger ([\d.]+)\. Works offline\. Bookkeeping software, not tax advice: check with a tax professional\.$/, 'Stark Ledger $1. Funciona sin conexión. Programa de contabilidad, no asesoría fiscal: consulta a un profesional de impuestos.'],
    [/^(\d+) overdue invoice\(s\) to chase$/, '$1 factura(s) vencida(s) por cobrar'], [/^(\d+) bill\(s\) due within 7 days$/, '$1 factura(s) de proveedor vencen en 7 días'], [/^(\d+) product\(s\) at or below reorder level$/, '$1 producto(s) en o bajo el punto de pedido'],
    [/^(.+) of unbilled time$/, '$1 de tiempo sin facturar'], [/^(\d+) estimate\(s\) awaiting an answer$/, '$1 presupuesto(s) esperando respuesta'], [/^(\d+) draft invoice\(s\)$/, '$1 factura(s) en borrador'],
    [/^Income (\d{4})$/, 'Ingresos $1'], [/^Expenses (\d{4})$/, 'Gastos $1'], [/^Net profit (\d{4})$/, 'Beneficio neto $1'], [/^(.+) is past due\.$/, '$1 está vencido.'],
    [/^Issued as (.+)$/, 'Emitida como $1'], [/^Saved as (.+)$/, 'Guardado como $1'], [/^Entered as (.+)$/, 'Registrada como $1'], [/^Due (\d{4}-\d\d-\d\d)$/, 'Vence $1'], [/^Valid until (\d{4}-\d\d-\d\d)$/, 'Válido hasta $1'], [/^Expected (\d{4}-\d\d-\d\d)$/, 'Llegada $1'],
    [/^Net (\d+)$/, 'Neto $1 días'], [/^Balance is (.+)\. A smaller amount records a partial payment\.$/, 'El saldo es $1. Un importe menor registra un pago parcial.'], [/^Payment is more than the balance of (.+)$/, 'El pago supera el saldo de $1'],
    [/^Void (.+)\? A reversing entry keeps the books honest\.$/, '¿Anular $1? Un asiento de reversión mantiene los libros correctos.'], [/^Delete (.+)\?$/, '¿Eliminar $1?'], [/^Payment reminder: (.+)$/, 'Recordatorio de pago: $1'], [/^To: (.+)$/, 'Para: $1'],
    [/^Statement: (.+)$/, 'Estado de cuenta: $1'], [/^Count stock: (.+)$/, 'Recuento: $1'], [/^Draft invoice made from (.+)\.$/, 'Factura en borrador creada a partir de $1.'], [/^Draft bill made from (.+)\. Check it, then enter it\.$/, 'Factura recibida en borrador creada a partir de $1. Revísala y regístrala.'],
    [/^Draft order (.+) made\. Check quantities, then mark it sent\.$/, 'Pedido en borrador $1 creado. Revisa las cantidades y márcalo como enviado.'], [/^(\d+) estimate\(s\)$/, '$1 presupuesto(s)'], [/^(\d+) bill\(s\)$/, '$1 factura(s)'], [/^(\d+) item\(s\) in the catalog$/, '$1 artículo(s) en el catálogo'],
    [/^budget (.+)$/, 'presupuesto $1'], [/^Through (\w+)$/, 'Hasta $1'], [/^week of (.+)$/, 'semana del $1'], [/^In (\d+) weeks$/, 'En $1 semanas'], [/^by (\d{4}-\d\d-\d\d)$/, 'al $1'], [/^Balance sheet as of (.+)$/, 'Balance a $1'], [/^Total (assets|liabilities|equity)$/, m => ({ 'Total assets': 'Total de activos', 'Total liabilities': 'Total de pasivos', 'Total equity': 'Total de patrimonio' })[m]],
    [/^The books are closed through (.+)\. Entries on or before that date can not be added, changed or deleted\.$/, 'Los libros están cerrados hasta el $1. No se pueden añadir, cambiar ni eliminar asientos en esa fecha o antes.'],
    [/^The books are closed through (.+)\. Reopen that year on the Year-end page to change it\.$/, 'Los libros están cerrados hasta el $1. Reabre ese año en la página Cierre de año para cambiarlo.'],
    [/^Close (\d{4})\? Nothing dated on or before (.+) can be added, changed or deleted until you reopen it\.$/, '¿Cerrar $1? No se podrá añadir, cambiar ni eliminar nada con fecha del $2 o anterior hasta que lo reabras.'], [/^(\d{4}) closed\. Net profit (.+)\.$/, '$1 cerrado. Beneficio neto $2.'],
    [/^Reopen (\d{4})\? Its entries can be changed again until you close it again\.$/, '¿Reabrir $1? Sus asientos se podrán cambiar hasta que lo cierres de nuevo.'], [/^(\d{4}) reopened\.$/, '$1 reabierto.'],
    [/^Posted (\d+) recurring expense\(s\) and made (\d+) recurring invoice\(s\) that were due\.$/, 'Se registraron $1 gasto(s) recurrente(s) y se crearon $2 factura(s) recurrente(s) vencidas.'], [/^Posted (\d+) expense\(s\) and made (\d+) invoice\(s\)\.$/, 'Se registraron $1 gasto(s) y se crearon $2 factura(s).'],
    [/^(\d+) invoice\(s\) were already due and have been made\.$/, 'Ya vencían $1 factura(s) y se han creado.'], [/^Saved\. The next one is made on (.+)\.$/, 'Guardado. La siguiente se crea el $1.'], [/^Filled (\d+) budgets from last year\.$/, 'Se rellenaron $1 presupuestos con el año pasado.'],
    [/^Line (\d+): (.+)$/, (m, n, r) => 'Línea ' + n + ': ' + ({ 'unit price is not a number.': 'el precio unitario no es un número.', 'quantity must be more than zero.': 'la cantidad debe ser mayor que cero.', 'add a description.': 'añade una descripción.' }[r] || r)],
    [/^Write a reminder for (.+)$/, 'Escribir un recordatorio para $1'], [/^Count stock of (.+)$/, 'Contar inventario de $1'], [/^Category for (.+)$/, 'Categoría de $1'], [/^View receipt (.+)$/, 'Ver recibo $1']
  ];
  const MON = { Jan: 'ene', Feb: 'feb', Mar: 'mar', Apr: 'abr', May: 'may', Jun: 'jun', Jul: 'jul', Aug: 'ago', Sep: 'sept', Oct: 'oct', Nov: 'nov', Dec: 'dic' };
  const tx = function (s) {
    const k = s.trim(); if (!k || k.length > 400) return null; let v = ES[k];
    if (v == null) for (const p of PAT) { if (p[0].test(k)) { const r = k.replace(p[0], p[1]); if (r !== k) { v = r; break; } } }
    if (v == null) for (const sep of [' / ', ', ']) { const parts = k.split(sep); if (parts.length > 1 && parts.every(x => ES[x] != null)) { v = parts.map(x => ES[x]).join(sep); break; } } // joined category names
    return v == null ? null : s.replace(k, v);
  };
  L.lang = 'en';
  L.setLang = function (lang) { L.lang = lang === 'es' ? 'es' : 'en'; if (typeof window === 'undefined' || !window.StarkI18n) document.documentElement.lang = L.lang; };   // Spanish is this file's; the other screen languages are js/stark_lang.js over English
  L.t = s => (L.lang === 'es' && typeof s === 'string' ? (tx(s) || s) : s);
  const ATTRS = ['placeholder', 'aria-label', 'title', 'label'];
  function trNode(n) {
    if (n.nodeType === 3) { const p = n.parentNode; if (p && (p.nodeName === 'TEXTAREA' || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE')) return; const v = tx(n.nodeValue); if (v != null && v !== n.nodeValue) n.nodeValue = v; return; }
    if (n.nodeType !== 1) return;
    const els = [n].concat(Array.from(n.querySelectorAll('[placeholder],[aria-label],[title],optgroup[label]')));
    els.forEach(el => ATTRS.forEach(a => { const s = el.getAttribute && el.getAttribute(a); if (s) { const v = tx(s); if (v != null && v !== s) el.setAttribute(a, v); } }));
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); const list = []; while (w.nextNode()) list.push(w.currentNode); list.forEach(trNode);
  }
  L.tr = function (root) { if (L.lang === 'es' && root) trNode(root); return root; };
  L.startTranslating = function () {
    const obs = new MutationObserver(muts => { if (L.lang !== 'es') return; muts.forEach(m => m.addedNodes.forEach(trNode)); });
    obs.observe(document.body, { childList: true, subtree: true });
  };
  /* ---------- 1.6: bank file import. Register as above: tú, "extracto del banco", "importe", "movimiento"; format and file names stay as written. ---------- */
  Object.assign(ES, {
    'Import bank file': 'Importar archivo del banco', 
    
    
    
    
    
    
    
    
    
    'Check the preview before importing.': 'Revisa la vista previa antes de importar.',
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    'money in': 'entradas', 'money out': 'salidas', 'any': 'cualquiera',
    // messages from the readers
    'The file is empty.': 'El archivo está vacío.', 'Could not find Date and Amount columns. Expected headers like Date, Description, Amount (or Debit and Credit).': 'No se encontraron las columnas Date y Amount. Se esperaban encabezados como Date, Description, Amount (o Debit y Credit).',
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    });
/* full version only */
  L.ES = ES;
  if (typeof module !== 'undefined' && module.exports) module.exports = { ES, PAT, tx };
})();
