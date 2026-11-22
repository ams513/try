/* Stark Warden: phone-number pattern hints and QR-code text checker. Hints only: caller ID can be faked. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  var U = SW.util;

  /* Caribbean and other North American Numbering Plan area codes that look like US numbers but are international calls. */
  var CARIBBEAN = ['242', '246', '264', '268', '284', '345', '441', '473', '649', '664', '721', '758', '767', '784', '809', '829', '849', '868', '869', '876'];
  var TOLLFREE = ['800', '833', '844', '855', '866', '877', '888'];

  function format(d) { return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : d; }

  function analyzePhone(raw, opts) {
    opts = opts || {};
    var s = String(raw || '').trim(), intl = /^\+(?!1\b)/.test(s) && !/^\+1[\s\-.(]?\d/.test(s) || /^00/.test(s), flags = [], notes = [], score = 0, d = s.replace(/\D/g, ''), mine = String(opts.mine || '').replace(/\D/g, ''), area, ex;
    function add(id, title, why, w) { flags.push({ id: id, title: title, why: why, weight: w }); score += w; }
    if (!d) { return { empty: true, flags: flags, notes: notes, score: 0, level: U.levelFor(0) }; }
    if (/@/.test(s)) { notes.push('Texts from an email address can come from anywhere. Real companies usually text from a short code or a number.'); }
    if (intl) {
      add('intl', 'International number', 'The number starts with a country code other than +1. Callback scams often use numbers abroad. If you did not expect a call from another country, do not call back.', 2);
      return { digits: d, formatted: s, flags: flags, notes: notes.concat(['Caller ID can be faked, so even a familiar number is not proof.']), score: score, level: U.levelFor(score) };
    }
    if (d.length === 11 && d.charAt(0) === '1') { d = d.slice(1); }
    if (d.length < 7 && d.length >= 3) {
      notes.push('A 3 to 6 digit number is a short code. Real companies use these for texts. You can ask your carrier or check the company’s official site before replying to anything.');
      return { digits: d, formatted: d, flags: flags, notes: notes, score: 0, level: U.levelFor(0) };
    }
    if (d.length !== 10) {
      add('length', 'Not a normal 10-digit US number', 'US numbers have 10 digits. Odd lengths can mean a fake, an error, or a number from another country.', 2);
      return { digits: d, formatted: s, flags: flags, notes: notes, score: score, level: U.levelFor(score) };
    }
    area = d.slice(0, 3); ex = d.slice(3, 6);
    if (/^[01]/.test(area) || /^[01]/.test(ex)) { add('invalid', 'Cannot be a real number', 'US area codes and exchanges never start with 0 or 1. A caller ID showing this was made up.', 3); }
    if (ex === '555' && /^01\d\d$/.test(d.slice(6))) { add('fiction', 'Reserved for movies and fiction', '555-0100 to 555-0199 are reserved as fictional numbers. They should never be a real caller.', 3); }
    if (CARIBBEAN.indexOf(area) >= 0) { add('caribbean', 'Looks like a US number but is a Caribbean area code', 'Area code ' + area + ' is outside the US but dials like it. “One ring and hang up” and prize scams use these to run up charges. Do not call back.', 3); }
    if (area === '900') { add('premium', '900 premium-rate number', 'Calls to 900 numbers can be billed to you per minute.', 4); }
    if (TOLLFREE.indexOf(area) >= 0) { notes.push('Toll-free numbers (' + area + ') are used by real companies and by scammers. Do not trust a number just because it is toll-free; call the number on the company’s official site.'); }
    if (mine && mine.length >= 10) {
      mine = mine.slice(-10);
      if (mine === d) { add('own', 'Same as your own number', 'A call that appears to come from your own number is faked (“spoofed”).', 3); }
      else if (mine.slice(0, 6) === d.slice(0, 6)) { add('neighbor', 'Matches the start of your own number', '“Neighbor spoofing” copies your area code and the next three digits so you pick up. Many real local calls look like this too, so judge by what is asked.', 2); }
    }
    if (/(\d)\1{5,}/.test(d) || /0123456|1234567|2345678|3456789|9876543/.test(d)) { add('pattern', 'Repeating or sequential digits', 'Numbers made of repeating or counting digits are often placeholders or fakes.', 2); }
    notes.push('Caller ID can be faked, so a normal-looking number proves nothing and a strange one does not prove a scam. Judge by what is being asked: money, codes, urgency.');
    return { digits: d, formatted: format(d), flags: flags, notes: notes, score: score, level: U.levelFor(score), areaCode: area };
  }

  function analyzeQR(text) {
    var s = String(text || '').trim(), flags = [], notes = [], score = 0, kind = 'text', link = null, low = s.toLowerCase(), i, extra;
    function add(id, title, why, w) { flags.push({ id: id, title: title, why: why, weight: w }); score += w; }
    if (!s) { return { empty: true, flags: flags, notes: notes, score: 0, level: U.levelFor(0), kind: 'empty' }; }
    if (/^javascript:/i.test(s)) { kind = 'script'; add('script', 'Runs code', 'This is not a web address; it would run a script. Do not open it.', 6); }
    else if (/^wifi:/i.test(s)) { kind = 'wifi'; add('wifi', 'Joins a Wi-Fi network', 'Scanning would connect your phone to a network chosen by whoever made the code. Only join networks you trust.', 2); }
    else if (/^(?:tel|sms|smsto|mms|mmsto):/i.test(s)) { kind = 'phone'; add('phone', 'Starts a call or text', 'This would dial or message a number. Check the number before sending anything.', 2); }
    else if (/^mailto:/i.test(s)) { kind = 'email'; add('mail', 'Starts an email', 'This would write an email to the address inside the code.', 1); }
    else if (/^(?:bitcoin|ethereum|litecoin|monero|solana):/i.test(s)) { kind = 'crypto'; add('crypto', 'Crypto payment request', 'This sends money to a wallet. Crypto payments cannot be reversed. Never pay a stranger or a “refund” this way.', 4); }
    else if (/^(?:upi|paytmmp|phonepe):\/\//i.test(s)) { kind = 'payment'; add('pay', 'Payment request', 'This starts a payment. Make sure you know who you are paying and why.', 3); }
    else if (/^(?:intent|market):\/\//i.test(s)) { kind = 'app'; add('app', 'Opens or installs an app', 'This can push an app install. Install only from your phone’s official store.', 4); }
    else if (/^begin:vcard/i.test(s)) { kind = 'contact'; add('vcard', 'Adds a contact card', 'A contact card can pose as a trusted name. Check it before saving.', 1); }
    else {
      kind = 'link';
      link = SW.links.inspect(s);
      link.flags.forEach(function (f) { flags.push(f); score += f.weight; });
      if (link.official) { notes.push(link.notes[0]); }
    }
    notes.push('Scammers stick fake QR codes over real ones on parking meters, menus and posters. If a QR code asks you to log in, pay or install something, go to the company’s site yourself instead.');
    return { kind: kind, flags: flags, notes: notes, score: score, level: U.levelFor(score), link: link };
  }

  SW.phone = { analyzePhone: analyzePhone, analyzeQR: analyzeQR };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SW.phone; }
})(typeof window !== 'undefined' ? window : globalThis);
