/* Stark Homeroom. A made-up sample family (first names only, every record marked as an example) so a parent can
   look around before entering their own children. Built from today's date; "Clear the sample family" on the Backup
   page removes it. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  /* opts.heavy: a year of records (about eleven months of register and hours, and 36 portfolio pieces a learner) for testing long printouts */
  function build(todayIso, opts) {
    const heavy = !!(opts && opts.heavy);
    const L = SHR.lib, s = L.emptyState(), D = n => L.addDays(todayIso, n);
    const y = +todayIso.slice(0, 4), m = +todayIso.slice(5, 7), y0 = m >= 7 ? y : y - 1, yr = y0 + '-' + String(y0 + 1).slice(-2), prev = (y0 - 1) + '-' + String(y0).slice(-2);
    s.demo = true;
    s.classroom = { name: 'Rivera Family Home School (example)', teacher: 'Elena Rivera (example)', termName: yr, termStart: D(heavy ? -330 : -95), termEnd: D(heavy ? 35 : 200), state: 'FL', address: '12 Example Lane, Tampa, FL (example address)' };
    s.goals = { days: 180, hours: 900 };
    L.addStudents(s, 'Maya', '10'); L.addStudents(s, 'Leo', '7'); L.addStudents(s, 'Ava', '3');
    const [maya, leo, ava] = s.students.map(x => x.id);
    L.setProfile(s, maya, { legalName: 'Maya Elena Rivera (example)', birth: (y0 - 15) + '-03-14', graduation: (y0 + 3) + '-05-31' });
    s.standards = [['WRITE.1', 'Organises writing with a clear claim, reasons and an ending'], ['WRITE.2', 'Uses evidence from sources'], ['MATH.G', 'Writes a clear geometric proof'], ['MATH.4', 'Describes and extends patterns'],
      ['HIST.1', 'Explains causes in history'], ['GEO.2', 'Uses maps to locate places']].map(x => ({ code: x[0], label: x[1] }));
    const C = (sid, title, subject, year, gradeLevel, level, credits, status, grade, description) => L.saveCourse(s, { sid, title, subject, year, gradeLevel, level, credits, status, grade, description });
    [['English 9: Literature and Composition', 'Writing and language arts', 'standard', 1, 'A', 'Close reading of short stories, poetry and two novels (To Kill a Mockingbird, The Odyssey in translation). Weekly analytical paragraphs, four full essays and one research paper with citations.'],
      ['Algebra 1', 'Mathematics', 'standard', 1, 'B+', 'Linear equations and inequalities, functions, systems, exponents, polynomials and quadratics, using a published algebra curriculum with weekly tests.'],
      ['Biology with Lab', 'Science', 'honors', 1, 'A-', 'Cells, genetics, evolution, ecology and human body systems. Twelve hands-on labs with written reports, including a microscope study of pond water.'],
      ['World History', 'Social studies and history', 'standard', 1, 'A', 'From the first civilizations to the twentieth century, with primary sources, a timeline project and a museum visit report.'],
      ['Spanish 1', 'Foreign language', 'standard', 1, 'B', 'Pronunciation, present tense, everyday vocabulary and short conversations with a weekly online tutor.'],
      ['Physical Education', 'Physical education', 'standard', 0.5, 'P', 'Swim team practice three times a week and a fitness log.'],
      ['Studio Art', 'Art', 'standard', 0.5, 'A', 'Drawing and watercolour fundamentals with a twelve-piece portfolio.']].forEach(x => C(maya, x[0], x[1], prev, '9', x[2], x[3], 'done', x[4], x[5]));
    const eng = C(maya, 'English 10: American Literature', 'Writing and language arts', yr, '10', 'standard', 1, 'progress', '', 'American novels, essays and poetry from the founding to today, with persuasive and research writing.');
    const geo = C(maya, 'Geometry', 'Mathematics', yr, '10', 'standard', 1, 'progress', '', 'Proof, congruence and similarity, right triangles, circles, area and volume, and coordinate geometry.');
    C(maya, 'Chemistry with Lab', 'Science', yr, '10', 'honors', 1, 'progress', '', 'Atomic structure, bonding, reactions, stoichiometry and solutions, with a home lab kit.');
    C(maya, 'U.S. History', 'Social studies and history', yr, '10', 'dual', 1, 'progress', '', 'Taken as a dual enrollment course at the local community college (example).');
    C(maya, 'Spanish 2', 'Foreign language', yr, '10', 'standard', 1, 'planned', '', '');
    const pre = C(leo, 'Pre-Algebra', 'Mathematics', yr, '7', 'standard', 1, 'progress', '', 'Integers, fractions, ratios, simple equations and an introduction to graphs.');
    const W = L.TEMPLATES[0].criteria;
    const A1 = L.newAssignment(s, { title: 'Persuasive essay: keep the town library', due: D(-12), weight: 2, courseId: eng.id, rubric: [{ text: 'Clear claim', std: 'WRITE.1', levels: W[0].levels }, { text: 'Reasons and evidence', std: 'WRITE.2', levels: W[0].levels }, { text: 'Organisation', std: 'WRITE.1', levels: W[1].levels }, { text: 'Conventions', levels: W[3].levels }], quill: { prompt: 'Should our town keep its library open seven days a week? Argue your side with evidence.', wordTarget: 700 } });
    const A2 = L.newAssignment(s, { title: 'Geometry: triangle proofs quiz', due: D(-5), weight: 1, courseId: geo.id, rubric: [{ text: 'Accuracy', max: 10 }, { text: 'Explains each step', std: 'MATH.G' }] });
    const A3 = L.newAssignment(s, { title: 'Fractions check', due: D(-3), weight: 1, courseId: pre.id, rubric: [{ text: 'Accuracy', max: 10 }, { text: 'Shows the working' }] });
    const A4 = L.newAssignment(s, { title: 'Lantern Row pattern lab', due: D(-8), weight: 1, for: [leo, ava], rubric: [{ text: 'Describes the pattern as repeat and step', std: 'MATH.4' }, { text: 'Builds a new pattern', std: 'MATH.4' }], world: ['loops'] });
    const A5 = L.newAssignment(s, { title: 'Early civilizations unit', due: D(-20), weight: 1, for: [leo, ava], rubric: [{ text: 'Explains why cities grew by rivers', std: 'HIST.1' }, { text: 'Finds places on the map', std: 'GEO.2' }], intra: ['35-river-civilizations', '35-greece-and-rome'] });
    L.newAssignment(s, { title: 'Nature journal: four seasons', due: D(12), weight: 1, for: [ava], rubric: [{ text: 'Careful drawings' }, { text: 'Labels and notes' }] });
    const grade = (a, sid, scores, comment) => { (s.grades[a.id] = s.grades[a.id] || {})[sid] = { scores, comment }; };
    grade(A1, maya, { c1: 4, c2: 3, c3: 4, c4: 3 }, 'A strong, fair argument. Add one more source next time.');
    grade(A2, maya, { c1: 8, c2: 3 }, 'Good proofs; label every reason.');
    grade(A3, leo, { c1: 7, c2: 3 }, 'Unlike denominators still need practice.');
    grade(A4, leo, { c1: 4, c2: 3 }, 'Clever new pattern.'); grade(A4, ava, { c1: 3, c2: 3 }, 'You found the step!');
    grade(A5, leo, { c1: 3, c2: 4 }, 'Great map work.'); grade(A5, ava, { c1: 3, c2: 2 }, 'Lovely drawing of the Nile.');
    const qa = L.quillFor(A1, s.classroom.teacher);
    L.applyImport(s, [{ sid: maya, ev: L.quillEvidence({ info: { student: 'Maya', book_title: 'Keep the library open', words: 742, word_target: 700, assignment: { title: A1.title, id: qa.id, due: A1.due }, rubric: { done: 4, total: 4, criteria: [] }, reflection_words: 31, created: D(-12) }, reflection: 'My best paragraph is the one about the homework club. Next time I will interview the librarian.' }) }], D(-12));
    [[leo, 'Cities by the rivers; Ancient Greece and Rome', 88], [ava, 'Cities by the rivers', 74]].forEach(x => {
      L.applyImport(s, [{ sid: x[0], ev: L.parseIntraCSV('Student,Stars,Moments explored,Lessons completed,Lesson titles,Average best quiz %,Geography: capitals (kids) best %\r\nx,' + (x[2] > 80 ? 18 : 11) + ',24,' + x[1].split(';').length + ',' + x[1] + ',' + x[2] + ',' + x[2] + '\r\n').records[0].ev }], D(-20));
    });
    const r = L.parseWorldReflection('Reflection: Lantern Run\nStudent: Leo\nDate: ' + D(-8) + '\nLesson: Loops and patterns: Lantern Row\nGoal: x\n\nAbout the game (counted from the saved game):\n  Levels: 1   Objects: 22   Quests: 1   Custom items: 1\n  Checker: no problems found\n\n1. What did you build?\n   A row of lamps that light up in twos.\n2. What was hardest, and how did you solve it?\n   Counting the step.\n3. What would you change next?\n   Add a gate.\n\nFree write: (none)\n');
    L.applyImport(s, [{ sid: leo, ev: r.records[0].ev }], D(-8));
    /* the register and the hours log: weekdays back from today to the start of the year */
    const plan = {
      [maya]: [['Writing and language arts', 60, eng.id, 'American Literature: The Great Gatsby, chapters'], ['Mathematics', 55, geo.id, 'Geometry lesson and problem set'], ['Science', 60, '', 'Chemistry reading and lab notes'], ['Social studies and history', 50, '', 'U.S. History reading'], ['Foreign language', 30, '', 'Spanish practice']],
      [leo]: [['Reading', 40, '', 'Read-aloud with Ava, then his own book'], ['Mathematics', 45, pre.id, 'Pre-Algebra lesson'], ['Science', 35, '', 'Weather and climate unit'], ['Social studies and history', 35, '', 'Ancient civilizations']],
      [ava]: [['Reading', 40, '', 'Read-aloud with Leo, then phonics practice'], ['Mathematics', 30, '', 'Place value and adding'], ['Writing and language arts', 25, '', 'Copywork and a short story']]
    };
    const extra = { 1: [[maya, 'Physical education', 60, 'Swim team'], [ava, 'Physical education', 30, 'Park run']], 3: [[maya, 'Physical education', 60, 'Swim team'], [leo, 'Music', 30, 'Piano lesson']], 5: [[maya, 'Art', 45, 'Watercolour study'], [leo, 'Art', 40, 'Watercolour leaves'], [ava, 'Art', 40, 'Watercolour leaves'], [ava, 'Science', 45, 'Nature walk and journal']] };
    let d = D(-1), n = 0;
    while (d >= s.classroom.termStart) {
      const wd = new Date(d + 'T00:00:00Z').getUTCDay();
      if (wd && wd < 6) {
        const marks = {};
        if (n % 23 === 7) marks[ava] = 'A'; if (n % 17 === 4) { marks[maya] = 'T'; marks[leo] = 'T'; marks[ava] = 'T'; } if (n % 19 === 11) marks[leo] = 'H';
        L.takeRegister(s, d, marks);
        [maya, leo, ava].forEach(sid => {
          if (marks[sid] === 'A' || marks[sid] === 'T') return;
          plan[sid].forEach((p, k) => { const mins = Math.max(15, p[1] + ((n + k) % 3) * 5 - 5) * (marks[sid] === 'H' ? 0.5 : 1); L.logHours(s, { sids: [sid], date: d, subject: p[0], minutes: Math.round(mins), courseId: p[2], note: k === 0 && n % 4 === 0 ? p[3] : '' }); });
          (extra[wd] || []).filter(x => x[0] === sid).forEach(x => L.logHours(s, { sids: [sid], date: d, subject: x[1], minutes: x[2], note: x[3] }));
        });
        if (marks[maya] === 'T') L.logHours(s, { sids: [maya, leo, ava], date: d, subject: 'Science', minutes: 150, note: 'Field trip: science museum (example)' });
        n++;
      }
      d = L.addDays(d, -1);
    }
    /* lessons and units for this week */
    const mon = L.weekStart(todayIso);
    L.addUnit(s, { title: 'Ancient civilizations', start: D(-42), end: D(-8), goal: 'Explain why the first cities grew beside rivers and what they gave the world.', standards: ['HIST.1', 'GEO.2'] });
    const U = L.addUnit(s, { title: 'Chemistry: reactions', start: L.addDays(mon, -7), end: L.addDays(mon, 18), goal: 'Balance equations and predict the products of simple reactions.', standards: [] });
    [[0, 'Read-aloud: The Wild Robot, chapter 12', [leo, ava], 'Retell the chapter in order.', 'Read, then draw the scene.', 'The Wild Robot', ''],
      [0, 'Balancing equations', [maya], 'Balance six equations and explain why mass is conserved.', 'Worked examples, then the problem set.', 'Lab kit, workbook', 'Finish the problem set.', U.id],
      [1, 'Fractions on a number line', [leo], 'Place fractions with unlike denominators on a line.', 'Fraction strips, then the number line game.', 'Fraction strips', ''],
      [2, 'Nature walk and journal', [leo, ava], 'Observe and sketch three plants.', 'Walk the creek path, sketch, label at home.', 'Journals, pencils', ''],
      [3, 'Persuasive essay: revise and polish', [maya], 'Strengthen the counter-argument paragraph.', 'Read the essay aloud, mark weak spots, revise in Quill.', 'Laptop', ''],
      [4, 'Watercolour leaves', [], 'Mix greens and browns from three colours.', 'Demonstration, then everyone paints.', 'Paints, brushes, leaves from the walk', '']].forEach(x => {
      L.addPlan(s, { date: L.addDays(mon, x[0]), title: x[1], who: x[2], objective: x[3], activities: x[4], materials: x[5], homework: x[6], unitId: x[7] || '' });
    });
    /* portfolio pieces (notes only in the sample; your own can carry photos, scans and PDFs) */
    [[maya, D(-12), 'Persuasive essay: keep the town library', 'Writing and language arts', eng.id, 'Her strongest argument so far, written and revised in Stark Quill. 742 words.', 'Quill: ' + A1.title],
      [maya, (y0) + '-04-18', 'Biology lab report: osmosis in potato cells', 'Science', '', 'Designed the trial herself and graphed the results. (Example piece.)', ''],
      [leo, D(-8), 'Lantern Row pattern lab', 'Mathematics', '', 'Built a lamp pattern that steps by two, in Stark World Engine.', 'World Engine: Loops and patterns: Lantern Row'],
      [leo, D(-26), 'Map of river civilizations', 'Social studies and history', '', 'Hand-drawn map of the Nile, Tigris, Euphrates, Indus and Yellow rivers. (Example piece.)', ''],
      [ava, D(-6), 'Nature journal: autumn leaves', 'Science', '', 'Three sketches with labels, from the creek walk. (Example piece.)', ''],
      [ava, D(-15), 'Story: The Brave Snail', 'Writing and language arts', '', 'Her first story with a beginning, middle and end. (Example piece.)', '']].forEach(x => {
      L.addPortfolioItem(s, { sid: x[0], date: x[1], title: x[2], subject: x[3], courseId: x[4], note: x[5], from: x[6] });
    });
    if (heavy) {
      const subj = ['Reading', 'Writing and language arts', 'Mathematics', 'Science', 'Social studies and history', 'Art', 'Music', 'Physical education'], what = ['Project', 'Lab write-up', 'Drawing', 'Story', 'Model', 'Report', 'Timeline', 'Recital notes'];
      const more = ' The note runs long on purpose, so a printout shows how a piece with several lines of writing stays together on its page. (Example piece.)';
      [maya, leo, ava].forEach((sid, si) => { for (let i = 0; i < 36; i++) L.addPortfolioItem(s, { sid, date: D(-(6 + i * 9 + si * 2)), title: what[(i + si) % what.length] + ' ' + (i + 1) + ': ' + ['maps', 'rivers', 'fractions', 'leaves', 'planets', 'poems', 'machines', 'seeds'][(i * 3 + si) % 8], subject: subj[(i + si) % subj.length], note: i % 4 === 0 ? '' : 'A short note about piece ' + (i + 1) + '.' + (i % 3 === 0 ? more + more : '') }); });
    }
    L.addNote(s, { sid: maya, date: D(-3), kind: 'positive', text: 'Planned her whole chemistry week on her own and kept to it. (Example note.)' });
    L.addNote(s, { sid: leo, date: D(-2), kind: 'concern', text: 'Fractions with unlike denominators still feel hard; try the pizza model again. (Example note.)' });
    L.addNote(s, { sid: ava, date: D(-1), kind: 'note', text: 'Asked to read to Leo tonight. (Example note.)' });
    s.events = [{ id: 'eone', date: D(9), title: 'Library day (example)', kind: 'other' }, { id: 'etwo', date: D(20), title: 'Family holiday (example)', kind: 'holiday' }, { id: 'ethree', date: D(33), title: 'Science museum trip (example)', kind: 'trip' }];
    return s;
  }
  SHR.demo = { build };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHR.demo;
})(typeof window !== 'undefined' ? window : globalThis);
