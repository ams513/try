/* Stark Event Kit question bank, part 3: film and TV, music, sport, food and language.
   Row format: [question, correct answer, wrong 1, wrong 2, wrong 3, optional source note]. */
(function (g) {
  'use strict';
  var S = g.SEK = g.SEK || {}; S.RAW = S.RAW || [];
  function A(c, d, rows) { S.RAW.push({ cat: c, diff: d, rows: rows }); }

  A('film', 'easy', [
    ['Which animated film features a lion cub named Simba?', 'The Lion King', 'Madagascar', 'Bambi', 'The Jungle Book'],
    ['Which studio made Toy Story?', 'Pixar', 'DreamWorks', 'Studio Ghibli', 'Illumination'],
    ['What is the name of the snowman in Frozen?', 'Olaf', 'Sven', 'Kristoff', 'Hans'],
    ['In which film does a clownfish named Nemo get lost?', 'Finding Nemo', 'Shark Tale', 'Moana', 'The Little Mermaid'],
    ['Who directed the 1975 film Jaws?', 'Steven Spielberg', 'George Lucas', 'James Cameron', 'Ridley Scott'],
    ['What is the name of Dorothy\'s dog in The Wizard of Oz?', 'Toto', 'Lassie', 'Benji', 'Rex'],
    ['Which film series features the line "May the Force be with you"?', 'Star Wars', 'Star Trek', 'Dune', 'Stargate'],
    ['Which animated film features Woody, a toy cowboy?', 'Toy Story', 'Cars', 'Monsters, Inc.', 'Up'],
    ['What colour is Kermit the Frog?', 'Green', 'Blue', 'Yellow', 'Red'],
    ['Who directed the 1997 film Titanic?', 'James Cameron', 'Steven Spielberg', 'Christopher Nolan', 'Ridley Scott'],
    ['What is the name of the boy left behind in the film Home Alone?', 'Kevin McCallister', 'Harry Potter', 'Peter Parker', 'Charlie Bucket'],
    ['What is the name of the wizarding school in the Harry Potter films?', 'Hogwarts', 'Beauxbatons', 'Durmstrang', 'Ilvermorny'],
    ['Which TV cartoon family lives in the town of Springfield?', 'The Simpsons', 'The Flintstones', 'The Griffins', 'The Jetsons'],
    ['What is the name of the lion in The Lion, the Witch and the Wardrobe?', 'Aslan', 'Simba', 'Mufasa', 'Leo'],
    ['Which type of creatures are brought back to life in the film Jurassic Park?', 'Dinosaurs', 'Mammoths', 'Dragons', 'Sharks'],
    ['What is the secret identity of Batman?', 'Bruce Wayne', 'Clark Kent', 'Peter Parker', 'Tony Stark'],
    ['Which Disney film features the song "Let It Go"?', 'Frozen', 'Tangled', 'Moana', 'Encanto']
  ]);
  A('film', 'medium', [
    ['Which film won the Best Picture Oscar at the 1995 ceremony, for 1994 films?', 'Forrest Gump', 'Pulp Fiction', 'The Shawshank Redemption', 'Four Weddings and a Funeral'],
    ['Who directed Pulp Fiction?', 'Quentin Tarantino', 'Martin Scorsese', 'Steven Spielberg', 'David Fincher'],
    ['Who directed The Godfather (1972)?', 'Francis Ford Coppola', 'Martin Scorsese', 'Brian De Palma', 'Sidney Lumet'],
    ['Who directed the 1960 thriller Psycho?', 'Alfred Hitchcock', 'Orson Welles', 'Stanley Kubrick', 'Billy Wilder'],
    ['Which actor played Jack Dawson in Titanic?', 'Leonardo DiCaprio', 'Brad Pitt', 'Tom Cruise', 'Matt Damon'],
    ['Who directed Inception (2010)?', 'Christopher Nolan', 'Denis Villeneuve', 'Ridley Scott', 'Darren Aronofsky'],
    ['Which Japanese studio made Spirited Away?', 'Studio Ghibli', 'Toei Animation', 'Madhouse', 'Gainax'],
    ['What was Disney\'s first full-length animated feature film, released in 1937?', 'Snow White and the Seven Dwarfs', 'Pinocchio', 'Bambi', 'Cinderella'],
    ['Who directed The Lord of the Rings film trilogy?', 'Peter Jackson', 'Sam Raimi', 'George Lucas', 'Guillermo del Toro'],
    ['Which South Korean film won Best Picture at the 2020 Academy Awards?', 'Parasite', 'Oldboy', 'Train to Busan', 'Burning'],
    ['Who directed the original Star Wars (1977)?', 'George Lucas', 'Steven Spielberg', 'Irvin Kershner', 'J. J. Abrams'],
    ['Which actor played Captain Jack Sparrow in Pirates of the Caribbean?', 'Johnny Depp', 'Orlando Bloom', 'Geoffrey Rush', 'Brad Pitt'],
    ['Who plays Rick Blaine in the film Casablanca?', 'Humphrey Bogart', 'Cary Grant', 'James Stewart', 'Clark Gable'],
    ['Which actor played Walter White in Breaking Bad?', 'Bryan Cranston', 'Aaron Paul', 'Bob Odenkirk', 'Giancarlo Esposito'],
    ['The TV series Game of Thrones is based on novels by which author?', 'George R. R. Martin', 'J. R. R. Tolkien', 'Robert Jordan', 'Brandon Sanderson'],
    ['Who directed The Matrix (1999)?', 'The Wachowskis', 'The Coen brothers', 'The Russo brothers', 'The Farrelly brothers'],
    ['Which actor played the Joker in The Dark Knight (2008)?', 'Heath Ledger', 'Joaquin Phoenix', 'Jack Nicholson', 'Jared Leto']
  ]);
  A('film', 'hard', [
    ['Which film won the first Academy Award for Outstanding Picture, in 1929?', 'Wings', 'The Jazz Singer', 'Metropolis', 'Ben-Hur', 'Awarded at the first Academy Awards ceremony, for films of 1927-28.'],
    ['Who directed Seven Samurai (1954)?', 'Akira Kurosawa', 'Yasujiro Ozu', 'Kenji Mizoguchi', 'Hayao Miyazaki'],
    ['Who directed 2001: A Space Odyssey?', 'Stanley Kubrick', 'Steven Spielberg', 'Ridley Scott', 'Andrei Tarkovsky'],
    ['Who directed Citizen Kane (1941)?', 'Orson Welles', 'John Ford', 'Howard Hawks', 'William Wyler'],
    ['Who directed the Italian neorealist film Bicycle Thieves (1948)?', 'Vittorio De Sica', 'Federico Fellini', 'Roberto Rossellini', 'Luchino Visconti'],
    ['Who directed the 1966 film Persona?', 'Ingmar Bergman', 'Jean-Luc Godard', 'Francois Truffaut', 'Michelangelo Antonioni'],
    ['Who directed the silent science-fiction film Metropolis (1927)?', 'Fritz Lang', 'F. W. Murnau', 'Robert Wiene', 'Sergei Eisenstein'],
    ['Who directed Pan\'s Labyrinth (2006)?', 'Guillermo del Toro', 'Alfonso Cuaron', 'Pedro Almodovar', 'Alejandro Gonzalez Inarritu'],
    ['Apocalypse Now (1979) is loosely based on which novella?', 'Heart of Darkness', 'Lord Jim', 'The Secret Agent', 'Nostromo'],
    ['Which film won 11 Academy Awards at the 1998 ceremony?', 'Titanic', 'Good Will Hunting', 'L.A. Confidential', 'As Good as It Gets'],
    ['Who directed Lawrence of Arabia (1962)?', 'David Lean', 'Carol Reed', 'Alfred Hitchcock', 'Michael Powell'],
    ['Who directed the silent film Battleship Potemkin (1925)?', 'Sergei Eisenstein', 'Dziga Vertov', 'Andrei Tarkovsky', 'Lev Kuleshov'],
    ['Who directed La Dolce Vita (1960)?', 'Federico Fellini', 'Pier Paolo Pasolini', 'Bernardo Bertolucci', 'Sergio Leone'],
    ['Who directed Taxi Driver (1976)?', 'Martin Scorsese', 'Francis Ford Coppola', 'Sidney Lumet', 'William Friedkin'],
    ['Who directed the French film Amelie (2001)?', 'Jean-Pierre Jeunet', 'Luc Besson', 'Francois Ozon', 'Michel Gondry'],
    ['Who directed the South Korean film Oldboy (2003)?', 'Park Chan-wook', 'Bong Joon-ho', 'Kim Ki-duk', 'Lee Chang-dong'],
    ['Who directed Blade Runner (1982)?', 'Ridley Scott', 'James Cameron', 'Paul Verhoeven', 'John Carpenter']
  ]);

  A('music', 'easy', [
    ['How many strings does a standard guitar have?', '6', '4', '5', '8'],
    ['Which instrument has 88 keys?', 'Piano', 'Organ', 'Accordion', 'Harp'],
    ['Who composed The Four Seasons?', 'Antonio Vivaldi', 'Johann Sebastian Bach', 'Wolfgang Amadeus Mozart', 'Joseph Haydn'],
    ['Who composed the Moonlight Sonata?', 'Ludwig van Beethoven', 'Franz Schubert', 'Frederic Chopin', 'Johannes Brahms'],
    ['Which band was made up of John, Paul, George and Ringo?', 'The Beatles', 'The Rolling Stones', 'The Who', 'The Kinks'],
    ['To which family of instruments do the trumpet and trombone belong?', 'Brass', 'Woodwind', 'Strings', 'Percussion'],
    ['How many letter-named notes are in the musical alphabet, A to G?', '7', '8', '12', '5'],
    ['Which singer is known as the "King of Pop"?', 'Michael Jackson', 'Elvis Presley', 'Prince', 'Justin Timberlake'],
    ['What do you use to play a violin?', 'A bow', 'A pick', 'Drumsticks', 'A mallet'],
    ['Who composed the opera The Magic Flute?', 'Wolfgang Amadeus Mozart', 'Giuseppe Verdi', 'Richard Wagner', 'Giacomo Puccini'],
    ['How many musicians play in a quartet?', '4', '2', '3', '5'],
    ['What is the lowest male singing voice?', 'Bass', 'Tenor', 'Baritone', 'Alto'],
    ['What does the Italian musical term "forte" mean?', 'Loud', 'Soft', 'Fast', 'Slow'],
    ['What do we call the person who leads an orchestra?', 'Conductor', 'Composer', 'Pianist', 'Producer'],
    ['What does the Italian musical term "piano" mean?', 'Soft', 'Loud', 'Fast', 'Smooth'],
    ['How many lines does a musical staff have?', '5', '4', '6', '8'],
    ['Which member of The Beatles was the drummer?', 'Ringo Starr', 'George Harrison', 'Paul McCartney', 'John Lennon']
  ]);
  A('music', 'medium', [
    ['Who composed the ballet Swan Lake?', 'Pyotr Ilyich Tchaikovsky', 'Igor Stravinsky', 'Sergei Prokofiev', 'Claude Debussy'],
    ['Which band recorded Bohemian Rhapsody?', 'Queen', 'Led Zeppelin', 'Pink Floyd', 'The Rolling Stones'],
    ['Who composed Bolero?', 'Maurice Ravel', 'Claude Debussy', 'Erik Satie', 'Georges Bizet'],
    ['Which instrument is a Stradivarius?', 'Violin', 'Piano', 'Guitar', 'Trumpet', 'Antonio Stradivari made string instruments, most famously violins.'],
    ['Who composed the Brandenburg Concertos?', 'Johann Sebastian Bach', 'George Frideric Handel', 'Antonio Vivaldi', 'Joseph Haydn'],
    ['Which band recorded Hotel California?', 'Eagles', 'Fleetwood Mac', 'The Doors', 'Creedence Clearwater Revival'],
    ['Who recorded the 1989 song Like a Prayer?', 'Madonna', 'Cyndi Lauper', 'Whitney Houston', 'Janet Jackson'],
    ['Which composer continued to write music after losing his hearing?', 'Ludwig van Beethoven', 'Wolfgang Amadeus Mozart', 'Franz Liszt', 'Johannes Brahms'],
    ['Which band released The Dark Side of the Moon in 1973?', 'Pink Floyd', 'Genesis', 'Yes', 'Deep Purple'],
    ['What time signature has three beats per bar?', '3/4', '4/4', '6/8', '2/4'],
    ['Who composed The Rite of Spring?', 'Igor Stravinsky', 'Sergei Rachmaninoff', 'Maurice Ravel', 'Bela Bartok'],
    ['Which artist recorded the 1984 album Purple Rain?', 'Prince', 'Michael Jackson', 'Stevie Wonder', 'David Bowie'],
    ['Who composed Rhapsody in Blue?', 'George Gershwin', 'Leonard Bernstein', 'Aaron Copland', 'Scott Joplin'],
    ['What is the highest standard female singing voice?', 'Soprano', 'Alto', 'Mezzo-soprano', 'Contralto'],
    ['Which band released the 1991 album Nevermind?', 'Nirvana', 'Pearl Jam', 'Soundgarden', 'Metallica'],
    ['Which composer wrote the Symphony No. 9 "From the New World"?', 'Antonin Dvorak', 'Gustav Mahler', 'Bedrich Smetana', 'Johannes Brahms'],
    ['Which artist recorded the 1975 album Born to Run?', 'Bruce Springsteen', 'Bob Dylan', 'Billy Joel', 'Tom Petty']
  ]);
  A('music', 'hard', [
    ['Who composed the orchestral suite The Planets?', 'Gustav Holst', 'Edward Elgar', 'Ralph Vaughan Williams', 'Benjamin Britten'],
    ['In which year was the Woodstock festival held?', '1969', '1967', '1971', '1965'],
    ['Who composed Pictures at an Exhibition?', 'Modest Mussorgsky', 'Nikolai Rimsky-Korsakov', 'Alexander Borodin', 'Sergei Rachmaninoff'],
    ['Which jazz musician released the 1959 album Kind of Blue?', 'Miles Davis', 'John Coltrane', 'Louis Armstrong', 'Duke Ellington'],
    ['Who composed the oratorio Messiah?', 'George Frideric Handel', 'Johann Sebastian Bach', 'Henry Purcell', 'Joseph Haydn'],
    ['Who composed the opera Carmen?', 'Georges Bizet', 'Jules Massenet', 'Hector Berlioz', 'Camille Saint-Saens'],
    ['Which instrument is the cellist Yo-Yo Ma known for playing?', 'Cello', 'Violin', 'Viola', 'Double bass'],
    ['Which Beatles album, released in 1967, features a cover with many famous faces?', 'Sgt. Pepper\'s Lonely Hearts Club Band', 'Revolver', 'Abbey Road', 'Rubber Soul'],
    ['Who composed the opera La Traviata?', 'Giuseppe Verdi', 'Giacomo Puccini', 'Gioachino Rossini', 'Vincenzo Bellini'],
    ['Who composed the piano piece Clair de Lune?', 'Claude Debussy', 'Maurice Ravel', 'Erik Satie', 'Frederic Chopin'],
    ['Who composed the opera The Barber of Seville?', 'Gioachino Rossini', 'Gaetano Donizetti', 'Giuseppe Verdi', 'Wolfgang Amadeus Mozart'],
    ['Which artist released the 1976 album Songs in the Key of Life?', 'Stevie Wonder', 'Marvin Gaye', 'Curtis Mayfield', 'Al Green'],
    ['Who composed the incidental music for Peer Gynt?', 'Edvard Grieg', 'Jean Sibelius', 'Carl Nielsen', 'Edward Elgar'],
    ['Which saxophonist recorded the 1965 album A Love Supreme?', 'John Coltrane', 'Charlie Parker', 'Sonny Rollins', 'Stan Getz'],
    ['Who composed the tone poem Also sprach Zarathustra?', 'Richard Strauss', 'Richard Wagner', 'Gustav Mahler', 'Johann Strauss II'],
    ['Who composed the tone poem Finlandia?', 'Jean Sibelius', 'Edvard Grieg', 'Carl Nielsen', 'Antonin Dvorak'],
    ['Which composer wrote the four-opera cycle The Ring of the Nibelung?', 'Richard Wagner', 'Giuseppe Verdi', 'Richard Strauss', 'Hector Berlioz']
  ]);

  A('sport', 'easy', [
    ['How many players does a football (soccer) team have on the pitch?', '11', '9', '10', '12'],
    ['How many rings are on the Olympic flag?', '5', '4', '6', '7'],
    ['Which sport is played at the Wimbledon Championships?', 'Tennis', 'Cricket', 'Golf', 'Rugby'],
    ['Which sport uses a shuttlecock?', 'Badminton', 'Squash', 'Tennis', 'Table tennis'],
    ['How many points is a touchdown worth in American football?', '6', '3', '7', '5'],
    ['In which sport do players hit a "home run"?', 'Baseball', 'Cricket', 'Golf', 'Tennis'],
    ['How many players from one basketball team are on the court at a time?', '5', '6', '7', '4'],
    ['What is the maximum score in a single game of ten-pin bowling?', '300', '200', '250', '100'],
    ['What is one stroke under par on a golf hole called?', 'Birdie', 'Eagle', 'Bogey', 'Albatross'],
    ['Which country won the 2018 FIFA World Cup?', 'France', 'Croatia', 'Brazil', 'Germany'],
    ['How long is a marathon?', '42.195 km', '26.2 km', '50 km', '21.1 km'],
    ['Which sport features a "slam dunk"?', 'Basketball', 'Volleyball', 'Handball', 'Netball'],
    ['In which sport is a puck used?', 'Ice hockey', 'Field hockey', 'Lacrosse', 'Curling'],
    ['How many minutes does a standard football (soccer) match last, excluding added time?', '90', '60', '80', '120'],
    ['What colour card sends a football player off the pitch?', 'Red', 'Yellow', 'Green', 'Blue'],
    ['In which country did the sport of sumo wrestling originate?', 'Japan', 'China', 'Korea', 'Mongolia'],
    ['How many holes are played in a full round of golf?', '18', '9', '12', '24']
  ]);
  A('sport', 'medium', [
    ['Which country won the 2022 FIFA World Cup?', 'Argentina', 'France', 'Croatia', 'Brazil'],
    ['Which city hosted the 2016 Summer Olympics?', 'Rio de Janeiro', 'London', 'Tokyo', 'Beijing'],
    ['On which surface is the French Open tennis tournament played?', 'Clay', 'Grass', 'Hard court', 'Carpet'],
    ['Which country has won the most men\'s FIFA World Cups?', 'Brazil', 'Germany', 'Italy', 'Argentina', 'Five titles as of 2022.'],
    ['Which NBA team is Michael Jordan best known for playing with?', 'Chicago Bulls', 'Los Angeles Lakers', 'Boston Celtics', 'Detroit Pistons'],
    ['Who holds the men\'s 100 metres world record of 9.58 seconds?', 'Usain Bolt', 'Tyson Gay', 'Yohan Blake', 'Carl Lewis'],
    ['How many players are on the field for one rugby union team?', '15', '11', '13', '9'],
    ['In which city were the first modern Olympic Games held, in 1896?', 'Athens', 'Paris', 'London', 'Rome'],
    ['Which sport is the Tour de France associated with?', 'Cycling', 'Running', 'Motor racing', 'Sailing'],
    ['In baseball, how many strikes make an out?', '3', '2', '4', '5'],
    ['Which country hosted the 2000 Summer Olympics?', 'Australia', 'Greece', 'United States', 'China'],
    ['Which heavyweight boxer called himself "The Greatest"?', 'Muhammad Ali', 'Mike Tyson', 'Joe Frazier', 'George Foreman'],
    ['Which golfer holds the record of 18 men\'s major championships?', 'Jack Nicklaus', 'Tiger Woods', 'Arnold Palmer', 'Gary Player'],
    ['How many players per side are on the court in volleyball?', '6', '5', '7', '8'],
    ['How many balls are bowled in an over in cricket?', '6', '5', '8', '10'],
    ['Which sport uses the terms "scrum" and "try"?', 'Rugby', 'American football', 'Cricket', 'Handball'],
    ['Which country won the first FIFA World Cup in 1930?', 'Uruguay', 'Argentina', 'Brazil', 'Italy']
  ]);
  A('sport', 'hard', [
    ['Which footballer scored the "Hand of God" goal at the 1986 World Cup?', 'Diego Maradona', 'Pele', 'Zico', 'Michel Platini'],
    ['Which city hosted the 1992 Summer Olympics?', 'Barcelona', 'Seoul', 'Atlanta', 'Los Angeles'],
    ['Who was the first gymnast to score a perfect 10 at the Olympics, in 1976?', 'Nadia Comaneci', 'Olga Korbut', 'Mary Lou Retton', 'Nellie Kim'],
    ['Which tennis player won all four Grand Slam singles titles in the 1988 calendar year?', 'Steffi Graf', 'Martina Navratilova', 'Chris Evert', 'Monica Seles'],
    ['How many points did Wilt Chamberlain score in his famous NBA game in 1962?', '100', '81', '73', '90'],
    ['Which country won the first Rugby World Cup, in 1987?', 'New Zealand', 'Australia', 'France', 'South Africa'],
    ['Which country won the 1966 FIFA World Cup?', 'England', 'West Germany', 'Brazil', 'Portugal'],
    ['Which sprinter won four gold medals at the 1936 Berlin Olympics?', 'Jesse Owens', 'Eddie Tolan', 'Ralph Metcalfe', 'Carl Lewis'],
    ['Who won the first modern Olympic marathon, in 1896?', 'Spyridon Louis', 'Abebe Bikila', 'Emil Zatopek', 'Dorando Pietri'],
    ['Which swimmer won eight gold medals at the 2008 Beijing Olympics?', 'Michael Phelps', 'Mark Spitz', 'Ian Thorpe', 'Ryan Lochte'],
    ['How long is an Olympic-size swimming pool?', '50 metres', '25 metres', '100 metres', '33 metres'],
    ['Which Ethiopian runner won the 1960 Olympic marathon in Rome running barefoot?', 'Abebe Bikila', 'Haile Gebrselassie', 'Kenenisa Bekele', 'Mamo Wolde'],
    ['Which country has won the most gold medals at the Summer Olympics overall?', 'United States', 'Soviet Union', 'China', 'Great Britain'],
    ['How many players per team are in the water in water polo, including the goalkeeper?', '7', '6', '5', '9'],
    ['Who was the first person to run a mile in under four minutes, in 1954?', 'Roger Bannister', 'John Landy', 'Jim Ryun', 'Sebastian Coe'],
    ['What is the diameter of a basketball hoop?', '18 inches (45 cm)', '12 inches (30 cm)', '24 inches (60 cm)', '15 inches (38 cm)'],
    ['Which country won the 2014 FIFA World Cup?', 'Germany', 'Argentina', 'Netherlands', 'Brazil']
  ]);

  A('culture', 'easy', [
    ['Which fruit is dried to make raisins?', 'Grapes', 'Plums', 'Cherries', 'Apricots'],
    ['Which Italian dish is made from dough, tomato sauce and cheese?', 'Pizza', 'Risotto', 'Lasagne', 'Gnocchi'],
    ['What is the main ingredient of guacamole?', 'Avocado', 'Tomato', 'Cucumber', 'Pea'],
    ['In which country did sushi become famous as a national dish?', 'Japan', 'China', 'Thailand', 'Vietnam'],
    ['Which nut is the main ingredient of marzipan?', 'Almond', 'Walnut', 'Peanut', 'Cashew'],
    ['What is the main ingredient of bread?', 'Flour', 'Rice', 'Potato', 'Sugar'],
    ['Which country is famous for croissants?', 'France', 'Italy', 'Spain', 'Germany'],
    ['Which vegetable often makes people cry when they cut it?', 'Onion', 'Carrot', 'Cabbage', 'Pumpkin'],
    ['What is the main ingredient of hummus?', 'Chickpeas', 'Lentils', 'Peanuts', 'Black beans'],
    ['In which country is the festival of Diwali mainly celebrated?', 'India', 'Japan', 'Brazil', 'Egypt'],
    ['What is the main language spoken in Brazil?', 'Portuguese', 'Spanish', 'English', 'French'],
    ['How do you say "thank you" in French?', 'Merci', 'Gracias', 'Danke', 'Grazie'],
    ['What is the main language spoken in Mexico?', 'Spanish', 'Portuguese', 'English', 'Nahuatl'],
    ['How do you say "hello" in Spanish?', 'Hola', 'Bonjour', 'Ciao', 'Hallo'],
    ['In which country is the Oktoberfest festival held?', 'Germany', 'Austria', 'Switzerland', 'Belgium'],
    ['Which drink is made from the roasted and ground seeds of the Coffea plant?', 'Coffee', 'Tea', 'Cocoa', 'Chicory'],
    ['According to the proverb, which fruit a day keeps the doctor away?', 'An apple', 'A banana', 'An orange', 'A pear']
  ]);
  A('culture', 'medium', [
    ['Which spice comes from the dried stigmas of a crocus flower?', 'Saffron', 'Turmeric', 'Paprika', 'Cumin'],
    ['Which cheese is traditionally used in a Greek salad?', 'Feta', 'Mozzarella', 'Cheddar', 'Brie'],
    ['In which country did the dish paella originate?', 'Spain', 'Portugal', 'Italy', 'Mexico'],
    ['What is the main ingredient of the Korean dish kimchi?', 'Fermented cabbage', 'Rice', 'Noodles', 'Seaweed'],
    ['Which language has the most native speakers in the world?', 'Mandarin Chinese', 'English', 'Spanish', 'Hindi', 'By native speakers; English leads when second-language speakers are counted.'],
    ['What is the traditional Japanese rice wine called?', 'Sake', 'Soju', 'Baijiu', 'Mirin'],
    ['In which country is the famous Carnival of Rio de Janeiro held?', 'Brazil', 'Argentina', 'Portugal', 'Colombia'],
    ['What is tofu made from?', 'Soybeans', 'Rice', 'Wheat', 'Chickpeas'],
    ['In which country is the traditional dish haggis from?', 'Scotland', 'Ireland', 'Wales', 'England'],
    ['What is the Spanish word for "thank you"?', 'Gracias', 'Por favor', 'De nada', 'Adios'],
    ['What is the German word for "water"?', 'Wasser', 'Wein', 'Wind', 'Wald'],
    ['Which grain is used to make traditional Mexican corn tortillas?', 'Maize', 'Wheat', 'Rice', 'Oats'],
    ['What is the Italian word for "thank you"?', 'Grazie', 'Prego', 'Ciao', 'Scusi'],
    ['Which animal follows the Rat in the Chinese zodiac cycle?', 'Ox', 'Tiger', 'Rabbit', 'Pig'],
    ['What is the Japanese art of paper folding called?', 'Origami', 'Ikebana', 'Kabuki', 'Haiku'],
    ['In which country did tea cultivation originate?', 'China', 'India', 'Japan', 'Sri Lanka'],
    ['Which spice is the dried inner bark of a tree?', 'Cinnamon', 'Nutmeg', 'Clove', 'Ginger']
  ]);
  A('culture', 'hard', [
    ['What is the main ingredient of traditional Japanese miso?', 'Fermented soybeans', 'Fermented rice only', 'Seaweed', 'Dried fish'],
    ['Which country is the world\'s largest producer of coffee?', 'Brazil', 'Colombia', 'Vietnam', 'Ethiopia'],
    ['Which country is the birthplace of the mojito cocktail?', 'Cuba', 'Mexico', 'Jamaica', 'Spain'],
    ['Which is generally considered the most expensive spice by weight?', 'Saffron', 'Vanilla', 'Cardamom', 'Black pepper'],
    ['Which language family includes both Finnish and Hungarian?', 'Uralic', 'Indo-European', 'Turkic', 'Semitic'],
    ['Which alphabet is used to write Russian?', 'Cyrillic', 'Latin', 'Greek', 'Glagolitic'],
    ['What does the Japanese word "sayonara" mean?', 'Goodbye', 'Thank you', 'Hello', 'Please'],
    ['Which language of Spain and France is a language isolate unrelated to its neighbours?', 'Basque', 'Catalan', 'Occitan', 'Galician'],
    ['Which country declared ceviche part of its national heritage?', 'Peru', 'Chile', 'Argentina', 'Mexico', 'Peru declared ceviche national cultural heritage in 2004.'],
    ['What is the official language of Iran?', 'Persian', 'Arabic', 'Turkish', 'Urdu'],
    ['Which pasta name means "little worms" in Italian?', 'Vermicelli', 'Farfalle', 'Penne', 'Orecchiette'],
    ['Which Indian bread is traditionally baked in a clay tandoor oven?', 'Naan', 'Chapati', 'Paratha', 'Puri'],
    ['Which alphabet is used to write the Korean language?', 'Hangul', 'Hanja', 'Kana', 'Devanagari'],
    ['In which country do people traditionally eat pierogi?', 'Poland', 'Spain', 'Portugal', 'Greece'],
    ['Which cold Spanish soup is made from raw tomatoes, peppers and cucumber?', 'Gazpacho', 'Borscht', 'Minestrone', 'Vichyssoise'],
    ['What is the Portuguese word for "thank you" said by a man?', 'Obrigado', 'Gracias', 'Merci', 'Danke'],
    ['In which country does Parmigiano-Reggiano cheese come from?', 'Italy', 'France', 'Switzerland', 'Spain']
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
