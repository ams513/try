var SC = window.SC || (window.SC = {}); SC.data = SC.data || {};
/* Fill-in-the-blank networking messages and LinkedIn profile formulas. {blank} marks a field the user fills. */
SC.data.netTemplates = [
  { id: "outreach", name: "Cold outreach", use: "First message to someone at a company you want to join.", limit: 200, kind: "note",
    subject: "", body: "Hi {their_name}, I'm {your_name} ({your_role}). I've followed {company}'s work on {something_specific}. I'd value 15 minutes of your view on {topic}. Open to a quick chat?" },
  { id: "alumni", name: "Alumni or shared group", use: "Someone who went to your school or shares a group with you.", limit: 200, kind: "note",
    subject: "", body: "Hi {their_name}, fellow {shared_school_or_group} here. I'm exploring {field} and saw you work at {company}. Would you be open to a short chat about your path?" },
  { id: "info", name: "Informational interview", use: "Ask for a 15 to 20 minute conversation to learn, not to ask for a job.", limit: 0, kind: "email",
    subject: "Quick question about {topic} at {company}",
    body: "Hi {their_name},\n\nI'm {your_name} ({your_role}, {years} years in {field}). I'm looking at {target_role} roles and your work at {company} on {something_specific} stood out.\n\nWould you have 15 to 20 minutes in the next two weeks for a call? I'd like to ask three questions:\n1. {question_1}\n2. {question_2}\n3. What would you look for in someone joining your team?\n\nI know your time is valuable, so I'm happy to work around your schedule.\n\nThank you,\n{your_name}" },
  { id: "referral", name: "Referral request", use: "Someone you already know at the company. Make it easy to say yes.", limit: 0, kind: "email",
    subject: "Referral for the {target_role} role at {company}?",
    body: "Hi {their_name},\n\nI hope {personal_line}. I'm applying for the {target_role} role at {company} (posting: {posting_link_or_id}) and wondered if you'd be comfortable referring me.\n\nWhy I fit, in short:\n- {fit_point_1}\n- {fit_point_2}\n\nI've attached my resume and a three-line summary you can forward as is. If a referral isn't possible, no problem at all, and any advice on the team would still help.\n\nThanks so much,\n{your_name}" },
  { id: "thanks-info", name: "Thank-you after a chat", use: "Send within 24 hours of an informational interview.", limit: 0, kind: "email",
    subject: "Thank you, {their_name}",
    body: "Hi {their_name},\n\nThank you for the time today. Your point about {what_you_learned} was especially useful, and I'm going to {action_you_will_take}.\n\nI'll keep you posted on how it goes. If I can ever help with {how_you_can_help}, just ask.\n\nBest,\n{your_name}" },
  { id: "thanks-interview", name: "Thank-you after an interview", use: "Send the same day. One note per interviewer, each slightly different.", limit: 0, kind: "email",
    subject: "Thank you: {target_role} interview",
    body: "Hi {their_name},\n\nThank you for talking with me about the {target_role} role today. I enjoyed hearing about {topic_discussed}, and it made me more excited about the work.\n\nOur conversation reminded me of {relevant_result}, and I'd bring the same focus to {team_goal}.\n\nPlease let me know if I can share anything else. I look forward to the next step.\n\nBest regards,\n{your_name}" },
  { id: "follow-up", name: "Polite follow-up", use: "No reply after about a week. Short, friendly, one ask.", limit: 0, kind: "email",
    subject: "Following up: {topic}",
    body: "Hi {their_name},\n\nI wanted to follow up on my note from {when}. I'm still very interested in {topic}, and I know things get busy.\n\nIf now isn't a good time, I understand. Would {alternative_time} work better?\n\nThanks,\n{your_name}" },
  { id: "recruiter", name: "Recruiter introduction", use: "A recruiter who hires for your field.", limit: 200, kind: "note",
    subject: "", body: "Hi {their_name}, I'm {your_name}: {your_role}, {years} years in {field} ({one_result}). I'm looking for {target_role} roles in {location}. Could we connect?" }
];

SC.data.liHeadlines = [
  { id: "role-proof", name: "Role, specialty, proof", tpl: "{role} | {specialty} | {proof}", ex: "Operations Coordinator | Logistics and Inventory | Cut shipping errors 31%" },
  { id: "helping", name: "Who you help", tpl: "{role} helping {who} {outcome}", ex: "Operations Coordinator helping regional carriers ship on time, every time" },
  { id: "skills", name: "Role and top skills", tpl: "{role} | {skill_1} · {skill_2} · {skill_3}", ex: "Operations Coordinator | Excel · Scheduling · Process improvement" },
  { id: "next", name: "Current and next", tpl: "{role} at {company} | Open to {target_role} roles", ex: "Customer Service Lead at Northline | Open to Operations roles" }
];
SC.data.liAboutParts = [
  { id: "hook", label: "Hook: one line on what you do and for whom", ph: "I keep warehouses running without surprises." },
  { id: "story", label: "What you do and how (2 or 3 sentences)", ph: "For 6 years I've coordinated logistics and customer service..." },
  { id: "proof", label: "Proof: results with numbers, one per line", ph: "Cut shipping errors 31%\nTrained 14 new hires" },
  { id: "skills", label: "Skills line (the words recruiters search for)", ph: "Inventory control, Excel, Scheduling" },
  { id: "cta", label: "Call to action", ph: "Open to operations roles in Columbus. Message me here." }
];
SC.data.liChecklist = [
  "A clear, recent photo where your face fills most of the frame.",
  "A custom profile link (Settings, then Edit your public profile) using your name.",
  "Headline with the job title you want, not just \"Seeking opportunities\".",
  "Experience entries that match your resume dates and titles exactly.",
  "Top 5 skills match the postings you apply to.",
  "Two or three recommendations from managers or clients.",
  "\"Open to work\" set the way you want: visible to recruiters only, or to everyone."
];
