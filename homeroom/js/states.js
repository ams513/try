/* Stark Homeroom. "State requirements": information only, for the five US states with the most homeschooling
   families. Every line names the official page it was read from and the date it was checked. Homeroom never opens
   these links itself; a parent can open one in their own browser. */
(function (root) {
  'use strict';
  const SHR = root.SHR = root.SHR || {};
  const CHECKED = '2026-11-20';
  const CA33190 = 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EDC&sectionNum=33190';
  const CA48222 = 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EDC&sectionNum=48222';
  const CA48224 = 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EDC&sectionNum=48224';
  const TX = 'https://tea.texas.gov/taxonomy/finding-school-your-child';
  const NY = 'https://www.nysed.gov/nonpublic-schools/home-instruction';
  const NYQA = 'https://www.nysed.gov/nonpublic-schools/home-instruction-questions-and-answers';
  const AZ = 'https://www.azleg.gov/ars/15/00802.htm';
  const FL = 'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=1000-1099/1002/Sections/1002.41.html';
  const L = (text, url, quote, tool) => ({ text, url, quote, checked: CHECKED, tool: tool || '' });
  SHR.states = {
    checked: CHECKED,
    label: 'Information only; check your state\'s current rules',
    ranking: {
      text: 'The five states are ranked by the U.S. Census Bureau\'s Household Pulse Survey (August 20 to September 16, 2024, Education Table 1), the only federal estimate for every state. Its figures count adults in households that reported homeschooled children. They are survey estimates, not registrations, and the Census Bureau marks them as experimental.',
      url: 'https://www.census.gov/data/tables/2024/demo/hhp/cycle09.html', checked: CHECKED
    },
    list: [
      { code: 'CA', name: 'California', estimate: 547561, lines: [
        L('One legal option is a private full-time day school taught by persons capable of teaching (Education Code 48222).', CA48222, 'Children who are being instructed in a private full-time day school by persons capable of teaching shall be exempted.'),
        L('A private school files an affidavit with the Superintendent of Public Instruction each year; the law sets the window as October 1 to 15.', CA33190, 'shall between the first and 15th day of October of each year ... file with the Superintendent of Public Instruction an affidavit or statement'),
        L('Teaching is in English and covers the branches of study required in California public schools.', CA48222, 'be taught in the English language and shall offer instruction in the several branches of study required to be taught in the public schools of the state', 'lessons'),
        L('Keep an attendance register that shows every absence of a half day or more.', CA48222, 'the record of attendance shall indicate clearly every absence of the pupil from school for a half day or more', 'attendance'),
        L('The affidavit states that the school keeps its courses of study and a record of each teacher\'s educational qualifications.', CA33190, 'The courses of study offered by the institution. ... a record of the educational qualifications of each.', 'courses'),
        L('Another option is a private tutor with a valid state credential for the grade taught: at least 3 hours a day, 175 days a year, between 8 a.m. and 4 p.m.', CA48224, 'at least three hours a day for 175 days each calendar year by a private tutor ... The tutor or other person shall hold a valid state credential for the grade taught.'),
        L('Filing is not approval: the district\'s check of the affidavit is not an evaluation or endorsement of the school.', CA48222, 'shall not be construed as an evaluation, recognition, approval, or endorsement of any private school or course.')] },
      { code: 'TX', name: 'Texas', estimate: 440666, lines: [
        L('The Texas Education Agency does not register, approve or accredit home schools.', TX, 'The TEA does not regulate, index, monitor, approve, register, or accredit the programs available to parents who choose to home school.'),
        L('Since the 1994 Leeper v. Arlington ISD ruling, home schools can operate as private schools in Texas.', TX, 'home schools can legally operate as private schools in Texas.'),
        L('Teach in a bona fide manner from a written curriculum covering reading, spelling, grammar, math and good citizenship.', TX, 'home schools must be conducted in a bona fide manner, using a written curriculum consisting of reading, spelling, grammar, math, and a course in good citizenship.', 'lessons'),
        L('A school district may ask the parents in writing for a letter of assurance that the child is being home schooled.', TX, 'may request in writing a letter of assurance from the parents that the student is being home schooled.'),
        L('Texas does not award diplomas to home-schooled students.', TX, 'The State of Texas does not award a diploma to students that are home schooled.', 'transcript'),
        L('Texas colleges must judge home school graduates by the same general standards as public high school graduates.', TX, 'an institution of higher education in Texas must treat a home school graduate to the same general standards ... as other applicants for undergraduate admission who have graduated from a public high school.', 'transcript'),
        L('A public school may assess courses taken at home to decide grade placement, credit or both.', TX, 'The results of the assessment may be used for grade placement or award of credit or both.', 'courses')] },
      { code: 'NY', name: 'New York', estimate: 220990, lines: [
        L('Send a written notice of intent to the school district superintendent.', NY, 'Parents who wish to home school their children must provide written notice of intent to the school district superintendent.'),
        L('The district replies with the regulations and an individualized home instruction plan (IHIP) form for you to complete.', NY, 'provide a copy of the home instruction regulations as well as an individualized home instruction plan (IHIP) form to complete.', 'lessons'),
        L('Quarterly reports record the total hours of instruction; hours per subject are recommended in the secondary grades.', NYQA, 'The total number of hours of instruction per quarter must be documented on the quarterly report. It is recommended that, in the secondary grades, hours per subject be included in each quarterly report.', 'hours'),
        L('Parents must keep attendance records for each student.', NYQA, 'Parents are required to keep attendance records for each student', 'attendance'),
        L('An annual assessment is required. With an achievement test, a composite score below the 33rd percentile, or less than a year\'s growth, can lead to probation.', NYQA, 'the program will be placed on probation only if the composite score of the student is below the thirty-third percentile on national norms or the score fails to reflect one academic year of growth', 'reports'),
        L('A student taught at home cannot be awarded a local or Regents diploma.', NYQA, 'May a student instructed at home be awarded a local or Regents diploma? No.', 'transcript')] },
      { code: 'AZ', name: 'Arizona', estimate: 188402, lines: [
        L('File an affidavit of intent with the county school superintendent within 30 days of starting homeschool.', AZ, 'An affidavit of intent shall be filed within thirty days from the time the child begins to attend a private school or homeschool'),
        L('The affidavit gives the child\'s name and date of birth, the school\'s address, and the custodians\' names, phone numbers and addresses.', AZ, '(a) The child\'s name. (b) The child\'s date of birth. (c) The current address of the school the child is attending. (d) The names, telephone numbers and addresses of the persons who currently have custody of the child.'),
        L('Children aged 6 to 16 are taught at least reading, grammar, mathematics, social studies and science.', AZ, 'shall be provided instruction in at least the subjects of reading, grammar, mathematics, social studies and science.', 'hours'),
        L('A homeschool is conducted mainly by the parent, guardian or other person who has custody of the child.', AZ, '"Homeschool" means a nonpublic school conducted primarily by the parent, guardian or other person who has custody of the child'),
        L('Tell the county school superintendent within 30 days if homeschooling ends, and file a new affidavit within 30 days if it starts again.', AZ, 'shall notify the county school superintendent within thirty days of the termination ... shall file another affidavit of intent with the county school superintendent within thirty days.'),
        L('If a child is under 8 on September 1, a parent may file an affidavit saying home instruction will start when the child turns 8.', AZ, 'the child has not reached eight years of age by September 1 of the school year and the person who has custody of the child does not desire to begin home instruction until the child has reached eight years of age')] },
      { code: 'FL', name: 'Florida', estimate: 168581, lines: [
        L('Notify the district school superintendent in writing within 30 days of starting. The signed notice lists each child\'s full legal name, address and birthdate.', FL, 'The notice must be in writing, signed by the parent, and include the full legal names, addresses, and birthdates of all children ... within 30 days of the establishment of the home education program.'),
        L('The parent does not need a Florida teaching certificate.', FL, 'The parent is not required to hold a valid regular Florida teaching certificate.'),
        L('Keep a portfolio: a log of activities written at the time, naming reading materials by title, plus samples of the learner\'s work.', FL, 'A log of educational activities that is made contemporaneously with the instruction and that designates by title any reading materials used. 2. Samples of any writings, worksheets, workbooks, or creative materials used or developed by the student.', 'portfolio'),
        L('Keep the portfolio for 2 years; the superintendent may ask to inspect it with 15 days\' written notice.', FL, 'preserve it for 2 years, and make it available for inspection, if requested, by the district school superintendent ... upon 15 days\' written notice.', 'portfolio'),
        L('Each year, file an educational evaluation using one of five methods the parent chooses, such as a certified teacher\'s review or a nationally normed test.', FL, 'The parent shall provide for an annual educational evaluation ... The parent shall select the method of evaluation and shall file a copy of the evaluation annually', 'reports'),
        L('When the program ends, file a written notice of termination, with the annual evaluation, within 30 days.', FL, 'The parent shall file a written notice of termination upon completion of the home education program with the district school superintendent, along with the annual evaluation'),
        L('A home education program does not have to meet the requirements of a school day.', FL, 'A home education program shall be excluded from meeting the requirements of a school day.', 'attendance')] }
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHR.states;
})(typeof window !== 'undefined' ? window : globalThis);
