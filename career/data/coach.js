var SC = window.SC || (window.SC = {}); SC.data = SC.data || {};
/* Bullet power-ups: weak words with stronger alternatives, verb families for template rewrites, quantify prompts. */
SC.data.weakAlts = {
  "responsible for": ["led", "owned", "managed", "ran"],
  "duties included": ["led", "delivered", "ran"],
  "tasked with": ["led", "delivered", "built"],
  "in charge of": ["led", "directed", "oversaw"],
  "helped with": ["supported", "enabled", "contributed to"],
  "helped": ["supported", "enabled", "partnered with"],
  "assisted with": ["supported", "co-led", "contributed to"],
  "assisted in": ["supported", "contributed to"],
  "assisted": ["supported", "enabled"],
  "worked on": ["built", "delivered", "developed"],
  "worked with": ["partnered with", "collaborated with"],
  "participated in": ["contributed to", "co-led", "delivered"],
  "involved in": ["contributed to", "drove", "delivered"],
  "handled": ["resolved", "processed", "managed"],
  "exposed to": ["used", "applied"],
  "familiar with": ["used", "applied"],
  "utilized": ["used"],
  "utilize": ["use"],
  "made": ["created", "built", "produced"],
  "did": ["completed", "delivered", "performed"],
  "got": ["earned", "won", "secured"],
  "tried to": ["tested", "piloted"],
  "various": ["name 2 or 3 specific ones"],
  "several": ["give the number"],
  "many": ["give the number"],
  "numerous": ["give the number"],
  "a lot of": ["give the number"],
  "lots of": ["give the number"],
  "etc": ["finish the list or cut it"],
  "stuff": ["name the thing"],
  "things": ["name the thing"],
  "successfully": ["cut it: the result shows the success"],
  "effectively": ["cut it, or show the effect with a number"],
  "very": ["cut it"],
  "really": ["cut it"],
  "basically": ["cut it"],
  "team player": ["show it: \"Partnered with 4 teams to...\""],
  "hard worker": ["show it: \"Covered 30 extra shifts during peak season\""],
  "detail-oriented": ["show it: \"Cut order errors by 31%\""],
  "results-driven": ["show the result instead"],
  "go-getter": ["show what you started"],
  "synergy": ["say what worked together and what it produced"],
  "think outside the box": ["say what you did differently"]
};

/* Families: a topic pattern, strong verbs (all in SC.data.verbs), a scale phrase and a result phrase with [placeholders]. */
SC.data.verbFamilies = [
  { id: "customer", re: "customer|client|caller|calls?|tickets?|complaints?|patients?|guests?|shoppers?|members?", verbs: ["resolved", "managed", "supported"], scale: "[N] customers a day", result: "keeping satisfaction at [X%]" },
  { id: "money", re: "cost|budget|spend|saving|expense|vendor|price|waste|overtime", verbs: ["managed", "cut", "renegotiated"], scale: "a [$N] budget", result: "saving [$N] a year" },
  { id: "sales", re: "sales|revenue|deals?|accounts?|quota|leads?|pipeline|upsell|renewals?", verbs: ["grew", "managed", "closed"], scale: "[N] accounts", result: "growing revenue [X%] in [period]" },
  { id: "process", re: "process|workflow|system|procedure|efficien|checklist|policy|backlog", verbs: ["streamlined", "redesigned", "automated"], scale: "[N] tasks a week", result: "cutting [time or errors] by [X%]" },
  { id: "people", re: "train|onboard|new hires?|mentor|coach|teach|students?|interns?", verbs: ["trained", "led", "mentored"], scale: "[N] people", result: "cutting ramp-up time from [before] to [after]" },
  { id: "team", re: "team|staff|crew|volunteers?|shift|department|employees", verbs: ["led", "managed", "coordinated"], scale: "a team of [N]", result: "hitting [goal] for [N] straight months" },
  { id: "data", re: "reports?|data|analysis|dashboards?|metrics?|spreadsheets?|forecasts?|audits?", verbs: ["built", "analyzed", "automated"], scale: "[N] data sources", result: "giving leaders [what decision] [N days] sooner" },
  { id: "build", re: "software|app|website|code|features?|tools?|api|database|platform|bugs?", verbs: ["built", "launched", "improved"], scale: "[N] users", result: "cutting [load time or defects] by [X%]" },
  { id: "plan", re: "schedule|events?|projects?|deadlines?|launch|campaigns?|orders?|shipments?|inventory", verbs: ["coordinated", "planned", "delivered"], scale: "[N] projects", result: "finishing [N days] ahead of schedule" }
];
SC.data.verbFallback = { id: "general", verbs: ["delivered", "improved", "led"], scale: "[N] (people, items or projects)", result: "improving [what] by [X%]" };

