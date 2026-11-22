/* Stark Event Kit: game jam themes, constraints, checklist, rubric and event templates. All original. */
(function (g) {
  'use strict';
  var S = g.SEK = g.SEK || {};

  S.JAM_THEMES = [
    'Borrowed time', 'The last lighthouse', 'Everything is connected', 'Small things matter', 'Out of order',
    'You only get three', 'Lost and found', 'Stuck in a loop', 'The long way home', 'Quiet hours',
    'Made of paper', 'Every door opens once', 'Two sides of the same coin', 'Tiny kingdom', 'Weather the storm',
    'Nothing stays buried', 'Carry it together', 'The map is wrong', 'Rules that bend', 'Echoes',
    'A world that shrinks', 'Night shift', 'Spare parts', 'The last train', 'Growing pains',
    'Handle with care', 'Between the tides', 'Broken signal', 'Under the surface', 'One more turn',
    'Gifts from strangers', 'Fragile alliance', 'Inherited machines', 'The smallest hero', 'No way back',
    'Salvage', 'Patchwork', 'Slow down', 'The garden at the edge', 'Messages in bottles',
    'Make do', 'Distant lights', 'Hidden in plain sight', 'Pulse', 'The last one standing up',
    'Unlikely neighbours', 'Clockwork', 'Seeds', 'Beneath the floorboards', 'Running out of room',
    'Fog', 'A town without names', 'Pass it on', 'The quiet machine', 'Second wind',
    'Tools of the trade', 'Strings attached', 'Open source feelings', 'Halfway there', 'Low tide'
  ];
  S.JAM_CONSTRAINTS = [
    'Only one button', 'No text on screen', 'Two colours only', 'Under 5 MB', 'Play for under 3 minutes',
    'One-handed controls', 'The game gets harder by itself', 'No enemies', 'Everything is a circle',
    'Sound carries the gameplay', 'Single screen', 'The player can only move in one direction',
    'No jumping', 'Co-operative for two', 'Must be playable by a grandparent', 'Only primitive shapes',
    'The ending is decided by the player\'s first action', 'A timer is the main mechanic',
    'Nothing is destroyed', 'Only found assets in the first hour, then only your own'
  ];
  S.JAM_DURATIONS = [
    { label: '1 hour sprint', sec: 3600 }, { label: '3 hours', sec: 10800 }, { label: '8 hours', sec: 28800 },
    { label: '24 hours', sec: 86400 }, { label: '48 hours', sec: 172800 }, { label: '72 hours', sec: 259200 }
  ];
  S.JAM_CHECKLIST = [
    'Game starts and runs from a clean download',
    'Theme is clearly used in the game',
    'Title screen with game name and short instructions',
    'Controls are explained in the game or on the page',
    'Page has a title, a one-line pitch and a description',
    'At least three screenshots uploaded',
    'Cover image prepared at the required size',
    'Credits listed for every person on the team',
    'Third-party assets are listed with their licences',
    'Build tested on a second computer',
    'Known bugs written down honestly',
    'Source or build files saved and backed up',
    'Submission made before the deadline',
    'Team has agreed who answers questions afterwards'
  ];
  S.RUBRIC_DEFAULT = [
    { id: 'theme', name: 'Use of theme', weight: 20, desc: 'How clearly and creatively the theme shapes the game.' },
    { id: 'fun', name: 'Fun and feel', weight: 30, desc: 'Is it enjoyable to play, and does it feel good to control?' },
    { id: 'creativity', name: 'Creativity', weight: 20, desc: 'A fresh idea or a fresh angle on a known one.' },
    { id: 'polish', name: 'Polish', weight: 15, desc: 'Finish, clarity, absence of showstopping bugs.' },
    { id: 'audiovisual', name: 'Art and sound', weight: 15, desc: 'Visual and audio identity within the time available.' }
  ];

  var STD = { pts: { easy: 1, medium: 2, hard: 3 }, penalty: 0, bonus: 0 };
  function sc(o) { var r = { pts: { easy: 1, medium: 2, hard: 3 }, penalty: 0, bonus: 0 }; for (var k in o) r[k] = o[k]; return r; }

  S.ICEBREAKERS = [
    'What is a small skill you have that nobody at work knows about?',
    'Describe your first job in exactly five words.',
    'If this team ran a cafe, what would be on the menu board?',
    'What is the best piece of advice you ever ignored?',
    'Name something you are learning right now, however small.',
    'Which tool in your daily life deserves an award, and why?',
    'What would you put in a time capsule for the next team?',
    'Share a time a plan failed and something better happened.',
    'What is one habit that makes your mornings better?',
    'If you could swap jobs with someone here for a day, who and why?',
    'Name a book, film or game that changed how you think.',
    'What is the most useful thing you learned in school that was not on the syllabus?'
  ];

  S.TEMPLATES = [
    { id: 'biz-quiz-hour', kind: 'business', name: 'Team-building quiz hour', blurb: 'Four mixed rounds for 4 to 8 teams. Easy warm-up, ramping to hard, answers revealed on the projector.',
      minutes: 60, agenda: ['0-5 Welcome, teams, rules', '5-15 Round 1: warm-up', '15-30 Round 2: around the world', '30-45 Round 3: science and technology', '45-55 Round 4: brain teasers', '55-60 Scores and prizes'],
      cfg: { name: 'Team-building quiz hour', mode: 'team', teams: 6, showChoices: true, timerSec: 25, scoring: sc({}),
        rounds: [{ name: 'Warm-up', type: 'quiz', cat: 'all', diff: 'easy', count: 8 }, { name: 'Around the world', type: 'quiz', cat: 'geography', diff: 'mixed', count: 8 },
          { name: 'Science and technology', type: 'quiz', cat: ['science', 'technology', 'space'], diff: 'mixed', count: 8 }, { name: 'Brain teasers', type: 'quiz', cat: ['mathematics', 'nature'], diff: 'mixed', count: 6 }] } },
    { id: 'biz-showdown', kind: 'business', name: 'Department showdown (buzzers)', blurb: 'Fast buzzer rounds between departments. Wrong buzz costs a point, so teams think before they hit the key.',
      minutes: 45, agenda: ['0-5 Intro and buzzer test', '5-20 Round 1: general knowledge', '20-35 Round 2: tougher questions', '35-45 Final scores and certificates'],
      cfg: { name: 'Department showdown', mode: 'buzzer', teams: 4, showChoices: true, timerSec: 15, scoring: sc({ penalty: 1, bonus: 1 }),
        rounds: [{ name: 'General knowledge', type: 'quiz', cat: 'all', diff: 'mixed', count: 10 }, { name: 'Sudden strike', type: 'quiz', cat: 'all', diff: 'hard', count: 8 }] } },
    { id: 'biz-icebreaker', kind: 'business', name: 'Icebreaker round', blurb: 'Twelve talking prompts with no right answers, followed by a short scored quiz. Good for new teams and offsites.',
      minutes: 30, agenda: ['0-15 Prompts, one per table', '15-30 Quick quiz round'],
      cfg: { name: 'Icebreaker round', mode: 'team', teams: 5, showChoices: true, timerSec: 20, scoring: sc({}),
        rounds: [{ name: 'Talk it out', type: 'prompts', count: 6 }, { name: 'Quick quiz', type: 'quiz', cat: 'all', diff: 'easy', count: 8 }] } },
    { id: 'biz-jam-day', kind: 'business', name: 'Offsite game jam day', blurb: 'A one-day creative event: theme reveal, timer, submission checklist and a judging rubric with score sheets.',
      minutes: 480, agenda: ['0-30 Kick-off and theme reveal', '30-420 Build time', '420-450 Submit and demo', '450-480 Judging and awards'], link: '#/jam', cfg: null },
    { id: 'edu-science-math', kind: 'school', name: 'Classroom review: science and maths', blurb: 'Teams of four review science, space and maths. Choices shown, no negative marking, 30 seconds a question.',
      minutes: 40, agenda: ['0-5 Form teams', '5-35 Three review rounds', '35-40 Scores and reflection'],
      cfg: { name: 'Science and maths review', mode: 'team', teams: 6, showChoices: true, timerSec: 30, scoring: sc({}),
        rounds: [{ name: 'Science', type: 'quiz', cat: 'science', diff: 'mixed', count: 6 }, { name: 'Space and nature', type: 'quiz', cat: ['space', 'nature'], diff: 'mixed', count: 6 }, { name: 'Maths', type: 'quiz', cat: 'mathematics', diff: 'mixed', count: 6 }] } },
    { id: 'edu-humanities', kind: 'school', name: 'Classroom review: humanities', blurb: 'History, geography and literature for revision week. Printable answer sheets for every team.',
      minutes: 40, agenda: ['0-5 Form teams', '5-35 Three review rounds', '35-40 Scores and reflection'],
      cfg: { name: 'Humanities review', mode: 'team', teams: 6, showChoices: true, timerSec: 30, scoring: sc({}),
        rounds: [{ name: 'History', type: 'quiz', cat: 'history', diff: 'mixed', count: 6 }, { name: 'Geography', type: 'quiz', cat: 'geography', diff: 'mixed', count: 6 }, { name: 'Literature', type: 'quiz', cat: 'literature', diff: 'mixed', count: 6 }] } },
    { id: 'edu-exit-ticket', kind: 'school', name: 'Exit-ticket quiz', blurb: 'Ten written questions for individual students at the end of a lesson. Print the sheets, read the questions, mark the answers.',
      minutes: 15, agenda: ['0-2 Hand out sheets', '2-12 Read ten questions', '12-15 Swap and mark'],
      cfg: { name: 'Exit-ticket quiz', mode: 'pub', teams: 8, showChoices: false, timerSec: 40, scoring: sc({}),
        rounds: [{ name: 'Exit ticket', type: 'quiz', cat: 'all', diff: 'mixed', count: 10 }] } },
    { id: 'edu-bracket-day', kind: 'school', name: 'Class tournament day', blurb: 'Seed a class or year group into a bracket and play head-to-head quiz matches. Opens the bracket tool.',
      minutes: 60, agenda: ['0-10 Seed the bracket', '10-55 Matches', '55-60 Final and certificates'], link: '#/bracket', cfg: null },
    { id: 'com-fundraiser', kind: 'community', name: 'Charity quiz and raffle night', blurb: 'Guest list and check-in at the door, a three-round quiz, then a prize draw anyone can verify. Opens the planner.',
      minutes: 150, agenda: ['0-30 Doors, check-in and raffle tickets', '30-35 Welcome', '35-80 Rounds 1 and 2', '80-95 Break', '95-120 Round 3 and scores', '120-140 Prize draw', '140-150 Thanks and totals'], link: '#/plan', cfg: null },
    { id: 'com-league', kind: 'community', name: 'Pub quiz league season', blurb: 'Weekly quiz nights that add up to a season ladder, or a round-robin league with fixtures and a table. Opens the league tool.',
      minutes: 90, agenda: ['Weekly: run a quiz night to the end', 'It is added to the season ladder automatically', 'Print the ladder each week'], link: '#/league', cfg: null },
    { id: 'com-trivia-night', kind: 'community', name: 'Community trivia night', blurb: 'Four relaxed rounds for clubs, libraries and fundraisers, with a picture-free mix of everything and printable answer sheets.',
      minutes: 75, agenda: ['0-10 Welcome and teams', '10-60 Four rounds', '60-75 Scores and prizes'],
      cfg: { name: 'Community trivia night', mode: 'pub', teams: 8, showChoices: false, timerSec: 40, scoring: sc({}),
        rounds: [{ name: 'Everything', type: 'quiz', cat: 'all', diff: 'easy', count: 8 }, { name: 'People and places', type: 'quiz', cat: ['history', 'geography', 'culture'], diff: 'mixed', count: 8 },
          { name: 'Screen and sound', type: 'quiz', cat: ['film', 'music', 'sport'], diff: 'mixed', count: 8 }, { name: 'How things work', type: 'quiz', cat: ['science', 'technology', 'nature', 'space'], diff: 'mixed', count: 8 }] } }
  ];
  S.STD_SCORING = STD;
})(typeof window !== 'undefined' ? window : globalThis);
