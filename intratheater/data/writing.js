/* Stark IntraTheater. Story Studio: writing prompts, the story-mountain planner, revision checklists and word banks.
   All prompts are original to Stark IntraTheater. Levels: young (about 5 to 8), junior (9 to 12), teen (13 and up, grown-ups too).
   Strict JSON sits between each JSON marker and END marker (tests/test_data.py reads it). */
window.SIT_DATA = window.SIT_DATA || {};
window.SIT_DATA.writeGenres = /*JSON:writeGenres*/[
{"id": "adventure", "label": "Adventure", "icon": "🧭"},
{"id": "mystery", "label": "Mystery", "icon": "🔍"},
{"id": "funny", "label": "Funny", "icon": "😂"},
{"id": "fantasy", "label": "Fantasy", "icon": "🐉"},
{"id": "space", "label": "Space and the future", "icon": "🚀"},
{"id": "history", "label": "Time travel and history", "icon": "🏛️"},
{"id": "family", "label": "Family memories", "icon": "👪"},
{"id": "nature", "label": "Animals and nature", "icon": "🌿"},
{"id": "friendship", "label": "Friendship", "icon": "🤝"}
]/*END*/;
window.SIT_DATA.writePrompts = /*JSON:writePrompts*/[
{"id": "adv-1", "genre": "adventure", "level": "young", "text": "You find a tiny door at the bottom of your garden. It is just big enough for you to squeeze through. What is on the other side?"},
{"id": "adv-2", "genre": "adventure", "level": "junior", "text": "A storm washes a sealed bottle onto the beach. Inside is a map with your name written on it. Follow the map."},
{"id": "adv-3", "genre": "adventure", "level": "teen", "text": "The last ferry of the season leaves without you, and the island empties. You have three days until help can come."},
{"id": "adv-4", "genre": "adventure", "level": "junior", "text": "Your bicycle can suddenly ride on water. Where do you go first, and who tries to stop you?"},
{"id": "mys-1", "genre": "mystery", "level": "young", "text": "Every morning, one sock is missing from the washing line. Who, or what, is taking them?"},
{"id": "mys-2", "genre": "mystery", "level": "junior", "text": "The school's old clock stops at 3:17 every afternoon. Today you decide to find out why."},
{"id": "mys-3", "genre": "mystery", "level": "teen", "text": "A library book is returned forty years late, with a note tucked inside that only you seem able to read."},
{"id": "mys-4", "genre": "mystery", "level": "young", "text": "There are muddy paw prints across the kitchen ceiling. Be the detective."},
{"id": "fun-1", "genre": "funny", "level": "young", "text": "Your pet goldfish starts giving orders. Write what happens on the first day."},
{"id": "fun-2", "genre": "funny", "level": "junior", "text": "You swap places with your teacher for one day. Nothing goes to plan."},
{"id": "fun-3", "genre": "funny", "level": "teen", "text": "A smart fridge decides it knows what is best for the whole family and starts locking its door."},
{"id": "fun-4", "genre": "funny", "level": "junior", "text": "Grandad enters the town talent show with an act nobody has ever seen before."},
{"id": "fan-1", "genre": "fantasy", "level": "young", "text": "A baby dragon hatches in your shoebox. It is hungry, and it does not eat ordinary food."},
{"id": "fan-2", "genre": "fantasy", "level": "junior", "text": "Every person in your town has one small magic power. Yours seems useless, until today."},
{"id": "fan-3", "genre": "fantasy", "level": "teen", "text": "The mapmaker's apprentice discovers that whatever she draws on the map becomes real by morning."},
{"id": "fan-4", "genre": "fantasy", "level": "young", "text": "The moon falls asleep and forgets to rise. Who will wake it up?"},
{"id": "spa-1", "genre": "space", "level": "young", "text": "A friendly robot lands in the park and asks you to show it the best thing on Earth."},
{"id": "spa-2", "genre": "space", "level": "junior", "text": "You are the youngest crew member on the first school trip to Mars. Something on the ship is not working."},
{"id": "spa-3", "genre": "space", "level": "teen", "text": "A radio telescope picks up a message. It is in your grandmother's handwriting."},
{"id": "spa-4", "genre": "space", "level": "junior", "text": "In the year 2126, a museum shows an object from your house today. Explain to the visitors what it was for."},
{"id": "his-1", "genre": "history", "level": "young", "text": "You wake up in a village of the first farmers, 10,000 years ago. What do you help them with?"},
{"id": "his-2", "genre": "history", "level": "junior", "text": "You are a young scribe in ancient Egypt, and the pharaoh has asked you to write down a secret. Keep it safe."},
{"id": "his-3", "genre": "history", "level": "teen", "text": "Choose any moment on the History timeline. Write it as a diary entry from someone who was there but is not in the history books."},
{"id": "his-4", "genre": "history", "level": "junior", "text": "You are a reporter at the very first Olympic Games in ancient Greece. Write your report for people at home."},
{"id": "fam-1", "genre": "family", "level": "young", "text": "Draw and write about the best day you ever had with someone in your family."},
{"id": "fam-2", "genre": "family", "level": "junior", "text": "Interview a grandparent or older relative about a day they will never forget. Turn their answers into a story."},
{"id": "fam-3", "genre": "family", "level": "teen", "text": "Write the story behind an old object in your home: who owned it first, and how did it reach you?"},
{"id": "fam-4", "genre": "family", "level": "junior", "text": "Your family's favourite recipe can talk. Let it tell the story of every meal it has been part of."},
{"id": "nat-1", "genre": "nature", "level": "young", "text": "You can understand what birds are saying for one day. What do they tell you?"},
{"id": "nat-2", "genre": "nature", "level": "junior", "text": "A very old tree in your street is going to be cut down. Tell its story, from a seed to today."},
{"id": "nat-3", "genre": "nature", "level": "teen", "text": "Write about one year in a river, season by season, from the point of view of the water."},
{"id": "nat-4", "genre": "nature", "level": "young", "text": "A hedgehog, a fox and an owl share a secret. Tell their story."},
{"id": "fri-1", "genre": "friendship", "level": "young", "text": "The new kid in class does not speak your language yet. How do you become friends?"},
{"id": "fri-2", "genre": "friendship", "level": "junior", "text": "Two best friends find out they both want the same part in the school play."},
{"id": "fri-3", "genre": "friendship", "level": "teen", "text": "Two friends who have not spoken for ten years meet again on a delayed train."},
{"id": "fri-4", "genre": "friendship", "level": "junior", "text": "You and a friend are stuck in a lift with a stranger who says they are a famous inventor."}
]/*END*/;
window.SIT_DATA.storyMountain = /*JSON:storyMountain*/[
{"id": "opening", "label": "Opening", "icon": "🌅", "kid": "Who is in your story, and where are they?", "grown": "Introduce the main character, the setting and what the character wants."},
{"id": "buildup", "label": "Build-up", "icon": "🧗", "kid": "What starts to happen?", "grown": "Set things moving: a journey, a discovery or a change that raises the stakes."},
{"id": "problem", "label": "Problem", "icon": "⛈️", "kid": "What goes wrong? This is the most exciting part!", "grown": "The crisis: the obstacle or conflict at the top of the mountain."},
{"id": "resolution", "label": "Resolution", "icon": "🛠️", "kid": "How is the problem fixed, and who helps?", "grown": "How the character faces the problem, and what it costs them."},
{"id": "ending", "label": "Ending", "icon": "🏡", "kid": "How does everyone feel at the end?", "grown": "Close the story: what has changed, and what did the character learn?"}
]/*END*/;
window.SIT_DATA.reviseKid = /*JSON:reviseKid*/[
{"id": "k-caps", "text": "Every sentence starts with a capital letter."},
{"id": "k-stops", "text": "Every sentence ends with . or ! or ?"},
{"id": "k-names", "text": "Names of people and places start with capital letters."},
{"id": "k-and", "text": "I did not use 'and then' too many times."},
{"id": "k-feel", "text": "I said how my characters feel."},
{"id": "k-read", "text": "I read my story out loud (or listened to it) to check it."}
]/*END*/;
window.SIT_DATA.reviseGrown = /*JSON:reviseGrown*/[
{"id": "g-hook", "text": "The first sentence makes the reader want to keep going."},
{"id": "g-show", "text": "I show feelings through actions and dialogue, not just by naming them."},
{"id": "g-senses", "text": "At least three senses appear (sight, sound, smell, touch, taste)."},
{"id": "g-said", "text": "Speech is punctuated correctly and 'said' is not overused."},
{"id": "g-vary", "text": "My sentences vary in length and in how they begin."},
{"id": "g-cut", "text": "I cut words that do no work (very, really, just, suddenly)."},
{"id": "g-arc", "text": "The ending answers the problem set up at the start."},
{"id": "g-aloud", "text": "I read the whole piece aloud and fixed anything that sounded wrong."}
]/*END*/;
window.SIT_DATA.wordBank = /*JSON:wordBank*/[
{"id": "said", "label": "Instead of 'said'", "words": ["whispered", "shouted", "giggled", "muttered", "explained", "asked", "replied", "gasped", "grumbled", "announced", "sighed", "called"]},
{"id": "feelings", "label": "Feelings", "words": ["delighted", "nervous", "furious", "puzzled", "proud", "lonely", "relieved", "curious", "terrified", "grateful", "jealous", "calm"]},
{"id": "senses", "label": "Senses", "words": ["glittering", "crackling", "musty", "silky", "sour", "booming", "shadowy", "prickly", "sweet-smelling", "icy", "rumbling", "gleaming"]},
{"id": "time", "label": "Time and order", "words": ["Suddenly,", "Meanwhile,", "Later that day,", "At first,", "Before long,", "Eventually,", "The next morning,", "Without warning,", "Finally,", "Just then,"]},
{"id": "openers", "label": "Story openers", "words": ["Once, long ago,", "Nobody expected", "It all started when", "The day began like any other, until", "Far away, in a land of", "If you had been there,"]}
]/*END*/;
