/* Stark Tenancy: product facts and the notices shown across the app. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  TN.data = TN.data || {};
  TN.data.meta = {
    version: '1.1.2', itchUrl: 'https://starkforall.com/tenancy.html', asOf: '2026-11-20', asOfLabel: 'November 20, 2026',
    notLegal: 'Not legal advice. Check your state\'s landlord-tenant law or a local legal aid office.',
    notLegalEs: 'No es asesoría legal. Consulte la ley de arrendamiento de su estado o una oficina local de asistencia legal.',
    general: 'These are general templates and records. Rules for repairs, deposits, notices and alarms are set by state and local law and by your lease, and they differ from place to place.',
    generalEs: 'Son plantillas y registros generales. Las reglas sobre reparaciones, depósitos, avisos y alarmas las fijan la ley estatal y local y su contrato, y cambian de un lugar a otro.',
    mtEs: 'Traducción automática, pendiente de revisión. El texto en inglés es la referencia.',
    onlyEnEs: 'Esta pantalla solo está en inglés por ahora.',
    byDesign: 'No tenant screening, no credit checks, no blacklists, no accounts, no tracking.',
    byDesignEs: 'Sin evaluación de inquilinos, sin revisión de crédito, sin listas negras, sin cuentas, sin rastreo.'
  };
  /* nav labels in Spanish (machine translation pending review) */
  TN.data.navEs = { home: 'Inicio', reports: 'Entrada y salida', repairs: 'Reparaciones', ledger: 'Renta y depósito', letters: 'Cartas', safety: 'Alarmas', insight: 'Información', help: 'Ayuda' };
})(typeof window !== 'undefined' ? window : globalThis);
