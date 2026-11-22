/* Stark Warden: brand, shortener and domain lists for the link inspector and message checker.
   Brands list the REAL domains only. Anything else wearing the name is a warning sign. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  SW.data = SW.data || {};

  function B(name, kind, label, domains, tokens) {
    return { name: name, kind: kind, label: label, domains: domains, tokens: tokens || [label] };
  }

  SW.data.brands = [
    B('PayPal', 'payment', 'paypal', ['paypal.com', 'paypal.me', 'paypalobjects.com']),
    B('Venmo', 'payment', 'venmo', ['venmo.com']),
    B('Zelle', 'payment', 'zellepay', ['zellepay.com', 'zelle.com'], ['zellepay', 'zelle']),
    B('Cash App', 'payment', 'cashapp', ['cash.app', 'square.com', 'squareup.com'], ['cashapp']),
    B('Coinbase', 'crypto', 'coinbase', ['coinbase.com']),
    B('Binance', 'crypto', 'binance', ['binance.com', 'binance.us']),
    B('Chase', 'bank', 'chase', ['chase.com', 'jpmorgan.com', 'jpmorganchase.com']),
    B('Wells Fargo', 'bank', 'wellsfargo', ['wellsfargo.com', 'wf.com'], ['wellsfargo']),
    B('Bank of America', 'bank', 'bankofamerica', ['bankofamerica.com', 'bofa.com', 'ml.com'], ['bankofamerica', 'bofa']),
    B('Citibank', 'bank', 'citibank', ['citi.com', 'citibank.com', 'citibankonline.com'], ['citibank', 'citi']),
    B('Capital One', 'bank', 'capitalone', ['capitalone.com', 'capitalone360.com'], ['capitalone']),
    B('U.S. Bank', 'bank', 'usbank', ['usbank.com'], ['usbank']),
    B('Truist', 'bank', 'truist', ['truist.com']),
    B('PNC', 'bank', 'pnc', ['pnc.com'], ['pnc']),
    B('TD Bank', 'bank', 'tdbank', ['td.com', 'tdbank.com'], ['tdbank']),
    B('Regions', 'bank', 'regions', ['regions.com']),
    B('USAA', 'bank', 'usaa', ['usaa.com'], ['usaa']),
    B('Navy Federal', 'bank', 'navyfederal', ['navyfederal.org'], ['navyfederal']),
    B('American Express', 'bank', 'americanexpress', ['americanexpress.com', 'aexp.com', 'amex.com'], ['americanexpress', 'amex']),
    B('Discover', 'bank', 'discover', ['discover.com', 'discovercard.com']),
    B('USPS', 'delivery', 'usps', ['usps.com', 'uspis.gov'], ['usps']),
    B('UPS', 'delivery', 'ups', ['ups.com'], ['ups']),
    B('FedEx', 'delivery', 'fedex', ['fedex.com']),
    B('DHL', 'delivery', 'dhl', ['dhl.com', 'dhl.de'], ['dhl']),
    B('Amazon', 'retail', 'amazon', ['amazon.com', 'amzn.to', 'amzn.com', 'a.co', 'amazon.ca', 'amazon.co.uk', 'amazon.de', 'amazonaws.com']),
    B('Walmart', 'retail', 'walmart', ['walmart.com']),
    B('Target', 'retail', 'target', ['target.com']),
    B('Best Buy', 'retail', 'bestbuy', ['bestbuy.com'], ['bestbuy']),
    B('Costco', 'retail', 'costco', ['costco.com']),
    B('eBay', 'retail', 'ebay', ['ebay.com']),
    B('Apple', 'tech', 'apple', ['apple.com', 'icloud.com']),
    B('Microsoft', 'tech', 'microsoft', ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'microsoftonline.com', 'windows.com']),
    B('Google', 'tech', 'google', ['google.com', 'gmail.com', 'goo.gl', 'youtube.com', 'youtu.be', 'googleusercontent.com'], ['google', 'gmail']),
    B('Facebook', 'tech', 'facebook', ['facebook.com', 'fb.com', 'meta.com', 'messenger.com'], ['facebook']),
    B('Instagram', 'tech', 'instagram', ['instagram.com']),
    B('WhatsApp', 'tech', 'whatsapp', ['whatsapp.com', 'whatsapp.net']),
    B('LinkedIn', 'tech', 'linkedin', ['linkedin.com', 'lnkd.in']),
    B('Netflix', 'tech', 'netflix', ['netflix.com']),
    B('Spotify', 'tech', 'spotify', ['spotify.com']),
    B('Dropbox', 'tech', 'dropbox', ['dropbox.com']),
    B('DocuSign', 'tech', 'docusign', ['docusign.com', 'docusign.net']),
    B('Adobe', 'tech', 'adobe', ['adobe.com']),
    B('Norton', 'tech', 'norton', ['norton.com', 'nortonlifelock.com', 'gen.digital']),
    B('McAfee', 'tech', 'mcafee', ['mcafee.com']),
    B('Geek Squad', 'tech', 'geeksquad', ['geeksquad.com', 'bestbuy.com'], ['geeksquad']),
    B('AT&T', 'telecom', 'att', ['att.com', 'att.net'], ['att']),
    B('Verizon', 'telecom', 'verizon', ['verizon.com', 'verizonwireless.com']),
    B('T-Mobile', 'telecom', 'tmobile', ['t-mobile.com', 'tmobile.com'], ['tmobile']),
    B('Xfinity', 'telecom', 'xfinity', ['xfinity.com', 'comcast.com', 'comcast.net']),
    B('IRS', 'gov', 'irs', ['irs.gov'], ['irs']),
    B('Social Security Administration', 'gov', 'ssa', ['ssa.gov'], ['ssa']),
    B('Medicare', 'gov', 'medicare', ['medicare.gov', 'cms.gov']),
    B('USA.gov', 'gov', 'usagov', ['usa.gov', 'login.gov'], ['usagov'])
  ];

  /* How each organisation is named inside a message (used to notice a claimed brand). */
  SW.data.brandNames = {
    'PayPal': /\bpay ?pal\b/i, 'Venmo': /\bvenmo\b/i, 'Zelle': /\bzelle\b/i, 'Coinbase': /\bcoinbase\b/i, 'Binance': /\bbinance\b/i,
    'Chase': /\bchase\b/i, 'Wells Fargo': /\bwells ?fargo\b/i, 'Bank of America': /\bbank of america\b|\bBoA\b/, 'Citibank': /\bciti(?:bank)?\b/i,
    'Capital One': /\bcapital ?one\b/i, 'U.S. Bank': /\bu\.?s\.? bank\b/i, 'Truist': /\btruist\b/i, 'PNC': /\bPNC\b/, 'TD Bank': /\btd bank\b/i,
    'USAA': /\busaa\b/i, 'Navy Federal': /\bnavy federal\b/i, 'American Express': /\bamerican express\b|\bamex\b/i, 'Discover': /\bdiscover (?:card|bank)\b/i,
    'USPS': /\busps\b|\bpostal service\b|\bpost office\b/i, 'UPS': /\bUPS\b/, 'FedEx': /\bfedex\b/i, 'DHL': /\bdhl\b/i,
    'Amazon': /\bamazon\b/i, 'Walmart': /\bwalmart\b/i, 'Target': /\btarget (?:order|account|gift|circle)\b/i, 'Best Buy': /\bbest ?buy\b/i,
    'Costco': /\bcostco\b/i, 'eBay': /\bebay\b/i, 'Apple': /\bapple(?: id| support| icloud|care)\b/i, 'Microsoft': /\bmicrosoft\b/i,
    'Google': /\bgoogle\b/i, 'Facebook': /\bfacebook\b|\bmeta (?:support|security)\b/i, 'Instagram': /\binstagram\b/i, 'WhatsApp': /\bwhatsapp\b/i,
    'LinkedIn': /\blinkedin\b/i, 'Netflix': /\bnetflix\b/i, 'Spotify': /\bspotify\b/i, 'Dropbox': /\bdropbox\b/i, 'DocuSign': /\bdocusign\b/i,
    'Adobe': /\badobe\b/i, 'Norton': /\bnorton\b/i, 'McAfee': /\bmcafee\b/i, 'Geek Squad': /\bgeek ?squad\b/i, 'AT&T': /\bAT&T\b/,
    'Verizon': /\bverizon\b/i, 'T-Mobile': /\bt-?mobile\b/i, 'Xfinity': /\bxfinity\b|\bcomcast\b/i,
    'IRS': /\birs\b|\binternal revenue service\b/i, 'Social Security Administration': /\bsocial security (?:administration|office)\b|\bSSA\b/,
    'Medicare': /\bmedicare\b/i
  };

  /* Real services, but the destination is hidden, so they are still flagged (lightly). */
  SW.data.shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'tiny.cc', 'rb.gy',
    't.ly', 's.id', 'bit.do', 'v.gd', 'lnkd.in', 'goo.gl', 'adf.ly', 'shorte.st', 'clck.ru', 'qr.ae', 'trib.al', 'soo.gd', 'urlz.fr', 'x.co', 'amzn.to'];

  SW.data.riskyTlds = ['zip', 'mov', 'top', 'xyz', 'click', 'icu', 'cfd', 'sbs', 'rest', 'gq', 'tk', 'ml', 'cf', 'ga', 'work', 'buzz', 'monster',
    'support', 'country', 'kim', 'loan', 'men', 'date', 'download', 'stream', 'bid', 'win', 'vip', 'cyou', 'quest', 'lol'];

  SW.data.twoLevelSuffixes = ['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'co.in', 'co.za', 'com.br',
    'com.mx', 'com.cn', 'com.tr', 'com.ar', 'co.kr', 'com.sg', 'com.hk', 'com.ng', 'com.ph', 'com.pk', 'co.id', 'com.my'];

  /* Hosts where anyone can publish a page under their own name: the registrable part is one label further left. */
  SW.data.freeHosts = ['github.io', 'herokuapp.com', 'blogspot.com', 'web.app', 'firebaseapp.com', 'pages.dev', 'netlify.app', 'vercel.app',
    'weebly.com', 'wixsite.com', 'webflow.io', 'glitch.me', 'repl.co', 'onrender.com', 'workers.dev', 'azurewebsites.net', 'cloudfront.net',
    'myshopify.com', 'wordpress.com', 'carrd.co', 'square.site', 'godaddysites.com', 'ngrok.io', 'trycloudflare.com'];

  SW.data.freeMail = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'proton.me', 'protonmail.com', 'mail.com',
    'gmx.com', 'yandex.com', 'zoho.com', 'live.com', 'msn.com', 'me.com', 'qq.com', '163.com'];

  /* Characters that look like Latin letters (Cyrillic, Greek, a few others). */
  SW.data.confusables = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j',
    'ѕ': 's', 'ԁ': 'd', 'һ': 'h', 'в': 'b', 'н': 'h', 'к': 'k', 'м': 'm', 'т': 't', 'ѵ': 'v',
    'ԛ': 'q', 'ԝ': 'w', 'ɡ': 'g', 'ο': 'o', 'α': 'a', 'ν': 'v', 'ρ': 'p', 'ι': 'i', 'κ': 'k',
    'υ': 'u', 'ı': 'i', 'ɩ': 'i', 'ǀ': 'l', 'ӏ': 'l', 'ⅼ': 'l', 'ⅰ': 'i', 'ᴀ': 'a', 'ɢ': 'g',
    'ᴏ': 'o', 'ᴄ': 'c', 'ｏ': 'o', 'ａ': 'a', 'ｅ': 'e'
  };
})(typeof window !== 'undefined' ? window : globalThis);
