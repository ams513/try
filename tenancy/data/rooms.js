/* Stark Tenancy: rooms, the things to check in each, and the condition scale for move-in and move-out reports. */
(function (root) {
  'use strict';
  var TN = root.TN = root.TN || {};
  TN.data = TN.data || {};

  TN.data.items = {
    walls: ['Walls and paint', 'Paredes y pintura'], ceiling: ['Ceiling', 'Techo'], floor: ['Floor or carpet', 'Piso o alfombra'],
    windows: ['Windows and screens', 'Ventanas y mosquiteros'], blinds: ['Blinds or curtains', 'Persianas o cortinas'], doors: ['Doors and locks', 'Puertas y cerraduras'],
    lights: ['Lights and switches', 'Luces e interruptores'], outlets: ['Outlets', 'Enchufes'], closet: ['Closet', 'Clóset'], heating: ['Heating or cooling', 'Calefacción o aire'],
    cabinets: ['Cabinets and drawers', 'Gabinetes y cajones'], counters: ['Counters', 'Mostradores'], sink: ['Sink and faucet', 'Lavabo y llave'],
    stove: ['Stove and oven', 'Estufa y horno'], fridge: ['Refrigerator', 'Refrigerador'], dishwasher: ['Dishwasher', 'Lavavajillas'], vent: ['Range hood or fan', 'Campana o extractor'],
    toilet: ['Toilet', 'Inodoro'], tub: ['Tub or shower', 'Tina o regadera'], tiles: ['Tiles and grout', 'Azulejos y juntas'], mirror: ['Mirror and cabinet', 'Espejo y botiquín'],
    fan: ['Exhaust fan', 'Extractor de aire'], washer: ['Washer', 'Lavadora'], dryer: ['Dryer', 'Secadora'], railings: ['Railings and steps', 'Barandales y escalones'],
    ground: ['Ground, deck or balcony', 'Suelo, terraza o balcón'], garagedoor: ['Garage door', 'Puerta de cochera'], smoke: ['Smoke alarms', 'Alarmas de humo'],
    co: ['Carbon monoxide alarms', 'Alarmas de monóxido de carbono'], extinguisher: ['Fire extinguisher', 'Extintor'], keys: ['Keys, fobs and remotes', 'Llaves, tarjetas y controles']
  };

  TN.data.roomTypes = [
    { id: 'entry', en: 'Entry and hallway', es: 'Entrada y pasillo', items: ['walls', 'ceiling', 'floor', 'doors', 'lights', 'outlets', 'closet'] },
    { id: 'living', en: 'Living room', es: 'Sala', items: ['walls', 'ceiling', 'floor', 'windows', 'blinds', 'doors', 'lights', 'outlets', 'heating'] },
    { id: 'kitchen', en: 'Kitchen', es: 'Cocina', items: ['walls', 'ceiling', 'floor', 'windows', 'cabinets', 'counters', 'sink', 'stove', 'fridge', 'dishwasher', 'vent', 'lights', 'outlets'] },
    { id: 'dining', en: 'Dining area', es: 'Comedor', items: ['walls', 'ceiling', 'floor', 'windows', 'lights', 'outlets'] },
    { id: 'bedroom', en: 'Bedroom', es: 'Dormitorio', items: ['walls', 'ceiling', 'floor', 'windows', 'blinds', 'doors', 'closet', 'lights', 'outlets'] },
    { id: 'bathroom', en: 'Bathroom', es: 'Baño', items: ['walls', 'ceiling', 'floor', 'sink', 'toilet', 'tub', 'tiles', 'mirror', 'fan', 'lights', 'outlets'] },
    { id: 'laundry', en: 'Laundry', es: 'Lavandería', items: ['walls', 'floor', 'washer', 'dryer', 'outlets'] },
    { id: 'outdoor', en: 'Outside, balcony or yard', es: 'Exterior, balcón o patio', items: ['doors', 'railings', 'ground', 'lights'] },
    { id: 'garage', en: 'Garage or storage', es: 'Cochera o bodega', items: ['walls', 'floor', 'garagedoor', 'lights'] },
    { id: 'safety', en: 'Safety items and keys', es: 'Seguridad y llaves', items: ['smoke', 'co', 'extinguisher', 'keys'] }
  ];

  TN.data.presets = [
    { id: 'studio', en: 'Studio', es: 'Estudio', rooms: ['entry', 'living', 'kitchen', 'bathroom', 'safety'] },
    { id: 'one', en: '1 bedroom', es: '1 dormitorio', rooms: ['entry', 'living', 'kitchen', 'bedroom', 'bathroom', 'safety'] },
    { id: 'two', en: '2 bedrooms', es: '2 dormitorios', rooms: ['entry', 'living', 'kitchen', 'dining', 'bedroom', 'bedroom', 'bathroom', 'safety'] },
    { id: 'house', en: 'House', es: 'Casa', rooms: ['entry', 'living', 'kitchen', 'dining', 'bedroom', 'bedroom', 'bedroom', 'bathroom', 'bathroom', 'laundry', 'outdoor', 'garage', 'safety'] }
  ];

  /* rank orders the scale for move-in vs move-out comparison; "not present" has no rank */
  TN.data.conditions = [
    { v: 'good', en: 'Good', es: 'Bueno', rank: 0 },
    { v: 'fair', en: 'Fair, some wear', es: 'Regular, algo de desgaste', rank: 1 },
    { v: 'poor', en: 'Poor, needs work', es: 'Malo, necesita arreglo', rank: 2 },
    { v: 'damaged', en: 'Damaged or broken', es: 'Dañado o roto', rank: 3 },
    { v: 'na', en: 'Not present', es: 'No hay', rank: null }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
