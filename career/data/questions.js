var SC = window.SC || (window.SC = {}); SC.data = SC.data || {};
/* Interview bank. Type codes: B behavioral (use STAR), S situational (say what you would do and why), M motivation and fit, K role knowledge. */
SC.data.qtypes = { B: "Behavioral", S: "Situational", M: "Motivation", K: "Role knowledge" };
SC.data.qtips = {
  B: "Use STAR: Situation, Task, Action, Result. Spend half your time on the Action and finish with a number.",
  S: "Walk through your steps in order, name who you would involve, and say how you would check it worked.",
  M: "Be specific to this employer and role. Tie what they need to something you have actually done.",
  K: "Define it simply, give one real example from your work, and say what you would do when you hit its limits."
};
SC.data.roles = [
  { id: "general", name: "General and all roles", q: [
    "M|Tell me about yourself.", "M|Why do you want this job?", "M|Why do you want to work for our company?", "M|What are your greatest strengths?",
    "M|What is a weakness you are working on, and what have you done about it?", "M|Where do you see yourself in five years?", "M|Why are you leaving your current job?",
    "M|What are your salary expectations?", "B|Tell me about a time you failed. What did you learn?", "B|Describe a time you disagreed with a coworker. How did you handle it?",
    "B|Tell me about your proudest accomplishment at work.", "B|Describe a time you had to learn something quickly.", "S|How do you prioritize when everything is urgent?",
    "S|What would you do in your first 30 days here?", "M|What kind of manager brings out your best work?", "M|Do you have any questions for us?"] },
  { id: "tech", name: "Software and IT", q: [
    "K|Explain a technical concept you know well to someone who is not technical.", "B|Describe the hardest bug you ever fixed. How did you find it?", "K|How do you decide when code is good enough to ship?",
    "K|What does a good code review look like?", "B|Tell me about a project where the requirements changed halfway through.", "S|A production system goes down at 2 a.m. What do you do first?",
    "K|How do you keep a codebase maintainable as it grows?", "K|Explain the difference between a process and a thread.", "K|How would you design a simple URL shortener?",
    "B|Tell me about a time you improved performance. What did you measure?", "K|How do you approach testing: unit, integration and end to end?", "B|Describe a time you disagreed with a technical decision.",
    "S|A teammate keeps merging code without tests. What do you do?", "K|What happens between typing a web address and seeing the page?", "M|How do you keep your skills current?", "B|Tell me about a time you had to estimate a project. How accurate were you?"] },
  { id: "customer", name: "Customer service and support", q: [
    "B|Tell me about a time you turned an angry customer around.", "S|A customer demands a refund you are not allowed to give. What do you say?", "B|Describe a time you went beyond what the job required for a customer.",
    "K|What does great customer service mean to you?", "S|You do not know the answer to a customer's question. What do you do?", "B|Tell me about a time you had to say no to a customer.",
    "S|Three customers are waiting and the phone is ringing. How do you decide who is next?", "B|Describe a mistake you made with a customer and how you fixed it.", "M|How do you stay calm after a difficult call?",
    "K|How do you measure whether you are doing well in a support role?", "S|A customer uses abusive language. What do you do?", "B|Tell me about a time you worked with another team to solve a customer's problem.",
    "K|How do you write an email that a frustrated customer will read to the end?", "M|Why do you want to work in customer service?", "S|You spot the same complaint five times in a week. What do you do about it?", "B|Describe how you handled a high-volume day."] },
  { id: "sales", name: "Sales and business development", q: [
    "B|Tell me about the biggest deal you closed. How did you do it?", "S|A prospect says your price is too high. What do you say?", "K|Walk me through your sales process from first contact to close.",
    "B|Describe a time you missed your quota. What changed afterwards?", "K|How do you qualify a lead?", "S|A prospect has gone silent after a great demo. What is your next step?",
    "B|Tell me about a time you lost a deal you thought you would win.", "M|What motivates you besides commission?", "K|How do you research a prospect before a first call?",
    "S|A customer asks for a feature you do not have. How do you respond?", "B|Tell me about a time you built a relationship over many months.", "K|How do you handle objections? Give me an example.",
    "B|Describe a time you worked with marketing or product to win a customer.", "K|Which sales numbers do you track every week?", "S|You are asked to sell something you do not believe in. What do you do?", "M|Why this industry and this product?"] },
  { id: "management", name: "Management and leadership", q: [
    "M|How would your team describe your leadership style?", "B|Tell me about a time you had to deliver difficult feedback.", "B|Describe how you handled an underperforming employee.",
    "S|Two of your best people are in conflict. What do you do?", "B|Tell me about a time you led a team through change.", "K|How do you set goals and hold a team accountable?",
    "S|You inherit a team with low morale. What are your first steps?", "B|Describe a decision you made with incomplete information.", "K|How do you delegate, and how do you decide what not to delegate?",
    "B|Tell me about a time you developed someone who later got promoted.", "S|Your boss gives you a deadline your team cannot meet. What do you do?", "K|How do you run a useful meeting?",
    "B|Describe a time you had to cut costs or resources.", "K|How do you hire? What do you look for?", "M|What is the hardest part of managing people for you?", "B|Tell me about a time you made a mistake as a leader."] },
  { id: "healthcare", name: "Healthcare and caregiving", q: [
    "B|Tell me about a time you cared for a difficult or frightened patient.", "S|Two patients need you at the same moment. How do you decide?", "B|Describe a time you caught a mistake before it reached a patient.",
    "K|How do you protect patient privacy in a busy unit?", "S|A family member is angry about their relative's care. What do you do?", "B|Tell me about a time you worked as part of a care team under pressure.",
    "M|Why did you choose healthcare?", "K|How do you stay safe and avoid burnout on long shifts?", "S|A coworker is not following a safety protocol. What do you do?",
    "B|Describe a time you had to deliver bad news with compassion.", "K|How do you document care so the next shift can pick it up?", "S|You make a medication or charting error. What are your next steps?",
    "B|Tell me about a time you advocated for a patient.", "K|How do you handle infection control in your daily work?", "M|How do you handle emotionally hard days?", "B|Describe how you adapted to a new system or protocol."] },
  { id: "trades", name: "Trades, operations and warehouse", q: [
    "K|What safety rules do you never skip, and why?", "B|Tell me about a time you spotted a hazard and what you did.", "S|You are told to cut a corner that could be unsafe. What do you do?",
    "B|Describe a job where you had to meet a tight deadline.", "K|How do you check your own work before calling it finished?", "S|The equipment you rely on breaks mid-shift. What is your plan?",
    "B|Tell me about a time you trained someone new.", "K|What tools or machines are you certified or experienced on?", "B|Describe a time you improved how a task was done.",
    "S|Two supervisors give you conflicting instructions. What do you do?", "K|How do you read a blueprint, work order or pick list accurately?", "B|Tell me about a time you worked a physically demanding schedule.",
    "M|Why do you want to work in this trade?", "K|How do you keep inventory or materials counts accurate?", "S|You finish your tasks early. What do you do?", "B|Describe a time you had to troubleshoot a problem with no manual."] },
  { id: "creative", name: "Marketing, design and content", q: [
    "B|Walk me through a project from brief to finished piece.", "K|How do you measure whether a campaign worked?", "S|A client dislikes your work and cannot say why. What do you do?",
    "B|Tell me about a time you had to work to a very tight brief or budget.", "K|Which tools do you use daily and which are you learning?", "B|Describe a time you used data to change a creative decision.",
    "S|Your idea is rejected by the team. How do you respond?", "K|How do you adapt a message for different audiences or channels?", "B|Tell me about the work you are proudest of and why.",
    "M|Where do you find inspiration?", "S|You have three deadlines this week and one is a client emergency. How do you manage?", "K|How do you keep a brand voice consistent across a team?",
    "B|Describe a time you gave or received harsh creative feedback.", "K|What makes a headline or an opening line work?", "B|Tell me about a project that did not perform. What did you learn?", "M|Which of our campaigns or products do you admire, and what would you change?"] },
  { id: "finance", name: "Finance, admin and office", q: [
    "B|Tell me about a time you found an error in a report or spreadsheet.", "K|How do you make sure numbers are accurate before you send them?", "S|You are asked to bend a policy for a senior person. What do you do?",
    "B|Describe a time you managed several deadlines at once.", "K|Which spreadsheet or accounting tools do you use, and how well?", "B|Tell me about a time you improved a process or saved money.",
    "S|A vendor invoice does not match the purchase order. What do you do?", "K|How do you handle confidential information?", "B|Describe how you handled a very busy month-end or deadline period.",
    "S|You realize you made an error that has already gone out. What next?", "K|How do you organize your day as an assistant or coordinator?", "B|Tell me about a time you supported an executive or a team under pressure.",
    "M|Why finance or administration as a career?", "K|How do you keep up with changes in regulations or procedures?", "S|Two people ask you for urgent work at the same time. What do you do?", "B|Describe a time you learned new software quickly."] },
  { id: "entry", name: "Entry level and students", q: [
    "M|Tell me about yourself and what you are looking for in a first job.", "B|Describe a group project where someone was not pulling their weight.", "B|Tell me about a time you balanced school with work or other commitments.",
    "M|Why should we hire you with little work experience?", "B|Describe a time you showed leadership in a club, team or class.", "B|Tell me about a time you made a mistake and what you changed afterwards.",
    "S|You are given a task you have never done before. How do you start?", "M|What is the most useful thing you learned in school or training?", "M|What are you hoping to learn in your first year here?",
    "B|Tell me about a time you worked with someone very different from you.", "S|Your supervisor is busy and you are stuck. What do you do?", "B|Describe a time you met a deadline under pressure.",
    "M|What do you do outside school or work that taught you a skill?", "B|Tell me about a time you took initiative without being asked.", "S|You arrive and realize you misunderstood the task. What now?", "M|What would your teachers or past supervisors say about you?"] },
  { id: "education", name: "Teaching and training", q: [
    "B|Tell me about a lesson that did not go as planned.", "K|How do you set up a classroom or session so people stay engaged?", "S|A learner is disruptive and distracts others. What do you do?",
    "B|Describe a time you helped a struggling learner succeed.", "K|How do you check understanding during a lesson?", "S|A parent or manager disagrees with how you teach. What do you do?",
    "K|How do you adapt a lesson for mixed levels?", "B|Tell me about a time you used data to change how you taught.", "M|Why teaching or training?",
    "K|How do you plan a unit or course from a goal backwards?", "S|Half the group did not do the preparation. What now?", "B|Describe a time you worked with colleagues to improve a course.",
    "K|How do you handle assessment and feedback fairly?", "S|A learner discloses something worrying. What is your next step?", "B|Tell me about a time you learned from a learner.", "M|How do you manage workload outside teaching hours?"] },
  { id: "hospitality", name: "Hospitality, food service and retail", q: [
    "B|Tell me about a time you turned an unhappy guest or customer into a happy one.", "B|Describe a shift where you were short-staffed. What did you do?",
    "S|A customer says their order is wrong during the busiest hour. Walk me through what you do.", "S|You see a coworker skip a food safety or hygiene step. How do you handle it?",
    "K|How do you keep food or stock safe from contamination and spoilage?", "K|How do you handle cash, refunds and end-of-shift counts accurately?",
    "M|What does great hospitality mean to you?", "B|Tell me about a time you recommended something a customer ended up loving.",
    "S|A regular asks for a discount you are not allowed to give. What do you say?", "B|Describe a time you kept your section or station organized under pressure.",
    "M|Why do you want to work at this store, hotel or restaurant in particular?", "S|A customer is rude to a newer team member. How do you step in?"] },
  { id: "engineering", name: "Engineering and manufacturing", q: [
    "B|Tell me about a design or process you improved. How did you measure the result?", "B|Describe a time a test or inspection failed. What did you do next?",
    "K|How do you approach root cause analysis on a defect that keeps coming back?", "K|How do you decide on tolerances or safety factors for a part or system?",
    "S|Production is behind schedule and a supplier part is out of spec. What do you do?", "B|Tell me about a time you explained a technical trade-off to someone who is not an engineer.",
    "K|What steps do you follow before a change goes into production?", "S|You find a safety issue in a design that has already shipped. Walk me through your response.",
    "B|Describe a project where you worked closely with suppliers, operators or quality staff.", "K|Which design, simulation or analysis tools have you used, and for what?",
    "M|What kind of engineering problems do you enjoy most, and why?", "B|Tell me about a time you reduced cost, scrap or downtime."] },
  { id: "data", name: "Data and analytics", q: [
    "B|Tell me about an analysis that changed a decision. What was the outcome?", "K|How do you check a dataset for quality problems before you use it?",
    "K|Explain the difference between correlation and causation with an example from your work.", "S|A stakeholder wants a number by tomorrow, but the data is incomplete. What do you do?",
    "K|How would you design an A/B test, and how do you decide it has run long enough?", "B|Describe a dashboard or report you built. Who used it, and how?",
    "S|Two teams report different numbers for the same metric. How do you resolve it?", "K|Walk me through a query that finds the top customers by revenue each month.",
    "B|Tell me about a time you presented findings that people did not want to hear.", "K|How do you handle missing values and outliers?",
    "M|What kind of questions do you most like answering with data?", "S|How would you explain a model's limits to a manager who wants a simple yes or no?"] },
  { id: "legal", name: "Legal, compliance and government", q: [
    "B|Tell me about a time you caught an error in a document before it caused a problem.", "K|How do you keep track of deadlines and filings across many cases or files?",
    "S|A senior colleague asks you to skip a compliance step to save time. What do you do?", "K|How do you keep confidential information secure in your daily work?",
    "B|Describe a time you explained a rule or policy to someone who disagreed with it.", "K|How do you research a question when the rules are unclear or have recently changed?",
    "B|Tell me about a time you handled a heavy caseload or backlog.", "S|A member of the public is angry about a decision you have to enforce. How do you respond?",
    "M|Why do you want to work in public service, law or compliance?", "K|How do you make sure your writing is precise and hard to misread?",
    "B|Describe a time you had to stay neutral between two parties.", "S|You find an old mistake that may affect a closed case or file. What do you do?"] },
  { id: "science", name: "Science and research", q: [
    "B|Tell me about an experiment that did not work. What did you learn and change?", "K|How do you design a study or experiment so the results can be trusted?",
    "K|How do you document your work so someone else could reproduce it?", "S|Your results contradict a senior colleague's hypothesis. How do you handle it?",
    "B|Describe a time you learned a new technique or instrument quickly.", "K|Which statistical methods do you use most, and when would you choose each one?",
    "B|Tell me about a time you managed several projects or sample batches with tight deadlines.", "S|You suspect a measurement was recorded wrongly weeks ago. What do you do?",
    "M|What research question would you most like to work on here, and why?", "B|Describe how you explained your research to an audience of non-specialists.",
    "K|How do you keep a lab or field site safe and compliant?", "B|Tell me about a grant, paper or report you contributed to. What was your part?"] },
  { id: "nonprofit", name: "Nonprofit and community work", q: [
    "M|Why does our mission matter to you personally?", "B|Tell me about a time you achieved a lot with a small budget.",
    "B|Describe a time you worked with volunteers. How did you keep them engaged?", "S|A major donor asks for something that does not fit the mission. What do you do?",
    "K|How do you measure whether a program is actually working?", "B|Tell me about a time you built trust with a community you were new to.",
    "S|Two partner organizations want the same limited resources. How do you decide?", "K|What goes into a strong grant application or funding report?",
    "B|Describe a time you had to say no to someone you were trying to help.", "M|How do you avoid burnout in work that matters to you?",
    "S|An event you organized gets half the expected turnout. What do you do on the day and afterwards?", "B|Tell me about a time you used a story and numbers together to win support."] }
];