SC.data.quantify = [
  { re: "customer|client|call|ticket|patient|guest", q: "How many customers, calls or tickets a day or week? What satisfaction score?" },
  { re: "cost|budget|sav|spend|money|price|expense", q: "How much money: the budget size, or dollars saved?" },
  { re: "sales|revenue|deal|account|quota|grew|growth", q: "How much growth: percent, dollars or new accounts?" },
  { re: "train|onboard|mentor|coach|teach|lead|led|team|staff|manag", q: "How many people did you lead, train or support?" },
  { re: "process|faster|time|speed|deadline|schedul|turnaround", q: "How fast: what took how long before, and how long after?" },
  { re: "error|mistake|complaint|defect|return|quality|accura", q: "By what percent did errors, complaints or returns fall?" },
  { re: "report|order|shipment|item|project|event|case", q: "How many: orders, reports, projects or events per week or month?" }
];
SC.data.quantifyGeneric = ["How many? (people, items, customers, projects)", "How much? (money, percent, size)", "How fast? (before and after, or how often)"];

/* Parser help: words that usually mark a job title. */
SC.data.titleWords = ("manager|coordinator|engineer|analyst|specialist|representative|assistant|associate|director|lead|developer|designer|nurse|teacher|tutor|intern|consultant|officer|technician|supervisor|administrator|clerk|cashier|agent|advisor|adviser|accountant|architect|scientist|writer|editor|owner|founder|president|vice president|vp|head|chef|cook|driver|operator|mechanic|electrician|carpenter|plumber|welder|server|bartender|barista|receptionist|secretary|planner|buyer|recruiter|trainer|instructor|professor|researcher|therapist|aide|caregiver|pharmacist|paralegal|attorney|lawyer|programmer|tester|support|sales|marketer|strategist|producer|photographer|artist|volunteer|crew|member|worker|handler|associate|executive|controller|auditor|bookkeeper|teller|dispatcher|foreman|superintendent|apprentice|fellow|ambassador|principal|partner|officer|steward|attendant").split("|");

/* Mock interview rubric (0 no, 1 partly, 2 yes) and the drill for each weak spot. */
SC.data.rubric = [
  { id: "structure", name: "Structure", q: "Clear start, middle and end? STAR for stories, steps in order for situations." },
  { id: "specific", name: "Specific example", q: "A real, named example rather than \"I usually\" or \"I would\"?" },
  { id: "result", name: "Result", q: "Ended on an outcome, ideally with a number?" },
  { id: "concise", name: "Concise", q: "Finished inside the time without rambling or repeating?" },
  { id: "delivery", name: "Delivery", q: "Steady pace, few filler words, confident last line?" }
];
SC.data.drills = {
  structure: "Story skeleton drill: for 3 questions, say one sentence each for Situation, Task, Action and Result before you answer in full.",
  specific: "Story bank drill: write 6 stories (a success, a failure, a conflict, leading, a deadline, learning fast) with names, dates and places.",
  result: "Number drill: for each story, write the result as a number (percent, money, time, count). If you have none, say what changed and for whom.",
  concise: "60-second drill: answer 5 questions with the timer set to 1:00. Cut the Situation to one sentence.",
  delivery: "Pause drill: record 3 answers, replay them and count filler words. Replace each \"um\" with a one-second pause, then end on your result and stop."
};
