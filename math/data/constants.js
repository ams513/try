/* Stark Math. Physical constants and chemistry data.
   Constants: CODATA 2018 recommended values (NIST Special Publication 961, May 2019; physics.nist.gov/constants).
   Values marked exact are fixed by the 2019 redefinition of the SI (or by definition, for g_n and the atmosphere).
   Atomic weights: IUPAC abridged standard atomic weights (CIAAW, 2021), conventional values for H, C, N, O and Cl.
   Each JSON block is read by the app and, unchanged, by the test suite. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const D = G.SM_DATA = G.SM_DATA || {};
  D.constants = /*JSON:constants*/{
    "source": "CODATA 2018 recommended values, NIST SP 961 (2019); exact values from the 2019 SI redefinition",
    "list": [
      { "id": "c", "sym": "c", "name": "speed of light in vacuum", "value": 299792458, "unit": "m/s", "exact": true },
      { "id": "h", "sym": "h", "name": "Planck constant", "value": 6.62607015e-34, "unit": "J s", "exact": true },
      { "id": "hbar", "sym": "ħ", "name": "reduced Planck constant", "value": 1.054571817e-34, "unit": "J s", "exact": false, "note": "h / 2π, exact in principle; shown to 10 significant figures" },
      { "id": "e", "sym": "e", "name": "elementary charge", "value": 1.602176634e-19, "unit": "C", "exact": true },
      { "id": "kB", "sym": "k_B", "name": "Boltzmann constant", "value": 1.380649e-23, "unit": "J/K", "exact": true },
      { "id": "NA", "sym": "N_A", "name": "Avogadro constant", "value": 6.02214076e23, "unit": "1/mol", "exact": true },
      { "id": "R", "sym": "R", "name": "molar gas constant", "value": 8.314462618, "unit": "J/(mol K)", "exact": true, "note": "N_A k_B, exact; shown to 10 significant figures" },
      { "id": "F", "sym": "F", "name": "Faraday constant", "value": 96485.33212, "unit": "C/mol", "exact": true, "note": "N_A e, exact; shown to 10 significant figures" },
      { "id": "G", "sym": "G", "name": "Newtonian constant of gravitation", "value": 6.67430e-11, "unit": "N m^2/kg^2", "exact": false, "uncertainty": 1.5e-15 },
      { "id": "gn", "sym": "g_n", "name": "standard acceleration of gravity", "value": 9.80665, "unit": "m/s^2", "exact": true, "note": "conventional value (3rd CGPM, 1901)" },
      { "id": "me", "sym": "m_e", "name": "electron mass", "value": 9.1093837015e-31, "unit": "kg", "exact": false, "uncertainty": 2.8e-40 },
      { "id": "mp", "sym": "m_p", "name": "proton mass", "value": 1.67262192369e-27, "unit": "kg", "exact": false, "uncertainty": 5.1e-37 },
      { "id": "mn", "sym": "m_n", "name": "neutron mass", "value": 1.67492749804e-27, "unit": "kg", "exact": false, "uncertainty": 9.5e-37 },
      { "id": "u", "sym": "u", "name": "atomic mass constant", "value": 1.66053906660e-27, "unit": "kg", "exact": false, "uncertainty": 5.0e-37 },
      { "id": "eps0", "sym": "ε₀", "name": "vacuum electric permittivity", "value": 8.8541878128e-12, "unit": "F/m", "exact": false, "uncertainty": 1.3e-21 },
      { "id": "mu0", "sym": "μ₀", "name": "vacuum magnetic permeability", "value": 1.25663706212e-6, "unit": "N/A^2", "exact": false, "uncertainty": 1.9e-16 },
      { "id": "ke", "sym": "k", "name": "Coulomb constant 1/(4πε₀)", "value": 8.9875517923e9, "unit": "N m^2/C^2", "exact": false, "note": "derived from ε₀" },
      { "id": "sigma", "sym": "σ", "name": "Stefan-Boltzmann constant", "value": 5.670374419e-8, "unit": "W/(m^2 K^4)", "exact": true, "note": "exact; shown to 10 significant figures" },
      { "id": "a0", "sym": "a₀", "name": "Bohr radius", "value": 5.29177210903e-11, "unit": "m", "exact": false, "uncertainty": 8.0e-21 },
      { "id": "Ry", "sym": "R_∞hc", "name": "Rydberg energy", "value": 13.605693122994, "unit": "eV", "exact": false, "uncertainty": 2.6e-11 },
      { "id": "b", "sym": "b", "name": "Wien wavelength displacement constant", "value": 2.897771955e-3, "unit": "m K", "exact": true, "note": "exact; shown to 10 significant figures" },
      { "id": "atm", "sym": "atm", "name": "standard atmosphere", "value": 101325, "unit": "Pa", "exact": true },
      { "id": "eV", "sym": "eV", "name": "electronvolt", "value": 1.602176634e-19, "unit": "J", "exact": true }
    ]
  }/*END*/;
  D.elements = /*JSON:elements*/{
    "source": "IUPAC abridged standard atomic weights (CIAAW 2021); conventional values for elements with interval weights",
    "list": [
      ["H", "hydrogen", 1.008], ["He", "helium", 4.0026], ["Li", "lithium", 6.94], ["C", "carbon", 12.011], ["N", "nitrogen", 14.007],
      ["O", "oxygen", 15.999], ["F", "fluorine", 18.998], ["Na", "sodium", 22.990], ["Mg", "magnesium", 24.305], ["Al", "aluminium", 26.982],
      ["Si", "silicon", 28.085], ["P", "phosphorus", 30.974], ["S", "sulfur", 32.06], ["Cl", "chlorine", 35.45], ["K", "potassium", 39.098],
      ["Ca", "calcium", 40.078], ["Fe", "iron", 55.845], ["Cu", "copper", 63.546], ["Zn", "zinc", 65.38], ["Ag", "silver", 107.87], ["Br", "bromine", 79.904], ["I", "iodine", 126.90]
    ]
  }/*END*/;
  D.C = {}; D.constants.list.forEach(c => { D.C[c.id] = c.value; });
  D.AW = {}; D.elements.list.forEach(e => { D.AW[e[0]] = e[2]; });
})();
