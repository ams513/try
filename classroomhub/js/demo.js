/* Stark Classroom Hub. A small made-up class (first names only) so a teacher can look around
   before entering real students. Built from today's date; "Clear everything" on the Safety page removes it. */
(function (root) {
  'use strict';
  const SCH = root.SCH = root.SCH || {};
  function build(todayIso) {
    const L = SCH.lib, s = L.emptyState();
    s.classroom = { name: 'Room 4 (sample class)', teacher: 'Ms Reyes', termName: 'Autumn term', termStart: L.addDays(todayIso, -42), termEnd: L.addDays(todayIso, 63) };
    L.addStudents(s, 'Maya, Leo, Priya, Sam K., Amara, Noah, Zoe, Kenji');
    const ids = s.students.map(x => x.id);
    s.standards = [['HIST.1', 'Explains causes in history'], ['GEO.2', 'Uses maps to locate places'], ['SPEAK.1', 'Takes part in discussion'], ['WRITE.1', 'Organises writing with an opening and an ending'],
      ['WRITE.2', 'Uses descriptive language'], ['WRITE.3', 'Uses spelling and punctuation conventions'], ['MATH.4', 'Describes and extends patterns']].map(x => ({ code: x[0], label: x[1] }));
    const A = L.newAssignment(s, { title: 'Early civilizations unit', due: L.addDays(todayIso, -10), weight: 1, rubric: [{ text: 'Explains why cities grew by rivers', std: 'HIST.1' }, { text: 'Finds places on the map', std: 'GEO.2' }, { text: 'Takes part in the class talk', std: 'SPEAK.1' }], intra: ['35-river-civilizations', '35-greece-and-rome'] });
    const W = L.TEMPLATES[0].criteria;
    const B = L.newAssignment(s, { title: 'Personal narrative', due: L.addDays(todayIso, 6), weight: 2, rubric: [{ text: 'Clear opening', std: 'WRITE.1', levels: W[1].levels }, { text: 'Strong ending', std: 'WRITE.1', levels: W[1].levels }, { text: 'Uses the senses', std: 'WRITE.2', levels: W[2].levels }, { text: 'Spelling and punctuation', std: 'WRITE.3', levels: W[3].levels }], quill: { prompt: 'Write about a day you remember. Use your senses.', wordTarget: 400 },
      tiers: { support: 'Use the story map and the sentence starters. Aim for 250 words.', core: 'Write about 400 words about a day you remember, using your senses.', extend: 'Tell the same day a second time from another person\'s point of view.' } });
    const C = L.newAssignment(s, { title: 'Lantern Row pattern lab', due: L.addDays(todayIso, 13), weight: 1, rubric: [{ text: 'Describes the pattern as repeat and step', std: 'MATH.4' }, { text: 'Builds a new pattern', std: 'MATH.4' }], world: ['loops'] });
    L.newAssignment(s, { title: 'Times tables check', due: L.addDays(todayIso, 27), weight: 1, rubric: [{ text: 'Accuracy', max: 10 }], intra: ['x-35-times-tables'] });
    const lessons = [['35-river-civilizations', 'Cities by the rivers'], ['35-greece-and-rome', 'Ancient Greece and Rome']];
    const done = [2, 2, 1, 2, 0, 1, 2, 1];
    ids.forEach((sid, i) => {
      const ls = lessons.slice(0, done[i]).map(x => x[1]);
      L.applyImport(s, [{ sid, ev: L.parseIntraCSV('Student,Stars,Moments explored,Lessons completed,Lesson titles,Average best quiz %,Geography: capitals (kids) best %\r\nx,' + (6 + i * 3) + ',' + (10 + i * 2) + ',' + ls.length + ',' + ls.join('; ') + ',' + (62 + (i * 7) % 33) + ',' + (62 + (i * 7) % 33) + '\r\n').records[0].ev }], todayIso);
    });
    const qa = L.quillFor(B, 'Ms Reyes');
    [0, 1, 3, 4, 6].forEach(i => {
      L.applyImport(s, [{ sid: ids[i], ev: L.quillEvidence({ info: { student: s.students[i].name, book_title: 'A day by the river', words: 310 + i * 35, word_target: 400, assignment: { title: B.title, id: qa.id, due: B.due }, rubric: { done: 2 + (i % 3), total: 4, criteria: [] }, reflection_words: 14, created: todayIso }, reflection: 'I like my opening. I would make the ending stronger.' }) }], todayIso);
    });
    [0, 2, 5].forEach(i => {
      const r = L.parseWorldReflection('Reflection: Lantern Run\nStudent: ' + s.students[i].name + '\nDate: ' + todayIso + '\nLesson: Loops and patterns: Lantern Row\nGoal: x\n\nAbout the game (counted from the saved game):\n  Levels: 1   Objects: ' + (14 + i * 3) + '   Quests: 1   Custom items: 1\n  Checker: no problems found\n\n1. What did you build?\n   A row of lamps.\n2. What was hardest, and how did you solve it?\n   ' + (i === 2 ? '(no answer)' : 'Counting the step.') + '\n3. What would you change next?\n   More lamps.\n\nFree write: (none)\n');
      L.applyImport(s, [{ sid: ids[i], ev: r.records[0].ev }], todayIso);
    });
    const comments = ['Great thinking about rivers and farms.', 'Good effort, add more detail next time.', 'Lovely work, keep it up.', 'Needs a little more practice with the map.', 'Really thoughtful ideas.'];
    [A, B].forEach((a, ai) => {
      s.grades[a.id] = {};
      ids.forEach((sid, i) => {
        if (ai === 1 && ![0, 1, 3, 4, 6].includes(i)) return;
        const scores = {}; a.rubric.forEach((c, k) => { scores[c.id] = Math.min(c.max, [4, 3, 4, 3, 2, 4, 3, 4][(i * 3 + k * 5 + ai * 2) % 8]); });
        s.grades[a.id][sid] = { scores, comment: comments[(i + ai) % comments.length] };
      });
    });
    /* 1.1: lessons and units, attendance, seating, groups, notes, rubric library, differentiation, conference and substitute details */
    const mon = L.weekStart(todayIso);
    const U1 = L.addUnit(s, { title: 'Early civilizations', start: L.addDays(todayIso, -42), end: L.addDays(todayIso, -8), goal: 'Explain why the first cities grew beside rivers and what they gave the world.', standards: ['HIST.1', 'GEO.2'] });
    const U2 = L.addUnit(s, { title: 'Personal narrative writing', start: L.addDays(mon, -7), end: L.addDays(mon, 11), goal: 'Write a true story with a clear opening, vivid detail and a strong ending.', standards: ['WRITE.1', 'WRITE.2', 'WRITE.3'] });
    [['River cities on the map', 'Locate four river civilizations on a world map.', 'Map hunt in pairs, then a class map on the board.', 'Atlases, blank world maps', '', ['GEO.2'], -14],
      ['Hook: a day I remember', 'Choose a memorable day and list what you saw, heard and felt.', 'Teacher story, then a senses chart in pairs. Share one detail each.', 'Senses chart, coloured pens', 'Ask a family member about a day they remember.', ['WRITE.2'], 0],
      ['Openings that pull you in', 'Write two different openings and choose the stronger one.', 'Compare three openings from class books. Draft two openings. Partner vote.', 'Class books, sticky notes', '', ['WRITE.1'], 1],
      ['Show, do not tell', 'Turn three telling sentences into showing sentences.', 'Warm-up game, model on the board, then draft the middle of the story.', 'Sentence strips', '', ['WRITE.2'], 2],
      ['Endings that land', 'Write an ending that links back to the opening.', 'Look at endings in two picture books. Draft an ending. Read aloud to a partner.', 'Picture books', 'Finish the first draft.', ['WRITE.1'], 3],
      ['Edit and polish', 'Check spelling and punctuation with a partner.', 'Editing checklist, partner swap, then copy up in Quill.', 'Editing checklist, laptops', '', ['WRITE.3'], 4],
      ['Patterns warm-up', 'Describe a repeating pattern as repeat and step.', 'Bead patterns on the carpet, then predict the 10th item.', 'Beads, number lines', '', ['MATH.4'], 7]].forEach(x => {
      L.addPlan(s, { unitId: x[6] < 0 ? U1.id : x[6] < 7 ? U2.id : '', date: L.addDays(mon, x[6]), title: x[0], objective: x[1], activities: x[2], materials: x[3], homework: x[4], standards: x[5] });
    });
    const away = { 1: [2, 9], 6: [4, 11, 13], 7: [1, 3, 8, 12] }, late = { 1: [6], 5: [3, 10] };
    let d = todayIso, n = 0;
    while (n < 15) { const wd = new Date(d + 'T00:00:00Z').getUTCDay(); if (wd && wd < 6) { const marks = {}; ids.forEach((sid, i) => { if ((away[i] || []).includes(n)) marks[sid] = i === 6 && n === 4 ? 'E' : 'A'; else if ((late[i] || []).includes(n)) marks[sid] = 'L'; }); L.takeRegister(s, d, marks); n++; } d = L.addDays(d, -1); }
    s.seating.rows = 3; s.seating.cols = 4; L.addApart(s, ids[1], ids[5]);
    L.addNote(s, { sid: ids[0], date: L.addDays(todayIso, -3), kind: 'positive', text: 'Helped a new classmate find the library books and showed her the reading corner.', share: { parent: true } });
    L.addNote(s, { sid: ids[1], date: L.addDays(todayIso, -2), kind: 'concern', text: 'Found it hard to settle after break; a movement job (handing out books) helped.', share: { sub: true } });
    L.addNote(s, { sid: ids[2], date: L.addDays(todayIso, -1), kind: 'note', text: 'Asked for extra challenge in maths. Try the extension cards.' });
    L.saveRubric(s, 'Personal narrative (Room 4)', B.rubric);
    s.sub = { routines: 'Line up at the door at 8:50. Register first, then the morning lesson. Break at 10:30, lunch at 12:15. Tidy-up song at 2:55.',
      emergency: 'Fire: leave by the back door and meet at the field gate; take the register. Lockdown: lock the door, blinds down, quiet corner. First aid kit hangs by the sink.',
      helpers: 'Maya and Sam K. know the routines. The teacher in Room 5 can help.', materials: 'Lesson books are in the blue tray. Spare pencils are in the jar on my desk. Reading books are on the back shelf.', notes: '' };
    s.conf[ids[0]] = { points: 'Celebrate her map work and her kindness to new classmates.\nTalk about building stamina for longer writing.', goals: '', date: L.addDays(todayIso, 5) };
    s.events = [
      { id: 'eone', date: L.addDays(todayIso, 9), title: 'Class trip: museum', kind: 'trip' },
      { id: 'etwo', date: L.addDays(todayIso, 20), title: 'Half term break', kind: 'holiday' },
      { id: 'ethree', date: L.addDays(todayIso, 33), title: 'Unit test', kind: 'test' }
    ];
    L.setAccom(s, B.id, ids[1], { tier: 'support', extraDays: 3, note: 'Sentence starters card on his desk.' });
    L.setAccom(s, B.id, ids[4], { tier: 'support', extraDays: 0, note: '' });
    L.setAccom(s, B.id, ids[2], { tier: 'extend', extraDays: 0, note: '' });
    L.saveGroupSet(s, 'Reading groups', todayIso, L.makeGroups(s, { method: 'mixed', size: 3, seed: 'demo' }));
    L.autoSeat(s, 'random', 'demo');
    return s;
  }
  SCH.demo = { build };
  if (typeof module !== 'undefined' && module.exports) module.exports = SCH.demo;
})(typeof window !== 'undefined' ? window : globalThis);
