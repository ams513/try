/* Stark Event Kit question bank, part 2: space, technology, mathematics, literature.
   Row format: [question, correct answer, wrong 1, wrong 2, wrong 3, optional source note]. */
(function (g) {
  'use strict';
  var S = g.SEK = g.SEK || {}; S.RAW = S.RAW || [];
  function A(c, d, rows) { S.RAW.push({ cat: c, diff: d, rows: rows }); }

  A('space', 'easy', [
    ['Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Mars', 'Earth'],
    ['Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Mercury'],
    ['Which is the largest planet in our Solar System?', 'Jupiter', 'Saturn', 'Neptune', 'Earth'],
    ['What is the name of Earth\'s natural satellite?', 'The Moon', 'Phobos', 'Titan', 'Europa'],
    ['Which galaxy contains our Solar System?', 'Milky Way', 'Andromeda', 'Triangulum', 'Whirlpool'],
    ['Which planet is famous for its bright rings?', 'Saturn', 'Mars', 'Mercury', 'Earth'],
    ['Who was the first human in space?', 'Yuri Gagarin', 'Neil Armstrong', 'John Glenn', 'Buzz Aldrin', 'Vostok 1, 12 April 1961.'],
    ['How many planets are in our Solar System?', '8', '9', '7', '10', 'Pluto was reclassified as a dwarf planet by the IAU in 2006.'],
    ['What is at the centre of our Solar System?', 'The Sun', 'Jupiter', 'The Moon', 'A black hole'],
    ['Who was the first person to walk on the Moon?', 'Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'],
    ['Which planet is the third from the Sun?', 'Earth', 'Venus', 'Mars', 'Mercury'],
    ['What do we call a ball of ice and dust that grows a tail near the Sun?', 'Comet', 'Meteor', 'Asteroid', 'Satellite'],
    ['The famous space telescope launched in 1990 was named after which astronomer?', 'Edwin Hubble', 'Carl Sagan', 'Galileo Galilei', 'Stephen Hawking'],
    ['Which planet rotates on its side, tilted at about 98 degrees?', 'Uranus', 'Mars', 'Jupiter', 'Mercury'],
    ['How long does the Earth take to orbit the Sun?', 'About one year', 'About one month', 'About one day', 'About ten years'],
    ['About how long is one rotation of the Earth?', 'About 24 hours', 'About 12 hours', 'About 365 days', 'About 30 days'],
    ['Which planet is the hottest in the Solar System?', 'Venus', 'Mercury', 'Mars', 'Jupiter']
  ]);
  A('space', 'medium', [
    ['Which Apollo mission made the first crewed Moon landing?', 'Apollo 11', 'Apollo 8', 'Apollo 13', 'Apollo 17'],
    ['What is the largest moon of Saturn?', 'Titan', 'Europa', 'Enceladus', 'Rhea'],
    ['Which spacecraft first entered interstellar space, in 2012?', 'Voyager 1', 'Pioneer 10', 'Voyager 2', 'New Horizons'],
    ['What does a light-year measure?', 'Distance', 'Time', 'Speed', 'Brightness'],
    ['What was the first artificial satellite, launched in 1957?', 'Sputnik 1', 'Explorer 1', 'Vostok 1', 'Telstar'],
    ['Which planet has the Great Red Spot storm?', 'Jupiter', 'Saturn', 'Neptune', 'Mars'],
    ['Which planet has the shortest year, at about 88 Earth days?', 'Mercury', 'Venus', 'Mars', 'Earth'],
    ['Which star is the closest to the Sun?', 'Proxima Centauri', 'Sirius', 'Betelgeuse', 'Vega'],
    ['Who was the first American in space, in 1961?', 'Alan Shepard', 'John Glenn', 'Neil Armstrong', 'Gus Grissom'],
    ['Which planet was found in 1846 after mathematical prediction of its position?', 'Neptune', 'Uranus', 'Pluto', 'Saturn'],
    ['What is the name of the NASA rover that landed on Mars in February 2021?', 'Perseverance', 'Curiosity', 'Opportunity', 'Spirit'],
    ['Which is the largest moon in the Solar System?', 'Ganymede', 'Titan', 'Callisto', 'The Moon'],
    ['Which large spiral galaxy is the nearest to the Milky Way?', 'Andromeda', 'Triangulum', 'Sombrero', 'Pinwheel'],
    ['Which body was reclassified as a dwarf planet in 2006?', 'Pluto', 'Ceres', 'Eris', 'Haumea'],
    ['Which space telescope launched on Christmas Day 2021?', 'James Webb Space Telescope', 'Hubble Space Telescope', 'Kepler', 'Spitzer'],
    ['About how long does sunlight take to reach the Earth?', 'About 8 minutes', 'About 8 seconds', 'About 8 hours', 'About 80 minutes'],
    ['Which Space Shuttle broke apart shortly after launch in 1986?', 'Challenger', 'Columbia', 'Discovery', 'Atlantis']
  ]);
  A('space', 'hard', [
    ['Who was the first woman in space, in 1963?', 'Valentina Tereshkova', 'Sally Ride', 'Svetlana Savitskaya', 'Mae Jemison'],
    ['Which 1968 mission carried humans around the Moon for the first time?', 'Apollo 8', 'Apollo 10', 'Apollo 11', 'Gemini 7'],
    ['What is the boundary around a black hole beyond which nothing can escape called?', 'Event horizon', 'Singularity', 'Accretion disc', 'Photon sphere'],
    ['About how old is the universe?', '13.8 billion years', '4.6 billion years', '100 billion years', '1.4 billion years', 'Planck 2018 results give 13.8 billion years.'],
    ['What does the Chandrasekhar limit describe?', 'The maximum mass of a stable white dwarf', 'The speed limit of a neutron star\'s spin', 'The minimum mass of a black hole', 'The size of the observable universe'],
    ['Which probe landed on Saturn\'s moon Titan in 2005?', 'Huygens', 'Cassini', 'Galileo', 'Philae'],
    ['Which planet has a day longer than its year?', 'Venus', 'Mercury', 'Mars', 'Uranus', 'Venus rotates once in about 243 Earth days and orbits in about 225.'],
    ['What was the first space station, launched by the Soviet Union in 1971?', 'Salyut 1', 'Mir', 'Skylab', 'Tiangong-1'],
    ['Who commanded the Apollo 13 mission?', 'Jim Lovell', 'Neil Armstrong', 'Pete Conrad', 'Alan Shepard'],
    ['About how often does Halley\'s Comet return to the inner Solar System?', 'About every 76 years', 'About every 12 years', 'About every 200 years', 'About every 3 years'],
    ['On which planet is Olympus Mons, the tallest known volcano in the Solar System?', 'Mars', 'Venus', 'Earth', 'Mercury'],
    ['Which dwarf planet did the New Horizons probe fly past in 2015?', 'Pluto', 'Ceres', 'Eris', 'Makemake'],
    ['What is the largest moon of Neptune?', 'Triton', 'Nereid', 'Proteus', 'Charon'],
    ['The Kuiper Belt lies beyond the orbit of which planet?', 'Neptune', 'Jupiter', 'Saturn', 'Mars'],
    ['Who discovered Jupiter\'s four largest moons in 1610?', 'Galileo Galilei', 'Johannes Kepler', 'Isaac Newton', 'Christiaan Huygens'],
    ['What type of star is the Sun?', 'G-type main-sequence star', 'Red giant', 'White dwarf', 'Neutron star'],
    ['Which was the first spacecraft to orbit another planet?', 'Mariner 9', 'Viking 1', 'Mars Global Surveyor', 'Venera 7', 'Mariner 9 entered Mars orbit on 14 November 1971.']
  ]);

  A('technology', 'easy', [
    ['What does CPU stand for?', 'Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Processing Update'],
    ['What does USB stand for?', 'Universal Serial Bus', 'Unified System Board', 'Ultra Speed Byte', 'Universal Software Base'],
    ['What does HTML stand for?', 'HyperText Markup Language', 'High Transfer Machine Language', 'HyperTool Multi Language', 'Home Text Markup Link'],
    ['Which company makes the iPhone?', 'Apple', 'Samsung', 'Google', 'Nokia'],
    ['Which company makes the Windows operating system?', 'Microsoft', 'Apple', 'IBM', 'Oracle'],
    ['What does PC stand for in computing?', 'Personal Computer', 'Portable Circuit', 'Primary Console', 'Program Controller'],
    ['What does "www" stand for in a web address?', 'World Wide Web', 'Wide World Window', 'Web Work Wire', 'World Web Wire'],
    ['What does RAM stand for?', 'Random Access Memory', 'Read Always Memory', 'Rapid Action Module', 'Real Active Memory'],
    ['Which company developed the Chrome web browser?', 'Google', 'Mozilla', 'Microsoft', 'Apple'],
    ['What do we call software that finds and removes malware?', 'Antivirus', 'Spreadsheet', 'Compiler', 'Browser'],
    ['What does PDF stand for?', 'Portable Document Format', 'Printed Data File', 'Personal Document Form', 'Public Digital Format'],
    ['Which language is mainly used to style web pages?', 'CSS', 'SQL', 'Python', 'C'],
    ['How many bits are in one byte?', '8', '4', '16', '10'],
    ['What does GPS stand for?', 'Global Positioning System', 'General Position Signal', 'Global Planning Service', 'Ground Point System'],
    ['What do the letters AI stand for?', 'Artificial Intelligence', 'Automatic Input', 'Advanced Interface', 'Analog Instruction'],
    ['The @ symbol is an essential part of what?', 'An email address', 'A phone number', 'A web colour', 'A file size'],
    ['What do you call the secret word you use to protect an online account?', 'Password', 'Username', 'Cookie', 'Domain']
  ]);
  A('technology', 'medium', [
    ['Who co-founded Microsoft with Bill Gates?', 'Paul Allen', 'Steve Jobs', 'Steve Ballmer', 'Larry Ellison'],
    ['In which year was the first iPhone released?', '2007', '2004', '2010', '2001'],
    ['What does HTTP stand for?', 'HyperText Transfer Protocol', 'High Transfer Text Process', 'Hyperlink Text Transmission Path', 'Host Transfer Terminal Protocol'],
    ['Who created the Linux kernel?', 'Linus Torvalds', 'Richard Stallman', 'Dennis Ritchie', 'Bill Joy'],
    ['Which company created the Java programming language?', 'Sun Microsystems', 'Microsoft', 'Netscape', 'IBM', 'Created at Sun by James Gosling; released 1995.'],
    ['What is the binary number 1010 in decimal?', '10', '8', '12', '5'],
    ['Who invented the World Wide Web?', 'Tim Berners-Lee', 'Vint Cerf', 'Bill Gates', 'Steve Wozniak'],
    ['What does SSD stand for?', 'Solid State Drive', 'Super Speed Disk', 'System Storage Device', 'Serial Storage Drive'],
    ['Which programming language is named after a British comedy group?', 'Python', 'Ruby', 'Java', 'Swift', 'Named after Monty Python\'s Flying Circus.'],
    ['Which company was founded in 1976 by Steve Jobs, Steve Wozniak and Ronald Wayne?', 'Apple', 'Microsoft', 'Atari', 'Intel'],
    ['What does URL stand for?', 'Uniform Resource Locator', 'Universal Reference Link', 'Unified Resource Loader', 'User Routing Language'],
    ['What is the largest value that fits in an unsigned 8-bit number?', '255', '256', '127', '128'],
    ['Which protocol shows a padlock in the browser for a secure connection?', 'HTTPS', 'FTP', 'SMTP', 'SSH'],
    ['What does SQL stand for?', 'Structured Query Language', 'Simple Question Logic', 'System Query Layer', 'Sequential Quick Language'],
    ['In which year was Google founded?', '1998', '1995', '2001', '2004'],
    ['Who is often called the first computer programmer?', 'Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Charles Babbage'],
    ['What does GUI stand for?', 'Graphical User Interface', 'General Utility Index', 'Global User Input', 'Graphic Unit Instruction']
  ]);
  A('technology', 'hard', [
    ['Who created the C programming language?', 'Dennis Ritchie', 'Bjarne Stroustrup', 'James Gosling', 'Ken Thompson', 'Ritchie developed C at Bell Labs in the early 1970s.'],
    ['What does TCP stand for in networking?', 'Transmission Control Protocol', 'Transfer Connection Process', 'Terminal Control Package', 'Transport Cable Protocol'],
    ['What abstract machine did Alan Turing describe in 1936?', 'The Turing machine', 'The Difference Engine', 'The Analytical Engine', 'The Enigma machine'],
    ['In which year did Intel release the 4004, its first microprocessor?', '1971', '1965', '1978', '1983'],
    ['What does ASCII stand for?', 'American Standard Code for Information Interchange', 'Advanced System Code for Internet Interfaces', 'Automatic Standard Computer Input Interface', 'American Systems Coding Instruction Index'],
    ['What is the decimal number 255 in hexadecimal?', 'FF', 'EE', 'A0', '100'],
    ['Which language was designed by Guido van Rossum?', 'Python', 'Perl', 'Ruby', 'PHP'],
    ['Which 1993 browser first popularised the graphical web?', 'Mosaic', 'Netscape Navigator', 'Internet Explorer', 'Opera'],
    ['What does the Domain Name System (DNS) translate?', 'Domain names into IP addresses', 'Files into folders', 'Passwords into hashes', 'Videos into streams'],
    ['Which network, first connected in 1969, was the precursor of the internet?', 'ARPANET', 'Ethernet', 'Usenet', 'BITNET'],
    ['What does Moore\'s law observe?', 'Transistors on a chip roughly double about every two years', 'Computer prices halve every year', 'Network speeds triple every decade', 'Software bugs double with every release'],
    ['How many bits are in an IPv4 address?', '32', '64', '128', '16'],
    ['Who founded Amazon in 1994?', 'Jeff Bezos', 'Jack Ma', 'Larry Page', 'Elon Musk'],
    ['What does JPEG stand for?', 'Joint Photographic Experts Group', 'Java Picture Encoding Group', 'Joint Pixel Encoding Format', 'Just Picture Exchange Graphics'],
    ['Which public-key cryptosystem is named after Rivest, Shamir and Adleman?', 'RSA', 'AES', 'DES', 'SHA'],
    ['In which year did Tim Berners-Lee first propose the World Wide Web?', '1989', '1975', '1995', '1981', 'CERN memo, March 1989.'],
    ['Which computer scientist devised a famous shortest-path algorithm in 1956?', 'Edsger Dijkstra', 'Donald Knuth', 'John von Neumann', 'Tony Hoare']
  ]);

  A('mathematics', 'easy', [
    ['What is 7 multiplied by 8?', '56', '54', '49', '63'],
    ['What is the square root of 81?', '9', '8', '7', '11'],
    ['How many sides does a hexagon have?', '6', '5', '7', '8'],
    ['What do the angles inside any triangle add up to?', '180 degrees', '90 degrees', '360 degrees', '270 degrees'],
    ['What is 15 percent of 200?', '30', '15', '25', '35'],
    ['What is 12 multiplied by 12?', '144', '124', '132', '154'],
    ['Which Roman numeral stands for 50?', 'L', 'V', 'X', 'C'],
    ['What is the next prime number after 7?', '11', '9', '10', '13'],
    ['How many degrees are in a right angle?', '90', '45', '180', '60'],
    ['What is 100 divided by 4?', '25', '20', '40', '50'],
    ['What is the perimeter of a square with sides of 5 cm?', '20 cm', '25 cm', '10 cm', '15 cm'],
    ['What is the value of pi rounded to two decimal places?', '3.14', '3.41', '3.12', '3.16'],
    ['What is half of 250?', '125', '150', '115', '100'],
    ['How many sides does an octagon have?', '8', '6', '10', '9'],
    ['What is 2 to the power of 5?', '32', '10', '25', '64'],
    ['What do we call a triangle with all three sides equal?', 'Equilateral', 'Isosceles', 'Scalene', 'Right-angled'],
    ['What is 1000 minus 387?', '613', '623', '713', '617']
  ]);
  A('mathematics', 'medium', [
    ['What is the area of a circle with radius 3, in terms of pi?', '9 pi', '6 pi', '3 pi', '12 pi'],
    ['Solve for x: 2x + 6 = 20.', '7', '10', '13', '8'],
    ['What is the sum of the whole numbers from 1 to 10?', '55', '50', '45', '60'],
    ['What is 3/4 written as a percentage?', '75%', '34%', '60%', '80%'],
    ['What is the square root of 144?', '12', '14', '11', '16'],
    ['Which of these numbers is prime?', '29', '27', '33', '39'],
    ['What is 5 factorial (5!)?', '120', '25', '60', '720'],
    ['A right triangle has legs of 6 and 8. How long is the hypotenuse?', '10', '12', '14', '9'],
    ['What do the interior angles of a pentagon add up to?', '540 degrees', '360 degrees', '720 degrees', '450 degrees'],
    ['What is 2 to the power of 10?', '1024', '1000', '512', '2048'],
    ['Which number does the Roman numeral MCMXC represent?', '1990', '1890', '1900', '2090'],
    ['What is the least common multiple of 4 and 6?', '12', '24', '10', '2'],
    ['What is the median of 3, 7, 9, 15 and 21?', '9', '7', '11', '15'],
    ['Which number is neither prime nor composite?', '1', '0', '2', '9'],
    ['What do the interior angles of a quadrilateral add up to?', '360 degrees', '180 degrees', '540 degrees', '270 degrees'],
    ['What is the volume of a cube with edges of 4 cm?', '64 cubic cm', '16 cubic cm', '48 cubic cm', '12 cubic cm'],
    ['What is 0.125 as a fraction?', '1/8', '1/4', '1/5', '1/12']
  ]);
  A('mathematics', 'hard', [
    ['What is Euler\'s number e, rounded to three decimal places?', '2.718', '3.142', '1.618', '2.236'],
    ['What is the value of i squared, where i is the imaginary unit?', '-1', '1', 'i', '0'],
    ['How many edges does a cube have?', '12', '8', '6', '24'],
    ['What is the smallest perfect number?', '6', '4', '12', '28'],
    ['What do the interior angles of a hexagon add up to?', '720 degrees', '540 degrees', '900 degrees', '1080 degrees'],
    ['How many diagonals does a hexagon have?', '9', '6', '12', '15'],
    ['Who proved Fermat\'s Last Theorem in the 1990s?', 'Andrew Wiles', 'Grigori Perelman', 'Terence Tao', 'Paul Erdos', 'Announced 1993, completed 1994, published 1995.'],
    ['What is the tenth Fibonacci number, with F(1) = F(2) = 1?', '55', '34', '89', '44'],
    ['What is the base-10 logarithm of 1000?', '3', '10', '100', '2'],
    ['What is the derivative of sin(x) with respect to x?', 'cos(x)', '-cos(x)', 'sin(x)', '-sin(x)'],
    ['What is the golden ratio, rounded to three decimal places?', '1.618', '1.414', '1.732', '2.718'],
    ['What is the sum of the infinite series 1/2 + 1/4 + 1/8 + ...?', '1', '2', '3/2', 'It has no finite sum'],
    ['What is 17 multiplied by 23?', '391', '381', '401', '371'],
    ['Which two whole numbers are the legs of a right triangle with hypotenuse 13?', '5 and 12', '6 and 11', '7 and 10', '4 and 9'],
    ['How many faces does a regular dodecahedron have?', '12', '20', '8', '10'],
    ['In how many different orders can the letters C, A and T be arranged?', '6', '3', '9', '12'],
    ['How many prime numbers are less than 20?', '8', '7', '9', '10']
  ]);

  A('literature', 'easy', [
    ['Who wrote the play Romeo and Juliet?', 'William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Christopher Marlowe'],
    ['Who wrote the Harry Potter books?', 'J. K. Rowling', 'Roald Dahl', 'Suzanne Collins', 'C. S. Lewis'],
    ['Who wrote The Hobbit?', 'J. R. R. Tolkien', 'C. S. Lewis', 'Philip Pullman', 'T. H. White'],
    ['Who wrote Alice\'s Adventures in Wonderland?', 'Lewis Carroll', 'J. M. Barrie', 'Kenneth Grahame', 'A. A. Milne'],
    ['Which fictional detective lives at 221B Baker Street?', 'Sherlock Holmes', 'Hercule Poirot', 'Miss Marple', 'Inspector Morse'],
    ['Who wrote A Christmas Carol?', 'Charles Dickens', 'Thomas Hardy', 'Oscar Wilde', 'George Eliot'],
    ['Who wrote The Cat in the Hat?', 'Dr. Seuss', 'Roald Dahl', 'Maurice Sendak', 'Eric Carle'],
    ['Who wrote Pride and Prejudice?', 'Jane Austen', 'Charlotte Bronte', 'Emily Bronte', 'Mary Shelley'],
    ['Which character is the boy who never grows up?', 'Peter Pan', 'Tom Sawyer', 'Oliver Twist', 'Pinocchio'],
    ['Who wrote Charlie and the Chocolate Factory?', 'Roald Dahl', 'Enid Blyton', 'Dr. Seuss', 'Michael Morpurgo'],
    ['Who wrote Little Women?', 'Louisa May Alcott', 'Jane Austen', 'L. M. Montgomery', 'Harriet Beecher Stowe'],
    ['In The Lion, the Witch and the Wardrobe, which land do the children enter?', 'Narnia', 'Middle-earth', 'Neverland', 'Oz'],
    ['Who wrote Animal Farm?', 'George Orwell', 'Aldous Huxley', 'H. G. Wells', 'Evelyn Waugh'],
    ['What is the name of Winnie-the-Pooh\'s gloomy donkey friend?', 'Eeyore', 'Piglet', 'Tigger', 'Rabbit'],
    ['Who wrote The Adventures of Tom Sawyer?', 'Mark Twain', 'Jack London', 'Herman Melville', 'Nathaniel Hawthorne'],
    ['Who wrote Moby-Dick?', 'Herman Melville', 'Mark Twain', 'Ernest Hemingway', 'Edgar Allan Poe'],
    ['Who wrote Don Quixote?', 'Miguel de Cervantes', 'Lope de Vega', 'Gabriel Garcia Marquez', 'Federico Garcia Lorca']
  ]);
  A('literature', 'medium', [
    ['Who wrote the novel Nineteen Eighty-Four?', 'George Orwell', 'Aldous Huxley', 'Ray Bradbury', 'Arthur C. Clarke'],
    ['Who wrote The Great Gatsby?', 'F. Scott Fitzgerald', 'Ernest Hemingway', 'John Steinbeck', 'William Faulkner'],
    ['Which Russian author wrote War and Peace?', 'Leo Tolstoy', 'Fyodor Dostoevsky', 'Anton Chekhov', 'Ivan Turgenev'],
    ['Who wrote One Hundred Years of Solitude?', 'Gabriel Garcia Marquez', 'Jorge Luis Borges', 'Pablo Neruda', 'Isabel Allende'],
    ['The Odyssey is traditionally attributed to which ancient Greek poet?', 'Homer', 'Hesiod', 'Sophocles', 'Virgil'],
    ['Who wrote Brave New World?', 'Aldous Huxley', 'George Orwell', 'H. G. Wells', 'Kurt Vonnegut'],
    ['Which novel opens with the words "Call me Ishmael"?', 'Moby-Dick', 'Treasure Island', 'Robinson Crusoe', 'The Old Man and the Sea'],
    ['Who wrote Frankenstein?', 'Mary Shelley', 'Bram Stoker', 'Robert Louis Stevenson', 'Jane Austen'],
    ['Which Dickens novel features a boy named Pip?', 'Great Expectations', 'Oliver Twist', 'David Copperfield', 'Hard Times'],
    ['Who wrote Crime and Punishment?', 'Fyodor Dostoevsky', 'Leo Tolstoy', 'Nikolai Gogol', 'Maxim Gorky'],
    ['Who wrote To Kill a Mockingbird?', 'Harper Lee', 'Truman Capote', 'Toni Morrison', 'Flannery O\'Connor'],
    ['Who wrote The Divine Comedy?', 'Dante Alighieri', 'Petrarch', 'Boccaccio', 'Virgil'],
    ['Who wrote Les Miserables?', 'Victor Hugo', 'Alexandre Dumas', 'Honore de Balzac', 'Emile Zola'],
    ['Who wrote The Catcher in the Rye?', 'J. D. Salinger', 'Jack Kerouac', 'John Updike', 'Kurt Vonnegut'],
    ['Who wrote Jane Eyre?', 'Charlotte Bronte', 'Emily Bronte', 'Jane Austen', 'George Eliot'],
    ['Who wrote The Old Man and the Sea?', 'Ernest Hemingway', 'John Steinbeck', 'F. Scott Fitzgerald', 'Jack London'],
    ['Who wrote the vampire novel Dracula?', 'Bram Stoker', 'Mary Shelley', 'Sheridan Le Fanu', 'Oscar Wilde']
  ]);
  A('literature', 'hard', [
    ['Who wrote Ulysses, published in 1922?', 'James Joyce', 'Virginia Woolf', 'Samuel Beckett', 'T. S. Eliot'],
    ['Who wrote In Search of Lost Time?', 'Marcel Proust', 'Gustave Flaubert', 'Andre Gide', 'Albert Camus'],
    ['Who wrote The Trial?', 'Franz Kafka', 'Thomas Mann', 'Hermann Hesse', 'Robert Musil'],
    ['Who wrote Things Fall Apart?', 'Chinua Achebe', 'Wole Soyinka', 'Ngugi wa Thiong\'o', 'Chimamanda Ngozi Adichie'],
    ['Who wrote The Brothers Karamazov?', 'Fyodor Dostoevsky', 'Leo Tolstoy', 'Ivan Goncharov', 'Mikhail Lermontov'],
    ['Who wrote Beloved?', 'Toni Morrison', 'Alice Walker', 'Maya Angelou', 'Zora Neale Hurston'],
    ['Who, under the pen name George Eliot, wrote Middlemarch?', 'Mary Ann Evans', 'Charlotte Bronte', 'Elizabeth Gaskell', 'Christina Rossetti'],
    ['Who wrote The Master and Margarita?', 'Mikhail Bulgakov', 'Boris Pasternak', 'Vladimir Nabokov', 'Anton Chekhov'],
    ['Who wrote The Stranger (L\'Etranger)?', 'Albert Camus', 'Jean-Paul Sartre', 'Simone de Beauvoir', 'Samuel Beckett'],
    ['Who wrote Madame Bovary?', 'Gustave Flaubert', 'Emile Zola', 'Stendhal', 'Guy de Maupassant'],
    ['Who wrote Wuthering Heights?', 'Emily Bronte', 'Charlotte Bronte', 'Anne Bronte', 'Elizabeth Gaskell'],
    ['Who wrote the epic poem Paradise Lost?', 'John Milton', 'John Donne', 'Edmund Spenser', 'William Blake'],
    ['Who wrote The Canterbury Tales?', 'Geoffrey Chaucer', 'William Langland', 'John Gower', 'Thomas Malory'],
    ['Who wrote Heart of Darkness?', 'Joseph Conrad', 'Rudyard Kipling', 'Thomas Hardy', 'Henry James'],
    ['Who wrote Lolita?', 'Vladimir Nabokov', 'Saul Bellow', 'Philip Roth', 'John Updike'],
    ['Who wrote The Tale of Genji, an early Japanese novel?', 'Murasaki Shikibu', 'Sei Shonagon', 'Matsuo Basho', 'Yasunari Kawabata', 'Written in the early 11th century.'],
    ['Who wrote the play Waiting for Godot?', 'Samuel Beckett', 'Harold Pinter', 'Eugene Ionesco', 'Tom Stoppard']
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
