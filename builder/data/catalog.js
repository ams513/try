/* Stark Builder, by Stark. Furniture library, electrical and plumbing planning symbols, and the generic permit checklist.
   Furniture sizes are typical catalogue sizes for space planning; measure the pieces you will really use.
   Electrical and plumbing symbols mark where you want things. They are a wish list for your electrician and plumber,
   not a wiring or pipe design: licensed trades design, size and certify the systems.
   The permit checklist is a generic template. Rules, names and steps vary by country, state, county and council. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};

  // id, label, width (m), depth (m), height (m, for the 3D sketch), group
  const FURN = [
    ['bed-single', 'Single bed', 0.9, 2.0, 0.5, 'Bedroom'], ['bed-double', 'Double bed', 1.4, 2.0, 0.5, 'Bedroom'],
    ['bed-queen', 'Queen bed', 1.6, 2.05, 0.5, 'Bedroom'], ['bed-king', 'King bed', 1.9, 2.1, 0.5, 'Bedroom'],
    ['bunk', 'Bunk bed', 0.95, 2.0, 1.6, 'Bedroom'], ['crib', 'Cot or crib', 0.7, 1.3, 0.9, 'Bedroom'],
    ['wardrobe', 'Wardrobe', 1.2, 0.6, 2.0, 'Bedroom'], ['dresser', 'Chest of drawers', 0.9, 0.5, 0.9, 'Bedroom'],
    ['nightstand', 'Bedside table', 0.45, 0.4, 0.55, 'Bedroom'],
    ['sofa-3', 'Sofa, 3 seats', 2.1, 0.9, 0.85, 'Living'], ['sofa-2', 'Sofa, 2 seats', 1.6, 0.9, 0.85, 'Living'],
    ['armchair', 'Armchair', 0.85, 0.85, 0.85, 'Living'], ['coffee', 'Coffee table', 1.1, 0.6, 0.45, 'Living'],
    ['tv', 'TV unit', 1.6, 0.45, 0.6, 'Living'], ['bookcase', 'Bookcase', 0.9, 0.35, 1.9, 'Living'],
    ['stove-wood', 'Wood stove (with clearances)', 0.6, 0.6, 0.9, 'Living'],
    ['table-4', 'Dining table, 4 seats', 1.2, 0.8, 0.75, 'Dining'], ['table-6', 'Dining table, 6 seats', 1.8, 0.9, 0.75, 'Dining'],
    ['chair', 'Chair', 0.45, 0.5, 0.9, 'Dining'],
    ['counter', 'Kitchen counter, 1 m', 1.0, 0.6, 0.9, 'Kitchen'], ['sink-k', 'Kitchen sink unit', 0.8, 0.6, 0.9, 'Kitchen'],
    ['range', 'Cooker or range', 0.6, 0.6, 0.9, 'Kitchen'], ['fridge', 'Fridge', 0.7, 0.7, 1.8, 'Kitchen'],
    ['island', 'Kitchen island', 1.6, 0.9, 0.9, 'Kitchen'],
    ['toilet', 'Toilet', 0.4, 0.7, 0.8, 'Bath'], ['basin', 'Washbasin', 0.6, 0.45, 0.85, 'Bath'],
    ['shower', 'Shower tray, 0.9 m', 0.9, 0.9, 0.08, 'Bath'], ['bath', 'Bathtub', 0.75, 1.7, 0.55, 'Bath'],
    ['washer', 'Washing machine', 0.6, 0.6, 0.85, 'Utility'], ['dryer', 'Dryer', 0.6, 0.6, 0.85, 'Utility'],
    ['heater', 'Water heater', 0.6, 0.6, 1.5, 'Utility'],
    ['desk', 'Desk', 1.2, 0.6, 0.75, 'Work'], ['workbench', 'Workbench', 1.8, 0.7, 0.9, 'Work'], ['shelves', 'Shelving', 1.0, 0.45, 1.8, 'Work']
  ].map(r => ({ id: r[0], label: r[1], w: r[2], d: r[3], h: r[4], group: r[5] }));

  // id, label, short symbol text
  const MARKERS = {
    elec: [['outlet', 'Power outlet', 'O'], ['outlet-2', 'Double outlet', 'OO'], ['switch', 'Light switch', 'S'], ['light', 'Ceiling light', 'L'],
      ['wall-light', 'Wall light', 'WL'], ['fan', 'Extractor fan', 'F'], ['smoke', 'Smoke alarm', 'SA'], ['co-alarm', 'Carbon monoxide alarm', 'CO'],
      ['data', 'Data or TV point', 'D'], ['panel', 'Electrical panel', 'P'], ['ev', 'EV charger', 'EV'], ['ext-light', 'Outdoor light', 'XL']],
    plumb: [['supply', 'Water supply point', 'W'], ['drain', 'Floor drain', 'FD'], ['wc', 'Toilet connection', 'WC'], ['basin-pt', 'Basin connection', 'B'],
      ['shower-pt', 'Shower connection', 'SH'], ['kitchen-pt', 'Kitchen sink connection', 'KS'], ['washer-pt', 'Washer connection', 'WM'],
      ['heater-pt', 'Water heater connection', 'WH'], ['hose', 'Outdoor tap', 'HB'], ['vent', 'Vent stack', 'V'], ['cleanout', 'Clean-out', 'CL'], ['gas', 'Gas point', 'G']]
  };
  const markers = {};
  Object.keys(MARKERS).forEach(cat => { markers[cat] = MARKERS[cat].map(r => ({ id: r[0], label: r[1], sym: r[2], cat })); });

  const PERMIT_PHASES = ['Before you design', 'Before you apply', 'Your application', 'During the build', 'Before you move in'];
  // id, phase index, text
  const PERMITS = [
    ['zoning', 0, 'Confirm the zoning allows what you plan: a home, an accessory dwelling, a cabin, a small village or a work building.'],
    ['minsize', 0, 'Ask whether there is a minimum dwelling size, and whether a tiny home on wheels counts as a dwelling, a vehicle or a recreational vehicle.'],
    ['setbacks', 0, 'Get the real setbacks, height limit, lot coverage and parking rules for your lot.'],
    ['easements', 0, 'Check the deed and survey for easements, covenants or association rules.'],
    ['hazards', 0, 'Check flood, wildfire, snow, wind and earthquake zones that change the design.'],
    ['utilities', 0, 'Confirm the water, sewer or septic, and power options and whether each needs its own permit.'],
    ['preapp', 1, 'Book a pre-application meeting or call with the building department.'],
    ['pro', 1, 'Hire a licensed architect or engineer where the law requires stamped drawings.'],
    ['perc', 1, 'Arrange a soil or percolation test if a septic system is planned.'],
    ['energyform', 1, 'Ask which energy-efficiency compliance forms or calculations are required.'],
    ['siteplan', 2, 'Site plan drawn to scale: buildings, setbacks, driveway and utilities.'],
    ['drawings', 2, 'Floor plans, elevations, sections and structural details as required.'],
    ['forms', 2, 'Application forms, owner authorisation and fees.'],
    ['trades', 2, 'Separate electrical, plumbing, mechanical or gas permits, usually pulled by licensed trades.'],
    ['other', 2, 'Other approvals: driveway or road access, tree removal, well, septic, fire access.'],
    ['i-footing', 3, 'Inspection: footings or foundation before concrete.'],
    ['i-frame', 3, 'Inspection: framing.'],
    ['i-rough', 3, 'Inspection: rough-in plumbing, electrical and mechanical.'],
    ['i-insul', 3, 'Inspection: insulation and air sealing.'],
    ['changes', 3, 'Get approval before changing the approved drawings.'],
    ['i-final', 4, 'Final inspection.'],
    ['occupancy', 4, 'Certificate of occupancy or completion, where your authority issues one.'],
    ['records', 4, 'Keep the approved drawings, permits and inspection records with the property papers.']
  ].map(r => ({ id: r[0], phase: r[1], text: r[2] }));

  const api = {
    FURN, markers, PERMIT_PHASES, PERMITS,
    furn: id => FURN.find(f => f.id === id) || null,
    marker: (cat, id) => (markers[cat] || []).find(m => m.id === id) || null
  };
  SB.catalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
