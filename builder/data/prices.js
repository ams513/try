/* Stark Builder, by Stark. Default unit prices and regions.
   EVERY NUMBER HERE IS AN EXAMPLE to be replaced with local supplier quotes. They are rough, round, currency-neutral
   placeholders so the takeoff works on first open; they are not market data and not a quote. */
(function (g) {
  'use strict';
  const SB = g.SB = g.SB || {};
  const items = [
    // key, label, unit, example price, group
    ['stud_2x6', 'Wall framing, 2x6 (38 x 140 mm) exterior walls', 'lm', 2.9, 'Lumber'],
    ['stud_2x4', 'Wall framing, 2x4 (38 x 89 mm) interior walls', 'lm', 1.65, 'Lumber'],
    ['joist_2x8', 'Floor joists and window/door headers, 2x8', 'lm', 4.5, 'Lumber'],
    ['rafter_2x6', 'Roof rafters or joists, 2x6', 'lm', 2.9, 'Lumber'],
    ['osb_wall', 'Wall sheathing, 11 mm panel 1220 x 2440', 'sheet', 16, 'Sheathing'],
    ['osb_sub', 'Subfloor panel, 18 mm 1220 x 2440', 'sheet', 28, 'Sheathing'],
    ['osb_roof', 'Roof sheathing, 12 mm panel 1220 x 2440', 'sheet', 18, 'Sheathing'],
    ['cladding', 'Exterior cladding (siding)', 'm2', 30, 'Cladding'],
    ['roofing', 'Roofing, installed material only', 'm2', 22, 'Roofing'],
    ['insulation', 'Insulation, walls, ceiling and floor', 'm2', 12, 'Insulation'],
    ['drywall', 'Drywall, 12.7 mm sheet 1220 x 2440', 'sheet', 14, 'Drywall'],
    ['flooring', 'Finish flooring', 'm2', 35, 'Flooring'],
    ['window', 'Windows, by glazed area', 'm2', 260, 'Windows'],
    ['door_ext', 'Exterior door', 'each', 450, 'Doors'],
    ['door_int', 'Interior door', 'each', 120, 'Doors'],
    ['door_patio', 'Wide patio / sliding door (over 1.5 m)', 'each', 900, 'Doors'],
    ['stair', 'Straight stair flight, site-built or kit (allowance)', 'each', 1400, 'Stairs'],
    ['svc_elec', 'Electrical point you marked, rough-in allowance', 'each', 90, 'Services'],
    ['svc_plumb', 'Plumbing point you marked, rough-in allowance', 'each', 380, 'Services'],
    ['misc_pct', 'Fasteners, tape, flashing and small items (allowance)', '%', 5, 'Allowance'],
    ['site_path', 'Gravel path, per m2', 'm2', 25, 'Site'],
    ['site_solar', 'Solar array (placeholder allowance)', 'each', 9000, 'Site'],
    ['site_water', 'Water supply, well or tank (placeholder allowance)', 'each', 6500, 'Site'],
    ['site_septic', 'Septic or sewer connection (placeholder allowance)', 'each', 12500, 'Site'],
    ['site_power', 'Power service pole or panel (placeholder allowance)', 'each', 2800, 'Site'],
    ['site_parking', 'Gravel parking pad (placeholder allowance)', 'each', 1800, 'Site']
  ];
  const defaults = {}; items.forEach(r => { defaults[r[0]] = r[3]; });
  const regions = [
    { id: 'baseline', label: 'Baseline (x1.00)', mult: 1.0 },
    { id: 'rural', label: 'Low-cost rural (x0.85)', mult: 0.85 },
    { id: 'metro', label: 'Average metro area (x1.10)', mult: 1.10 },
    { id: 'high', label: 'High-cost coastal (x1.35)', mult: 1.35 },
    { id: 'remote', label: 'Remote or island (x1.60)', mult: 1.60 },
    { id: 'custom', label: 'Custom multiplier', mult: 1.0 }
  ];
  SB.prices = { items, defaults, regions };
  if (typeof module !== 'undefined' && module.exports) module.exports = SB.prices;
})(typeof window !== 'undefined' ? window : globalThis);
