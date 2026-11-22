/* Stark Tenancy: official tenant-rights and safety resources. Addresses are stored as plain text (no scheme) and shown with
   a Copy button; the app never opens them. "checked" is the date each address was confirmed to load (HTTP 200) and show the
   page named in "title". Pages move: check the date. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  TN.data = TN.data || {};
  var C = '2026-11-20';
  function R(group, org, title, url, note, noteEs) { return { group: group, org: org, title: title, url: url, source: org, checked: C, note: note || '', noteEs: noteEs || '' }; }

  TN.data.resourceGroups = [
    { id: 'federal', en: 'Federal tenant rights and housing', es: 'Derechos de inquilinos y vivienda (federal)' },
    { id: 'state', en: 'State attorneys general', es: 'Fiscalías generales estatales' },
    { id: 'legal', en: 'Free or low-cost legal help', es: 'Ayuda legal gratuita o de bajo costo' },
    { id: 'safety', en: 'Smoke and carbon monoxide alarms, lead', es: 'Alarmas de humo y monóxido de carbono, plomo' }
  ];

  TN.data.resources = [
    R('federal', 'U.S. Department of Housing and Urban Development (HUD)', 'Rental assistance: tenant rights', 'www.hud.gov/topics/rental_assistance/tenantrights',
      'HUD’s tenant-rights page, in its rental assistance section.', 'La página de HUD sobre derechos de inquilinos, en su sección de ayuda para la renta.'),
    R('federal', 'U.S. Department of Housing and Urban Development (HUD)', 'State information', 'www.hud.gov/states',
      'HUD’s pages for each state.', 'Las páginas de HUD para cada estado.'),
    R('federal', 'U.S. Department of Housing and Urban Development (HUD)', 'Fair housing', 'www.hud.gov/fairhousing',
      'Discrimination in housing because of race, color, religion, sex, national origin, familial status or disability is against federal law.', 'La discriminación en la vivienda por raza, color, religión, sexo, origen nacional, situación familiar o discapacidad va contra la ley federal.'),
    R('federal', 'U.S. Department of Housing and Urban Development (HUD)', 'Report housing discrimination', 'www.hud.gov/program_offices/fair_housing_equal_opp/online-complaint'),
    R('federal', 'U.S. Department of Justice, Civil Rights Division', 'The Fair Housing Act', 'www.justice.gov/crt/fair-housing-act-1'),
    R('federal', 'USAGov', 'How to file a complaint against a landlord', 'www.usa.gov/tenant-rights'),
    R('federal', 'USAGov', 'Housing help', 'www.usa.gov/housing-help'),
    R('federal', 'Consumer Financial Protection Bureau (CFPB)', 'Get help paying rent and bills', 'www.consumerfinance.gov/housing/housing-insecurity/help-for-renters/get-help-paying-rent-and-bills/'),
    R('state', 'USAGov', 'State attorneys general: find yours', 'www.usa.gov/state-attorney-general',
      'Many state attorneys general publish a tenant guide and take consumer complaints.', 'Muchas fiscalías generales estatales publican una guía para inquilinos y reciben quejas.'),
    R('state', 'California Department of Justice, Office of the Attorney General', 'Landlord-tenant issues', 'oag.ca.gov/tenants'),
    R('state', 'New York State Attorney General', 'Residential tenants’ rights guide', 'ag.ny.gov/publications/residential-tenants-rights-guide'),
    R('state', 'Office of the Attorney General of Texas', 'Renter’s rights', 'www.texasattorneygeneral.gov/consumer-protection/home-real-estate-and-travel/renters-rights'),
    R('state', 'Washington State Office of the Attorney General', 'Landlord-tenant', 'www.atg.wa.gov/landlord-tenant'),
    R('state', 'Minnesota Attorney General’s Office', 'Landlords and tenants: rights and responsibilities (handbook)', 'ag.state.mn.us/Consumer/Handbooks/LT/default.asp'),
    R('legal', 'Legal Services Corporation (LSC)', 'I need legal help: find a legal aid office near you', 'www.lsc.gov/about-lsc/what-legal-aid/i-need-legal-help',
      'LSC funds civil legal aid offices across the country. Many help with housing problems for free if you qualify.', 'LSC financia oficinas de asistencia legal civil en todo el país. Muchas ayudan gratis con problemas de vivienda si usted califica.'),
    R('safety', 'U.S. Fire Administration (FEMA)', 'Smoke alarms', 'www.usfa.fema.gov/prevention/home-fires/prepare-for-fire/smoke-alarms/',
      'Test smoke alarms monthly. Replace 9-volt batteries at least once a year. Replace a smoke alarm 10 years from its manufacture date, or as its maker says for sealed long-life alarms.',
      'Pruebe las alarmas de humo cada mes. Cambie las baterías de 9 voltios al menos una vez al año. Reemplace la alarma 10 años después de su fecha de fabricación, o según el fabricante si es de batería sellada.'),
    R('safety', 'National Fire Protection Association (NFPA)', 'Smoke alarms', 'www.nfpa.org/education-and-research/home-fire-safety/smoke-alarms'),
    R('safety', 'National Fire Protection Association (NFPA)', 'Carbon monoxide safety', 'www.nfpa.org/education-and-research/home-fire-safety/carbon-monoxide',
      'Test carbon monoxide alarms at least once a month, and replace them as the maker’s instructions say.', 'Pruebe las alarmas de monóxido de carbono al menos una vez al mes y reemplácelas según las instrucciones del fabricante.'),
    R('safety', 'U.S. Environmental Protection Agency (EPA)', 'Carbon monoxide’s impact on indoor air quality', 'www.epa.gov/indoor-air-quality-iaq/carbon-monoxides-impact-indoor-air-quality'),
    R('safety', 'U.S. Environmental Protection Agency (EPA)', 'Real estate disclosures about potential lead hazards', 'www.epa.gov/lead/real-estate-disclosures-about-potential-lead-hazards',
      'For most homes built before 1978, federal rules require lead-paint disclosure before a lease is signed.', 'En la mayoría de las viviendas construidas antes de 1978, las reglas federales exigen informar sobre pintura con plomo antes de firmar el contrato.')
  ];
})(typeof window !== 'undefined' ? window : globalThis);
