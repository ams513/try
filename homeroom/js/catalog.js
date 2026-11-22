/* Stark Homeroom. The lessons Homeroom can plan with: Stark IntraTheater lesson sets and
   Stark World Engine Classroom lesson packs. ids match those apps (tests/test_homeroom.py checks them when the apps are installed). */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const L = (id, title, band, kind) => ({ id, title, band, kind });
  const INTRA = [
    L('k2-first-people', 'The very first people', 'K-2', 'History and geography'),
    L('k2-pyramid-builders', 'Kings and pyramids of Egypt', 'K-2', 'History and geography'),
    L('k2-ocean-voyagers', 'Canoes across the ocean', 'K-2', 'History and geography'),
    L('k2-big-ideas', 'Big ideas that changed everything', 'K-2', 'History and geography'),
    L('k2-up-to-the-sky', 'Up to the sky and the Moon', 'K-2', 'History and geography'),
    L('35-river-civilizations', 'Cities by the rivers', '3-5', 'History and geography'),
    L('35-greece-and-rome', 'Ancient Greece and Rome', '3-5', 'History and geography'),
    L('35-silk-roads', 'Trading goods and ideas on the Silk Roads', '3-5', 'History and geography'),
    L('35-west-africa-empires', 'Gold, griots and great walls in Africa', '3-5', 'History and geography'),
    L('35-great-voyages', 'Great voyages, big changes', '3-5', 'History and geography'),
    L('68-age-of-revolutions', 'The age of revolutions', '6-8', 'History and geography'),
    L('68-machines-and-science', 'Science and the machine age', '6-8', 'History and geography'),
    L('68-war-and-peace', 'From world wars to the United Nations', '6-8', 'History and geography'),
    L('68-rights-and-freedom', 'Winning rights and freedom', '6-8', 'History and geography'),
    L('68-discovery-age', 'Medicine, DNA and the World Wide Web', '6-8', 'History and geography'),
    L('x-k2-planet-tour', 'A tour of the planets', 'K-2', 'Explorers'),
    L('x-k2-body-tour', 'A tour of my body', 'K-2', 'Explorers'),
    L('x-k2-say-hello', 'Say hello around the world', 'K-2', 'Explorers'),
    L('x-k2-pie-fractions', 'Pies, halves and quarters', 'K-2', 'Explorers'),
    L('x-k2-shape-hunt', 'Shape hunt', 'K-2', 'Explorers'),
    L('x-k2-colourful-art', 'Colours and shapes in art', 'K-2', 'Explorers'),
    L('x-35-elements-around-us', 'Elements all around us', '3-5', 'Explorers'),
    L('x-35-planets-moons', 'Planets and their moons', '3-5', 'Explorers'),
    L('x-35-body-systems', 'How my body systems work together', '3-5', 'Explorers'),
    L('x-35-times-tables', 'Times tables mastery', '3-5', 'Explorers'),
    L('x-35-art-around-world', 'Art from around the world', '3-5', 'Explorers'),
    L('x-35-count-in-ten', 'Counting to ten in new languages', '3-5', 'Explorers'),
    L('x-68-periodic-patterns', 'Patterns in the periodic table', '6-8', 'Explorers'),
    L('x-68-scale-of-space', 'The scale of the solar system', '6-8', 'Explorers'),
    L('x-68-music-through-ages', 'Music through the ages', '6-8', 'Explorers'),
    L('x-68-angles-graphs', 'Angles and graphs', '6-8', 'Explorers')
  ];
  const WORLD = [
    { id: 'loops', title: 'Loops and patterns: Lantern Row', concept: 'Loops and patterns', minutes: 40 },
    { id: 'cause', title: 'Cause and effect: The Dark Path', concept: 'Cause and effect with quests', minutes: 45 },
    { id: 'coords', title: 'Coordinates and maps: Treasure Map', concept: 'Coordinates and maps', minutes: 40 },
    { id: 'story', title: 'Story structure: Three Acts', concept: 'Story structure', minutes: 50 },
    { id: 'economy', title: 'A simple economy: Market Day', concept: 'Items, value and trade', minutes: 45 },
    { id: 'debug', title: 'Debugging: The Broken Level', concept: 'Debugging', minutes: 45 }
  ];
  const api = { INTRA, WORLD };
  SHR.catalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
