/* Stark Event Kit question bank, part 1: geography, history, science, nature.
   Row format: [question, correct answer, wrong 1, wrong 2, wrong 3, optional source note]. */
(function (g) {
  'use strict';
  var S = g.SEK = g.SEK || {}; S.RAW = S.RAW || [];
  function A(c, d, rows) { S.RAW.push({ cat: c, diff: d, rows: rows }); }

  A('geography', 'easy', [
    ['What is the capital of France?', 'Paris', 'Lyon', 'Marseille', 'Nice'],
    ['Which is the largest ocean on Earth?', 'Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'],
    ['On which continent is Egypt mostly located?', 'Africa', 'Asia', 'Europe', 'South America'],
    ['What is the capital of Japan?', 'Tokyo', 'Kyoto', 'Osaka', 'Nagoya'],
    ['In which country is the city of Sydney?', 'Australia', 'New Zealand', 'South Africa', 'Canada'],
    ['Mount Everest lies on the border between Nepal and which country?', 'China', 'India', 'Bhutan', 'Pakistan'],
    ['What is the capital of Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montreal'],
    ['Which river flows through the Egyptian capital, Cairo?', 'Nile', 'Congo', 'Niger', 'Zambezi'],
    ['The Sahara, the largest hot desert, is on which continent?', 'Africa', 'Asia', 'Australia', 'South America'],
    ['What is the capital of Italy?', 'Rome', 'Milan', 'Venice', 'Naples'],
    ['Which European country has a coastline shaped like a boot?', 'Italy', 'Greece', 'Portugal', 'Croatia'],
    ['Which continent has the smallest land area?', 'Australia (Oceania)', 'Europe', 'Antarctica', 'South America'],
    ['What is the capital of Spain?', 'Madrid', 'Barcelona', 'Seville', 'Valencia'],
    ['Which ocean lies between Africa and Australia?', 'Indian Ocean', 'Atlantic Ocean', 'Arctic Ocean', 'Southern Ocean'],
    ['What is the capital of Brazil?', 'Brasilia', 'Rio de Janeiro', 'Sao Paulo', 'Salvador'],
    ['Which sea lies between southern Europe and North Africa?', 'Mediterranean Sea', 'Baltic Sea', 'Black Sea', 'Red Sea'],
    ['What is the capital of Germany?', 'Berlin', 'Munich', 'Hamburg', 'Frankfurt']
  ]);
  A('geography', 'medium', [
    ['What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'],
    ['Which is the longest river in South America?', 'Amazon', 'Orinoco', 'Parana', 'Sao Francisco', 'Longest within South America; the world ranking of Nile versus Amazon is disputed, so this question stays continental.'],
    ['What is the capital of Turkey?', 'Ankara', 'Istanbul', 'Izmir', 'Bursa'],
    ['Which strait separates Spain from Morocco?', 'Strait of Gibraltar', 'Bosphorus', 'Strait of Hormuz', 'Strait of Malacca'],
    ['Lake Titicaca lies on the border of Peru and which other country?', 'Bolivia', 'Chile', 'Ecuador', 'Colombia'],
    ['What is the capital of New Zealand?', 'Wellington', 'Auckland', 'Christchurch', 'Hamilton'],
    ['Nairobi is the capital of which country?', 'Kenya', 'Tanzania', 'Uganda', 'Ethiopia'],
    ['Which country has the largest land area in the world?', 'Russia', 'Canada', 'China', 'United States'],
    ['Which desert covers much of Mongolia and northern China?', 'Gobi Desert', 'Thar Desert', 'Kalahari Desert', 'Atacama Desert'],
    ['What is the capital of Argentina?', 'Buenos Aires', 'Cordoba', 'Rosario', 'Mendoza'],
    ['Which mountain range is the conventional boundary between Europe and Asia in Russia?', 'Ural Mountains', 'Alps', 'Carpathians', 'Pyrenees'],
    ['What is the capital of Nigeria?', 'Abuja', 'Lagos', 'Kano', 'Ibadan'],
    ['Which is the largest US state by area?', 'Alaska', 'Texas', 'California', 'Montana'],
    ['What is the capital of Thailand?', 'Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya'],
    ['Into which sea does the Danube flow?', 'Black Sea', 'Baltic Sea', 'Adriatic Sea', 'Caspian Sea'],
    ['What is the capital of Switzerland?', 'Bern', 'Zurich', 'Geneva', 'Basel'],
    ['In which country is the city of Marrakesh?', 'Morocco', 'Tunisia', 'Egypt', 'Algeria']
  ]);
  A('geography', 'hard', [
    ['What is the capital of Kazakhstan?', 'Astana', 'Almaty', 'Bishkek', 'Tashkent', 'Renamed Nur-Sultan in 2019 and back to Astana in 2022.'],
    ['Which country has a national flag that is not a quadrilateral?', 'Nepal', 'Switzerland', 'Bhutan', 'Vatican City'],
    ['Liechtenstein and which other country are the only two doubly landlocked countries?', 'Uzbekistan', 'Bolivia', 'Kazakhstan', 'Ethiopia', 'Doubly landlocked: every neighbour is itself landlocked.'],
    ['What is the capital of Myanmar?', 'Naypyidaw', 'Yangon', 'Mandalay', 'Bago'],
    ['Which is the deepest lake in the world?', 'Lake Baikal', 'Lake Tanganyika', 'Lake Superior', 'Caspian Sea', 'Baikal is about 1,640 m deep.'],
    ['Which strait separates Asia from North America?', 'Bering Strait', 'Davis Strait', 'Hudson Strait', 'Strait of Magellan'],
    ['What is the highest mountain in Africa?', 'Kilimanjaro', 'Mount Kenya', 'Mount Elgon', 'Mount Stanley'],
    ['What is the capital of Bhutan?', 'Thimphu', 'Paro', 'Kathmandu', 'Dhaka'],
    ['Which river flows through the Iraqi capital, Baghdad?', 'Tigris', 'Euphrates', 'Jordan', 'Nile'],
    ['The Atacama Desert lies mostly in which country?', 'Chile', 'Peru', 'Argentina', 'Bolivia'],
    ['Which country has the most natural lakes?', 'Canada', 'Russia', 'Finland', 'United States', 'Commonly cited ranking.'],
    ['What is the lowest point on dry land?', 'Shore of the Dead Sea', 'Death Valley', 'Lake Assal', 'Caspian shoreline'],
    ['What is the capital of Ethiopia?', 'Addis Ababa', 'Nairobi', 'Asmara', 'Khartoum'],
    ['Which is the longest river entirely within Europe?', 'Volga', 'Danube', 'Rhine', 'Dnieper'],
    ['What is the capital of Mongolia?', 'Ulaanbaatar', 'Erdenet', 'Darkhan', 'Khovd'],
    ['Which is the largest island in the Mediterranean Sea?', 'Sicily', 'Sardinia', 'Cyprus', 'Crete'],
    ['Which country has coastlines on both the Atlantic and the Indian oceans?', 'South Africa', 'Kenya', 'Namibia', 'Mozambique']
  ]);

  A('history', 'easy', [
    ['The pyramids of Giza were built in which ancient civilisation?', 'Egypt', 'Greece', 'Rome', 'Persia'],
    ['Who was the first President of the United States?', 'George Washington', 'Thomas Jefferson', 'Abraham Lincoln', 'John Adams'],
    ['In which year did the Berlin Wall fall?', '1989', '1961', '1991', '1979'],
    ['Which ship carried the Pilgrims to North America in 1620?', 'Mayflower', 'Santa Maria', 'Endeavour', 'Beagle'],
    ['Which ancient civilisation built the Colosseum?', 'Romans', 'Greeks', 'Egyptians', 'Phoenicians'],
    ['In which year did the Second World War end?', '1945', '1939', '1918', '1950'],
    ['In which year did the Titanic sink?', '1912', '1905', '1922', '1898'],
    ['Who was Britain\'s Prime Minister for most of the Second World War?', 'Winston Churchill', 'Neville Chamberlain', 'Clement Attlee', 'Anthony Eden'],
    ['Which civilisation built the mountain city of Machu Picchu?', 'Inca', 'Aztec', 'Maya', 'Olmec'],
    ['Which explorer reached the Americas in 1492 sailing for Spain?', 'Christopher Columbus', 'Vasco da Gama', 'Marco Polo', 'James Cook'],
    ['In which year did the French Revolution begin?', '1789', '1776', '1815', '1848'],
    ['Which country gave the Statue of Liberty to the United States?', 'France', 'United Kingdom', 'Spain', 'Italy'],
    ['What is the name of the ancient Egyptian picture writing?', 'Hieroglyphs', 'Cuneiform', 'Runes', 'Sanskrit'],
    ['Who was the first emperor of Rome?', 'Augustus', 'Julius Caesar', 'Nero', 'Caligula'],
    ['Which war was fought in the United States from 1861 to 1865?', 'American Civil War', 'War of Independence', 'War of 1812', 'Mexican-American War'],
    ['Which British monarch reigned from 1837 to 1901?', 'Queen Victoria', 'Queen Elizabeth I', 'Queen Anne', 'King George III'],
    ['Which ancient people built the Parthenon in Athens?', 'Greeks', 'Romans', 'Egyptians', 'Babylonians']
  ]);
  A('history', 'medium', [
    ['Which treaty of 1919 formally ended the First World War with Germany?', 'Treaty of Versailles', 'Treaty of Paris', 'Treaty of Utrecht', 'Treaty of Vienna'],
    ['Which Chinese dynasty built most of the surviving Great Wall?', 'Ming', 'Qin', 'Han', 'Tang'],
    ['In which year was the Battle of Hastings fought?', '1066', '1215', '1415', '1314'],
    ['Who founded the Mongol Empire in 1206?', 'Genghis Khan', 'Kublai Khan', 'Attila', 'Tamerlane'],
    ['Whose tomb did Howard Carter discover in 1922?', 'Tutankhamun', 'Ramesses II', 'Cleopatra', 'Khufu'],
    ['Which Spanish conquistador conquered the Aztec Empire?', 'Hernan Cortes', 'Francisco Pizarro', 'Ponce de Leon', 'Vasco Nunez de Balboa'],
    ['In which year was the US Declaration of Independence adopted?', '1776', '1789', '1812', '1754'],
    ['In which country did the Industrial Revolution begin?', 'Great Britain', 'France', 'Germany', 'United States'],
    ['Who led the Haitian Revolution?', 'Toussaint Louverture', 'Simon Bolivar', 'Jose de San Martin', 'Fidel Castro'],
    ['At which 1815 battle was Napoleon finally defeated?', 'Waterloo', 'Austerlitz', 'Trafalgar', 'Borodino'],
    ['In which year did the Soviet Union dissolve?', '1991', '1989', '1985', '1993'],
    ['Which Carthaginian general crossed the Alps with war elephants in 218 BCE?', 'Hannibal', 'Scipio', 'Pyrrhus', 'Xerxes'],
    ['What was the capital of the Byzantine Empire?', 'Constantinople', 'Athens', 'Alexandria', 'Antioch'],
    ['Who was the first woman to win a Nobel Prize?', 'Marie Curie', 'Mother Teresa', 'Dorothy Hodgkin', 'Irene Joliot-Curie', 'Physics, 1903.'],
    ['Which 1648 agreements ended the Thirty Years\' War?', 'Peace of Westphalia', 'Treaty of Tordesillas', 'Peace of Augsburg', 'Treaty of Ghent'],
    ['In which year did the Wright brothers make their first powered flight?', '1903', '1899', '1911', '1920'],
    ['Which US president issued the Emancipation Proclamation in 1863?', 'Abraham Lincoln', 'Ulysses S. Grant', 'Andrew Johnson', 'James Buchanan']
  ]);
  A('history', 'hard', [
    ['Who was Roman emperor when Vesuvius buried Pompeii in 79 CE?', 'Titus', 'Nero', 'Trajan', 'Domitian'],
    ['At which 1805 naval battle was Admiral Nelson killed?', 'Trafalgar', 'The Nile', 'Copenhagen', 'Jutland'],
    ['Which 1494 treaty divided newly found lands between Spain and Portugal?', 'Treaty of Tordesillas', 'Treaty of Utrecht', 'Treaty of Westphalia', 'Treaty of Lisbon'],
    ['Who founded the Mughal Empire in 1526?', 'Babur', 'Akbar', 'Humayun', 'Aurangzeb'],
    ['In which year did Japan\'s Meiji Restoration begin?', '1868', '1853', '1894', '1912'],
    ['Which Roman emperor, with Licinius, issued the Edict of Milan in 313?', 'Constantine I', 'Diocletian', 'Nero', 'Justinian'],
    ['What was the capital of the Inca Empire?', 'Cusco', 'Lima', 'Quito', 'La Paz'],
    ['In which year did the Black Death reach Europe via Sicily?', '1347', '1248', '1453', '1517', 'Commonly dated to the autumn of 1347 (Messina).'],
    ['Who became the first Chancellor of the German Empire in 1871?', 'Otto von Bismarck', 'Kaiser Wilhelm II', 'Helmuth von Moltke', 'Paul von Hindenburg'],
    ['Which battle did King Harold win against the Norwegians just before Hastings in 1066?', 'Stamford Bridge', 'Agincourt', 'Bosworth Field', 'Crecy'],
    ['Who, according to tradition, nailed the 95 Theses to a church door in 1517?', 'Martin Luther', 'John Calvin', 'Ulrich Zwingli', 'Erasmus'],
    ['Which dynasty ruled Egypt after Alexander the Great, ending with Cleopatra VII?', 'Ptolemaic dynasty', 'Seleucid dynasty', 'Antigonid dynasty', 'Achaemenid dynasty'],
    ['The Congress of Vienna (1814-1815) reorganised Europe after the defeat of whom?', 'Napoleon', 'Louis XIV', 'Frederick the Great', 'Kaiser Wilhelm'],
    ['Which admiral led China\'s great treasure voyages in the early 1400s?', 'Zheng He', 'Yi Sun-sin', 'Koxinga', 'Qi Jiguang'],
    ['In which year was Magna Carta sealed?', '1215', '1066', '1295', '1381'],
    ['Which Ottoman sultan was known as "the Magnificent"?', 'Suleiman I', 'Mehmed II', 'Selim I', 'Murad IV'],
    ['The Treaty of Guadalupe Hidalgo (1848) ended which war?', 'Mexican-American War', 'American Civil War', 'Spanish-American War', 'War of 1812']
  ]);

  A('science', 'easy', [
    ['What is the chemical formula for water?', 'H2O', 'CO2', 'O2', 'NaCl'],
    ['Which gas do plants absorb from the air for photosynthesis?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'],
    ['At what temperature in degrees Celsius does water boil at sea level?', '100', '90', '212', '0'],
    ['What force pulls objects towards the Earth?', 'Gravity', 'Magnetism', 'Friction', 'Inertia'],
    ['What is the hardest natural substance?', 'Diamond', 'Quartz', 'Steel', 'Granite'],
    ['What state of matter is water when ice melts?', 'Liquid', 'Gas', 'Solid', 'Plasma'],
    ['Which organ pumps blood around the human body?', 'Heart', 'Lungs', 'Liver', 'Kidney'],
    ['What is the chemical symbol for gold?', 'Au', 'Ag', 'Gd', 'Go'],
    ['Which gas do humans need to breathe to live?', 'Oxygen', 'Hydrogen', 'Carbon dioxide', 'Argon'],
    ['Which travels faster, light or sound?', 'Light', 'Sound', 'They travel at the same speed', 'It depends on the colour'],
    ['At what temperature in degrees Celsius does pure water freeze?', '0', '32', '-10', '10'],
    ['What is the centre of an atom called?', 'Nucleus', 'Electron', 'Cell wall', 'Orbit'],
    ['How many bones does an adult human body usually have?', '206', '106', '306', '256'],
    ['What is the chemical symbol for the element hydrogen?', 'H', 'Hy', 'Hg', 'Ho'],
    ['What do we call a material that lets electricity flow through it easily?', 'Conductor', 'Insulator', 'Resistor', 'Semiconductor'],
    ['Which vitamin does the skin make when exposed to sunlight?', 'Vitamin D', 'Vitamin C', 'Vitamin A', 'Vitamin B12'],
    ['What is the closest star to the Earth?', 'The Sun', 'Proxima Centauri', 'Sirius', 'Polaris']
  ]);
  A('science', 'medium', [
    ['What is the chemical symbol for sodium?', 'Na', 'So', 'Sd', 'S'],
    ['About how fast does light travel in a vacuum?', '300,000 km per second', '30,000 km per second', '3,000,000 km per second', '300 km per second', 'Exactly 299,792,458 m/s by definition of the metre.'],
    ['Which part of a cell is known as its powerhouse?', 'Mitochondrion', 'Ribosome', 'Nucleus', 'Golgi apparatus'],
    ['What is the atomic number of carbon?', '6', '12', '8', '4'],
    ['Who proposed the theory of general relativity?', 'Albert Einstein', 'Isaac Newton', 'Niels Bohr', 'Max Planck'],
    ['What is the pH of pure water at 25 degrees Celsius?', '7', '1', '10', '14'],
    ['Which gas makes up most of Earth\'s atmosphere?', 'Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon', 'About 78 percent by volume.'],
    ['What is the SI unit of force?', 'Newton', 'Joule', 'Watt', 'Pascal'],
    ['Which element is the most abundant in the universe?', 'Hydrogen', 'Helium', 'Oxygen', 'Carbon'],
    ['What does DNA stand for?', 'Deoxyribonucleic acid', 'Dinitrogen acid', 'Deoxyribose nucleic anhydride', 'Dynamic nuclear acid'],
    ['Which blood cells carry oxygen around the body?', 'Red blood cells', 'White blood cells', 'Platelets', 'Plasma cells'],
    ['Which subatomic particle carries a negative electric charge?', 'Electron', 'Proton', 'Neutron', 'Positron'],
    ['What is the chemical symbol for iron?', 'Fe', 'Ir', 'In', 'I'],
    ['What type of bond forms when atoms share pairs of electrons?', 'Covalent bond', 'Ionic bond', 'Hydrogen bond', 'Metallic bond'],
    ['Which scientist discovered penicillin in 1928?', 'Alexander Fleming', 'Louis Pasteur', 'Joseph Lister', 'Robert Koch'],
    ['What is the SI unit of electrical resistance?', 'Ohm', 'Volt', 'Ampere', 'Farad'],
    ['Which scientist formulated the three laws of motion?', 'Isaac Newton', 'Galileo Galilei', 'Johannes Kepler', 'Robert Hooke']
  ]);
  A('science', 'hard', [
    ['Approximately what is Avogadro\'s number?', '6.022 x 10^23', '3.14 x 10^8', '9.81 x 10^2', '1.602 x 10^-19'],
    ['Which particle mediates the electromagnetic force?', 'Photon', 'Gluon', 'W boson', 'Graviton'],
    ['Which element has the highest electronegativity on the Pauling scale?', 'Fluorine', 'Oxygen', 'Chlorine', 'Nitrogen'],
    ['Heisenberg\'s uncertainty principle links the uncertainty of position with that of which quantity?', 'Momentum', 'Charge', 'Mass', 'Spin'],
    ['Who discovered the electron in 1897?', 'J. J. Thomson', 'Ernest Rutherford', 'James Chadwick', 'Robert Millikan'],
    ['Which gas is the third most abundant in dry air by volume?', 'Argon', 'Carbon dioxide', 'Neon', 'Helium', 'About 0.93 percent.'],
    ['Which enzyme unwinds the DNA double helix at the replication fork?', 'Helicase', 'Ligase', 'Polymerase', 'Primase'],
    ['What is the chemical symbol for tungsten?', 'W', 'Tu', 'T', 'Tn'],
    ['Who published the first widely accepted periodic table in 1869?', 'Dmitri Mendeleev', 'Henry Moseley', 'John Dalton', 'Antoine Lavoisier'],
    ['In which part of the cell does the Krebs cycle take place?', 'Mitochondrial matrix', 'Cytoplasm', 'Nucleus', 'Ribosome'],
    ['What is the SI unit of magnetic flux density?', 'Tesla', 'Weber', 'Henry', 'Gauss'],
    ['Which element has the lowest boiling point?', 'Helium', 'Hydrogen', 'Neon', 'Nitrogen'],
    ['What did Rutherford\'s gold foil experiment reveal?', 'A small dense nucleus', 'The electron', 'The neutron', 'Isotopes'],
    ['What is the splitting of a heavy atomic nucleus called?', 'Fission', 'Fusion', 'Decay', 'Ionisation'],
    ['Which blood type is the universal red cell donor?', 'O negative', 'AB positive', 'A positive', 'B negative'],
    ['Who discovered X-rays in 1895?', 'Wilhelm Roentgen', 'Marie Curie', 'Henri Becquerel', 'Nikola Tesla'],
    ['Which metal has the highest electrical conductivity at room temperature?', 'Silver', 'Copper', 'Gold', 'Aluminium']
  ]);

  A('nature', 'easy', [
    ['What is the largest land animal?', 'African elephant', 'Rhinoceros', 'Hippopotamus', 'Giraffe'],
    ['Which is the tallest animal in the world?', 'Giraffe', 'Elephant', 'Ostrich', 'Camel'],
    ['How many legs does a spider have?', '8', '6', '10', '4'],
    ['Which flightless bird lives in Antarctica?', 'Penguin', 'Ostrich', 'Kiwi', 'Emu'],
    ['What do bees make?', 'Honey', 'Silk', 'Wax paper', 'Nectar'],
    ['Which is the fastest land animal?', 'Cheetah', 'Lion', 'Horse', 'Greyhound'],
    ['What is a baby kangaroo called?', 'Joey', 'Cub', 'Pup', 'Kit'],
    ['Which of these mammals lays eggs?', 'Platypus', 'Dolphin', 'Bat', 'Otter'],
    ['Which part of a plant takes in water from the soil?', 'Roots', 'Leaves', 'Flowers', 'Stem'],
    ['What is the largest mammal in the world?', 'Blue whale', 'Elephant', 'Great white shark', 'Sperm whale'],
    ['A tadpole grows into which animal?', 'Frog', 'Snake', 'Fish', 'Lizard'],
    ['Which sea creature has eight arms?', 'Octopus', 'Starfish', 'Jellyfish', 'Crab'],
    ['Which tree produces acorns?', 'Oak', 'Pine', 'Maple', 'Birch'],
    ['Which flying mammal sleeps hanging upside down?', 'Bat', 'Owl', 'Swift', 'Flying squirrel'],
    ['What do giant pandas mainly eat?', 'Bamboo', 'Fish', 'Berries', 'Grass'],
    ['Which is the largest living bird?', 'Ostrich', 'Emu', 'Albatross', 'Condor'],
    ['Which insect produces the silk used to make clothes?', 'Silkworm', 'Spider', 'Bee', 'Ant']
  ]);
  A('nature', 'medium', [
    ['How many hearts does an octopus have?', '3', '1', '2', '8'],
    ['Which is the only mammal capable of true, sustained flight?', 'Bat', 'Flying squirrel', 'Sugar glider', 'Flying lemur'],
    ['Which green pigment captures light in photosynthesis?', 'Chlorophyll', 'Haemoglobin', 'Melanin', 'Keratin'],
    ['Which is the largest species of shark?', 'Whale shark', 'Great white shark', 'Tiger shark', 'Hammerhead shark'],
    ['To which animal group do dolphins belong?', 'Mammals', 'Fish', 'Reptiles', 'Amphibians'],
    ['What is a group of lions called?', 'A pride', 'A pack', 'A herd', 'A swarm'],
    ['Which tree species grows the tallest?', 'Coast redwood', 'Giant sequoia', 'Baobab', 'Sitka spruce'],
    ['What do koalas mainly eat?', 'Eucalyptus leaves', 'Bamboo', 'Fruit', 'Insects'],
    ['Which is the largest living species of big cat?', 'Tiger', 'Lion', 'Jaguar', 'Leopard'],
    ['Which gas do plants release during photosynthesis?', 'Oxygen', 'Carbon dioxide', 'Nitrogen', 'Methane'],
    ['Which whale is nicknamed the "unicorn of the sea" for its long tusk?', 'Narwhal', 'Beluga', 'Humpback', 'Orca'],
    ['What do we call the scientific study of birds?', 'Ornithology', 'Entomology', 'Herpetology', 'Ichthyology'],
    ['What do we call the scientific study of insects?', 'Entomology', 'Ornithology', 'Mycology', 'Botany'],
    ['Which is the largest rainforest in the world?', 'Amazon rainforest', 'Congo rainforest', 'Daintree rainforest', 'Borneo rainforest'],
    ['What kind of animal is a Komodo dragon?', 'Lizard', 'Snake', 'Crocodile', 'Turtle'],
    ['Which of these animals is a marsupial?', 'Wombat', 'Hedgehog', 'Armadillo', 'Sloth'],
    ['What is a group of crows traditionally called?', 'A murder', 'A parliament', 'A pride', 'A school']
  ]);
  A('nature', 'hard', [
    ['Which continent has no native ants?', 'Antarctica', 'Australia', 'Europe', 'South America'],
    ['Which plant family includes the sunflower?', 'Asteraceae', 'Rosaceae', 'Poaceae', 'Fabaceae'],
    ['Which bird is capable of sustained backwards flight?', 'Hummingbird', 'Swift', 'Kingfisher', 'Swallow'],
    ['Which bird is the fastest animal in a dive, or stoop?', 'Peregrine falcon', 'Golden eagle', 'Osprey', 'Albatross'],
    ['Which order of mammals has the Latin name Chiroptera?', 'Bats', 'Rodents', 'Primates', 'Whales'],
    ['Which tree is the source of bottle cork?', 'Cork oak', 'Beech', 'Olive', 'Rubber tree'],
    ['What is the largest living species of lizard?', 'Komodo dragon', 'Nile monitor', 'Green iguana', 'Gila monster'],
    ['What term describes animals most active at dawn and dusk?', 'Crepuscular', 'Nocturnal', 'Diurnal', 'Cathemeral'],
    ['What kind of organism is yeast?', 'Fungus', 'Bacterium', 'Plant', 'Virus'],
    ['Which is the largest species of penguin?', 'Emperor penguin', 'King penguin', 'Adelie penguin', 'Gentoo penguin'],
    ['Which land mammal has the longest pregnancy?', 'Elephant', 'Giraffe', 'Rhinoceros', 'Hippopotamus'],
    ['What small animals build coral reefs?', 'Coral polyps', 'Sponges', 'Sea anemones', 'Jellyfish'],
    ['Which of these is a monotreme, or egg-laying mammal?', 'Echidna', 'Opossum', 'Wombat', 'Quokka'],
    ['What is the main protein in bird feathers?', 'Keratin', 'Collagen', 'Chitin', 'Elastin'],
    ['Which plant produces the largest individual flower?', 'Rafflesia arnoldii', 'Sunflower', 'Lotus', 'Peony'],
    ['Which legless amphibians look like worms or snakes?', 'Caecilians', 'Newts', 'Axolotls', 'Salamanders'],
    ['What is the scientific name for modern humans?', 'Homo sapiens', 'Homo erectus', 'Homo habilis', 'Australopithecus']
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
