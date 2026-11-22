/* Stark Warden: practice quiz. Each item is a sample message, whether it is a scam, and why. All names, numbers and addresses are made up. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  SW.data = SW.data || {};
  function Q(id, text, scam, why, tells) { return { id: id, text: text, scam: scam, why: why, tells: tells || [] }; }

  SW.data.quiz = [
    Q('q1', 'USPS: Your package could not be delivered because the address is incomplete. Confirm your address within 12 hours: https://usps-redelivery.top/track', true,
      'The link is not usps.com, and the message pushes you to act within hours. USPS does not send links like this for missed deliveries.', ['Look-alike link', 'Urgent deadline', 'Delivery excuse']),
    Q('q2', 'Your verification code is 482915. It expires in 10 minutes. Do not share this code with anyone.', false,
      'This is the normal shape of a one-time code you asked for. It tells you not to share it. It would be a scam only if you did not request it, or if someone asked you to read it to them.', ['Tells you not to share', 'No link', 'No request for money']),
    Q('q3', 'This is Officer Daniels from the Social Security Administration. Your number has been used in a crime. Do not tell anyone. Call us at once or a warrant will be issued.', true,
      'Social Security does not threaten arrest by phone and does not tell you to keep it secret. Secrecy and threats are classic scam tools.', ['Threat of arrest', 'Asked to keep it secret', 'Urgent']),
    Q('q4', 'Hi, this is Dana at Maple Dental. Your cleaning is booked for Monday at 9 am. Reply C to confirm or call the office to change it.', false,
      'It names a real appointment, asks for nothing sensitive, and has no link or payment request. If you are not a patient of that office, ignore it, but nothing here asks for money.', ['Specific appointment', 'No link', 'No payment ask']),
    Q('q5', 'You have won a $500 gift card! To claim, buy two $100 gift cards to cover shipping and send us the numbers on the back.', true,
      'You never pay to collect a prize, and no real business takes gift card numbers as payment.', ['Prize you did not enter', 'Gift cards', 'Pay to receive']),
    Q('q6', 'Chase: Did you attempt a $42.18 purchase at Shell on 6/3? Reply Y or N. We will never ask for your password or full card number.', false,
      'This asks a yes/no question and offers no link, and it says what it will not ask. If you are unsure, open your own banking app instead of replying.', ['No link', 'No request for secrets', 'Simple yes or no']),
    Q('q7', 'Grandma, it is me, I was in a car accident and they arrested me. Please do not tell Mom. I need $3,000 for bail, can you send gift cards?', true,
      'Panic, secrecy and gift cards. Hang up and call your grandchild on a number you already have. Police do not take bail in gift cards.', ['Secrecy', 'Gift cards', 'Emergency pressure']),
    Q('q8', 'We are hiring remote assistants. Earn $400 a day, no experience needed. Message us on WhatsApp to start today.', true,
      'Unrequested offers with high pay, no experience and a chat-app interview are a common scam, often used to collect your ID or move stolen money.', ['Too-good pay', 'Chat-app interview', 'Unrequested']),
    Q('q9', 'Your library book Dune is due Friday. Renew it online at your library’s website, or bring it back.', false,
      'A routine reminder: no link, no money, no pressure.', ['No link', 'No payment', 'Routine']),
    Q('q10', 'MICROSOFT ALERT: Your computer is infected! Do not shut down. Call 1-888-555-0188 now for a free repair.', true,
      'Real warnings from Microsoft do not give you a phone number. This is a tech-support scam; calling puts you with a scammer who will ask for remote access.', ['Scary alert', 'Phone number to call', 'Pressure']),
    Q('q11', 'Final notice: you owe $1,247 on a payday loan. Pay today by gift card or we will notify the sheriff and file charges. We cannot mail anything.', true,
      'A real collector must send a written validation notice, cannot threaten arrest over a consumer debt, and will not demand gift cards.', ['Arrest threat', 'Gift cards', 'Refuses writing']),
    Q('q12', 'The IRS will never call or text to demand immediate payment. Learn about tax scams at irs.gov/newsroom/tax-scams-consumer-alerts', false,
      'This is a warning about scams, and the web address is the real irs.gov. It does not ask you to do anything risky.', ['Real irs.gov address', 'Educational', 'No demand']),
    Q('q13', 'Your Netflix payment was declined. Update your billing information within 24 hours or your account will be closed: netflix-billing-update.com', true,
      'The domain is not netflix.com. Look-alike domains with hyphens and words like “billing” are used to steal logins and card numbers.', ['Look-alike domain', 'Deadline', 'Account closure threat']),
    Q('q14', 'A stranger texts you: “Wrong number? Oh sorry. You seem nice though.” A week later they suggest a crypto trading platform that has “guaranteed” returns.', true,
      'This is the pig-butchering pattern: a friendly stranger, then a guaranteed-return crypto platform. Never invest on a new contact’s advice.', ['Wrong-number opening', 'Guaranteed returns', 'Crypto platform']),
    Q('q15', 'Amazon: Your order of a desk lamp has shipped and arrives Thursday. Track it in the Amazon app or at amazon.com/orders.', false,
      'It is about an order, uses the real amazon.com, and does not ask you to pay or log in through a link. If you did not order a lamp, open the Amazon app yourself to check.', ['Real domain', 'No payment ask', 'Specific item']),
    Q('q16', 'Sir, we overcharged you $300 by mistake. To return it, install AnyDesk so our agent can fix your account. Then please send back the difference by gift card.', true,
      'Remote-access tools and “send back the difference” are the refund scam. They take control of your device and your money.', ['Remote access', 'Refund trick', 'Gift cards'])
  ];
})(typeof window !== 'undefined' ? window : globalThis);
