/* Stark Trades 2.1. Field mode for phones (daily sheet, time, punch list, pickups, daily log),
   the encrypted office/field handoff, share and backup, settings and honest limits. */
(function () {
  'use strict';
  const C = window.StarkCore, L = window.L, h = L.h, S = window.StarkStore, t = C.t, tn = C.tn, tt = C.tt, N = C.N;
  const T = () => C.today();
  const allPhotoIds = () => { const ids = []; L.st.jobs.forEach(j => { j.photos.forEach(p => ids.push(p.id)); j.punch.forEach(p => { if (p.photoId) ids.push(p.photoId); }); j.logs.forEach(l => l.photoIds.forEach(id => ids.push(id))); }); L.st.backcharges.forEach(b => b.photoIds.forEach(id => ids.push(id))); return Array.from(new Set(ids)); };
  L.allPhotoIds = allPhotoIds;

  /* ---------------- field mode ---------------- */
  let fieldDate = null;
  L.routes.field = function (jobId) {
    const st = L.st, d = fieldDate || T(), sheet = C.dailySheet(st, d), active = st.jobs.filter(j => ['scheduled', 'progress', 'inspection'].indexOf(j.stage) >= 0);
    const pickJob = jobId && C.job(st, jobId) ? C.job(st, jobId) : (sheet[0] && sheet[0].job) || active[0];
    const chips = h('div', { class: 'chips', id: 'field-jobs' }, active.map(j => h('a', { class: 'jchip' + (pickJob && j.id === pickJob.id ? ' on' : '') + (sheet.some(x => x.job.id === j.id) ? ' today' : ''), href: '#/field/' + j.id }, j.num)));
    const dateIn = L.date(d, { id: 'field-date', 'aria-label': t('Date'), onchange: e => { fieldDate = e.target.value || null; L.render(); } });
    if (!pickJob) return h('div', { class: 'stack field' }, h('h1', null, t('Field')), L.empty(t('No active jobs. Import a handoff file from the office, or schedule a job.'), t('Open jobs'), () => L.go('#/jobs')), handoffCard());
    const j = pickJob, today = j.tasks.filter(k => C.isDate(k.start) && k.start <= d && k.end >= d && k.status !== 'done'), next = j.tasks.filter(k => C.isDate(k.start) && k.start > d && k.status !== 'done').sort((a, b) => a.start < b.start ? -1 : 1).slice(0, 3);
    const crewIds = Array.from(new Set(today.filter(k => k.who && k.who.t === 'crew').map(k => k.who.id).concat(st.timeLog.filter(x => x.jobId === j.id && x.date === d).map(x => x.crewId)))), crew = (crewIds.length ? crewIds.map(id => C.crewM(st, id)).filter(Boolean) : st.crew.filter(c => c.active !== false));
    const timeRows = crew.map((c, ci) => { const es = st.timeLog.filter(x => x.crewId === c.id && x.jobId === j.id && x.date === d), last = es[es.length - 1], hrs = es.reduce((a, x) => a + C.hoursOf(x.clockIn, x.clockOut), 0), tm = L.input({ type: 'time', value: L.now(), class: 'short', 'aria-label': t('Time') });
      return h('div', { class: 'trow' }, h('div', { class: 'grow' }, h('b', null, c.name), h('div', { class: 'fine' }, es.map(x => (x.clockIn || '?') + '–' + (x.clockOut || '…')).join(', ') || t('not clocked in'), hrs ? ' · ' + t('{h} h', { h: C.fmtHrs(hrs) }) : '')),
        tm, h('button', { class: 'btn sm' + (!last || last.clockOut ? (ci ? ' next' : ' primary') : ''), type: 'button', 'data-in': c.id, onclick: () => clock(c.id, 'in', tm.value) }, t('In')), h('button', { class: 'btn sm' + (last && !last.clockOut ? (ci ? ' next' : ' primary') : ''), type: 'button', 'data-out': c.id, onclick: () => clock(c.id, 'out', tm.value) }, t('Out')));
    });
    function clock(cid, kind, tm) { try { C.clock(st, cid, j.id, d, kind, tm); L.commit(); } catch (e) { L.toast(e.message, true); } }
    const punchFile = h('input', { type: 'file', accept: 'image/*', capture: 'environment', id: 'punch-photo', class: 'sr-only' }), punchText = L.input({ id: 'punch-text', placeholder: t('What needs doing?'), 'aria-label': t('Punch list item') });
    const pickItem = L.input({ id: 'pick-item', placeholder: t('Item'), 'aria-label': t('Item') }), pickQty = L.input({ id: 'pick-qty', placeholder: t('Qty'), class: 'short', inputmode: 'decimal', 'aria-label': t('Quantity') }), pickSup = L.input({ id: 'pick-sup', placeholder: t('Supplier'), 'aria-label': t('Supplier') });
    const logText = L.area('', { id: 'log-text', rows: 3, placeholder: t('What got done, problems, visitors, deliveries'), 'aria-label': t('Daily log') }), weather = L.select([['', t('Weather')], ['Clear', t('Clear')], ['Cloudy', t('Cloudy')], ['Rain', t('Rain')], ['Hot', t('Hot')], ['Cold', t('Cold')], ['Wind', t('Wind')]], '', { id: 'log-weather', 'aria-label': t('Weather') }), logFile = h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, id: 'log-photo', class: 'sr-only' });
    const by = (crew[0] || {}).name || '';
    const guarded = fn => async () => { try { await fn(); L.commit(); } catch (e) { L.toast(e.message, true); } };
    return h('div', { class: 'stack field' },
      h('div', { class: 'row' }, h('h1', { class: 'grow' }, t('Field')), dateIn), chips,
      h('section', { class: 'card sheet', id: 'daily-sheet' }, h('div', { class: 'k' }, t('Daily job sheet')), h('h2', null, j.num + ' · ' + tt(j.title)), h('p', { class: 'addr' }, [j.street, j.city].filter(Boolean).join(', ')),
        j.contact ? h('p', { class: 'fine' }, t('Site contact: {name} {phone}', { name: j.contact.name, phone: j.contact.phone })) : null,
        today.length ? h('ul', { class: 'tasks' }, today.map(k => h('li', null, h('b', null, tt(k.name)), ' · ', k.kind === 'inspection' ? (k.booked ? t('inspection, booked') : t('inspection, NOT booked')) : (k.whoName || C.whoName(st, k.who)), k.scope ? h('div', { class: 'fine' }, tt(k.scope)) : null,
          k.kind !== 'inspection' ? h('button', { class: 'btn sm', type: 'button', 'data-fdone': k.id, onclick: guarded(() => { k.status = 'done'; }) }, t('Mark done')) : null))) : L.empty(t('Nothing scheduled on this job today.')),
        next.length ? h('p', { class: 'fine' }, t('Coming up: {list}', { list: next.map(k => tt(k.name) + ' ' + C.fmtShort(k.start)).join(', ') })) : null),
      h('section', { class: 'card', id: 'time' }, h('div', { class: 'k' }, t('Time in and out')), timeRows.length ? timeRows : L.empty(t('No crew on this job today.'))),
      h('section', { class: 'card', id: 'punch' }, h('div', { class: 'k' }, t('Punch list')),
        h('ul', { class: 'plist' }, j.punch.map(p => h('li', { class: p.done ? 'done' : '' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.done, onchange: e => { p.done = e.target.checked; p.u = Date.now(); L.commit(); } }), h('span', null, tt(p.text))), p.photoId ? L.photo(p.photoId, tt(p.text)) : null))),
        h('div', { class: 'row' }, punchText, h('label', { class: 'btn sm', for: 'punch-photo' }, t('Photo')), punchFile, h('button', { class: 'btn sm', type: 'button', id: 'punch-add', onclick: guarded(async () => { C.guard({ x: punchText.value }); const ids = await L.savePhotos(punchFile.files); C.addPunch(st, j, { text: punchText.value, photoId: ids[0] || '', by }); }) }, t('Add')))),
      h('section', { class: 'card', id: 'pickup' }, h('div', { class: 'k' }, t('Material pickup')),
        h('ul', { class: 'plist' }, j.pickup.map(p => h('li', { class: p.got ? 'done' : '' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.got, onchange: e => { p.got = e.target.checked; p.u = Date.now(); L.commit(); } }), h('span', null, (p.qty ? p.qty + ' × ' : '') + tt(p.item) + (p.supplier ? ' · ' + p.supplier : '')))))),
        h('div', { class: 'row' }, pickQty, pickItem, pickSup, h('button', { class: 'btn sm', type: 'button', id: 'pick-add', onclick: guarded(() => { C.guard({ a: pickItem.value, b: pickSup.value }); C.addPickup(st, j, { item: pickItem.value, qty: pickQty.value, supplier: pickSup.value }); }) }, t('Add')))),
      h('section', { class: 'card', id: 'dlog' }, h('div', { class: 'k' }, t('Daily log')), logText, h('div', { class: 'row' }, weather, h('label', { class: 'btn sm', for: 'log-photo' }, t('Photos')), logFile, h('span', { class: 'grow' }),
        h('button', { class: 'btn', type: 'button', id: 'log-add', onclick: guarded(async () => { C.guard({ x: logText.value }); if (!logText.value.trim()) throw new Error(t('Write what happened today')); const ids = await L.savePhotos(logFile.files); C.addLog(st, j, { date: d, by, weather: weather.value, text: logText.value, photoIds: ids }, d); }) }, t('Save log entry'))),
        j.logs.slice().reverse().slice(0, 5).map(l => h('div', { class: 'logline' }, h('b', null, C.fmtShort(l.date) + (l.by ? ' · ' + l.by : '') + (l.weather ? ' · ' + tt(l.weather) : '')), h('p', null, tt(l.text)), l.photoIds.length ? h('div', { class: 'thumbs' }, l.photoIds.map(id => L.photo(id))) : null))),
      handoffCard());
  };

  /* encrypted handoff between office and phone: a file, moved by cable, card or any way you like. No cloud. */
  function handoffCard() {
    const st = L.st, p1 = L.input({ type: 'password', id: 'ho-pass', autocomplete: 'off' }), p2 = L.input({ type: 'password', id: 'ho-pass2', autocomplete: 'off' }), phone = h('input', { type: 'checkbox', id: 'ho-phone' }), err = L.err();
    const file = h('input', { type: 'file', accept: '.sthandoff,.json', id: 'ho-file' }), ip = L.input({ type: 'password', id: 'ho-ipass', autocomplete: 'off' }), ierr = L.err();
    const office = st.device.role === 'office';
    return h('section', { class: 'card', id: 'handoff' }, h('div', { class: 'k' }, t('Office and field handoff')),
      h('p', { class: 'muted small' }, office ? t('Make a handoff file for the field phone: active jobs, tasks, crew, punch lists, pickups and logs. It is encrypted with a handoff passphrase you share in person.') : t('Send your punch list, pickups, time and daily logs back to the office in an encrypted file. Move it by cable, memory card or any way you like: no cloud.')),
      st.device.hoRotate ? h('p', { class: 'note bad', id: 'ho-rotate' }, t('A crew member was set inactive after the last handoff. Use a new handoff passphrase this time.')) : null,
      h('div', { class: 'grid2' }, L.field(t('Handoff passphrase'), p1), L.field(t('Repeat it'), p2)), office ? h('label', { class: 'check' }, phone, h('span', null, t('Include the customer name and phone for site access'))) : null, err,
      h('button', { class: 'btn', type: 'button', id: 'ho-go', onclick: async e => { err.textContent = ''; const b = e.target; try { const iss = C.passIssues(p1.value); if (iss.length) throw new Error(iss[0]); if (p1.value !== p2.value) throw new Error(t('The two passphrases differ.'));
        b.disabled = true; if (await C.handoffReuse(st, p1.value)) throw new Error(t('A crew member was set inactive after the last handoff. Choose a new handoff passphrase so the old one stops working for new files.'));
        const pk = C.makeHandoff(st, { phone: office && phone.checked }, T()), photos = await S.allPhotos(pk.photoIds), text = await C.packHandoff(p1.value, pk, photos); await C.handoffUsed(st, p1.value); p1.value = p2.value = '';
        L.download('stark-trades-' + (office ? 'to-field' : 'to-office') + '-' + T() + '.sthandoff', text, 'application/json'); st.device.lastHandoff = T(); L.save(); L.toast(t('Handoff file saved')); } catch (x) { err.textContent = x.message; } b.disabled = false; } }, office ? t('Make handoff for the field') : t('Send updates to the office')),
      h('hr'), h('div', { class: 'grid2' }, L.field(t('Handoff file received'), file), L.field(t('Handoff passphrase'), ip)), ierr,
      h('button', { class: 'btn', type: 'button', id: 'ho-import', onclick: async () => { ierr.textContent = ''; const f = file.files[0]; if (!f) { ierr.textContent = t('Choose the handoff file.'); return; }
        try { const r = await C.unpackHandoff(await f.text(), ip.value); for (const p of r.photos) { try { await S.getPhoto(p.id); } catch (e) { await S.putPhoto(p.id, p.bytes); } }
          const n = C.mergeHandoff(st, r.packet, T()); ip.value = ''; st.device.lastHandoff = T(); L.commit(); L.toast(t('Merged: {j} new jobs, {a} new and {u} updated records, {d} tasks marked done.', { j: n.jobs, a: n.added, u: n.updated, d: n.done })); } catch (x) { ierr.textContent = x.message; } } }, t('Import handoff')),
      st.device.lastHandoff ? h('p', { class: 'fine' }, t('Last handoff: {date}', { date: C.fmtDate(st.device.lastHandoff) })) : null);
  }

  /* ---------------- share and backup ---------------- */
  L.routes.backup = function () {
    const st = L.st, p1 = L.input({ type: 'password', id: 'bk-pass', autocomplete: 'new-password' }), p2 = L.input({ type: 'password', id: 'bk-pass2', autocomplete: 'new-password' }), err = L.err();
    const rf = h('input', { type: 'file', accept: '.json,.starktrades,application/json', id: 'restore-file' }), rp = L.input({ type: 'password', id: 'restore-pass', autocomplete: 'off' }), rerr = L.err();
    return h('div', { class: 'stack' }, h('h1', null, t('Share and backup')),
      h('section', { class: 'card' }, h('h2', null, t('Encrypted backup')), h('p', { class: 'muted' }, t('One file with every job, sub, estimate and photo, encrypted with the passphrase you type here (it can be your usual one). Keep a copy on a USB stick in a safe place. Without the passphrase the file cannot be opened by anyone, including you.')),
        h('div', { class: 'grid2' }, L.field(t('Backup passphrase'), p1), L.field(t('Repeat it'), p2)), err,
        h('button', { class: 'btn primary', type: 'button', id: 'bk-go', onclick: async e => { err.textContent = ''; const b = e.target; try { const iss = C.passIssues(p1.value); if (iss.length) throw new Error(iss[0]); if (p1.value !== p2.value) throw new Error(t('The two passphrases differ.'));
          b.disabled = true; const text = await C.packBackup(p1.value, st, await S.allPhotos(allPhotoIds())); p1.value = p2.value = ''; L.download('stark-trades-backup-' + T() + '.starktrades', text, 'application/json'); st.company.lastBackup = T(); L.save(); L.toast(t('Encrypted backup saved')); } catch (x) { err.textContent = x.message; } b.disabled = false; } }, t('Save encrypted backup')),
        h('p', { class: 'fine' }, st.company.lastBackup ? t('Last backup: {date}', { date: C.fmtDate(st.company.lastBackup) }) : t('No backup yet.'))),
      h('div', { class: 'grid2' },
        h('section', { class: 'card' }, h('h2', null, t('Share with a sub')), h('p', { class: 'muted' }, t('Gives one sub their own tasks only: dates, scope, site and their price. Nothing about other subs or other customers. You see a preview and choose what to leave out first.')),
          h('div', { class: 'row' }, st.subs.filter(s => s.active !== false && s.bench !== 'dnu').map(s => h('button', { class: 'btn sm', type: 'button', onclick: () => L.shareSub(s.id) }, s.name.replace(' (demo)', ''))))),
        h('section', { class: 'card' }, h('h2', null, t('CSV import and export')), h('p', { class: 'muted' }, t('Every export opens a redaction step with a preview. Imports skip any row that looks like it holds an SSN, tax ID, bank or card number.')),
          h('div', { class: 'row' }, h('a', { class: 'btn sm', href: '#/subs' }, t('Subs')), h('a', { class: 'btn sm', href: '#/pricebook' }, t('Price book')), h('a', { class: 'btn sm', href: '#/customers' }, t('Customers')), h('a', { class: 'btn sm', href: '#/jobs' }, t('Jobs')), h('a', { class: 'btn sm', href: '#/reports' }, '1099-NEC')))),
      handoffCard(),
      h('section', { class: 'card' }, h('h2', null, t('Restore from a backup')), h('p', { class: 'muted' }, t("Replaces everything in this browser with the backup. After restoring, the backup's passphrase unlocks the app.")),
        h('div', { class: 'grid2' }, L.field(t('Backup file'), rf), L.field(t('Backup passphrase'), rp)), rerr,
        h('button', { class: 'btn danger', type: 'button', id: 'restore-go', onclick: () => { rerr.textContent = ''; const f = rf.files[0]; if (!f) { rerr.textContent = t('Choose the backup file.'); return; }
          L.confirm(t('Replace everything here with this backup?'), t('Restore'), async () => { try { const b = await C.unpackBackup(await f.text(), rp.value); await S.replaceAll(rp.value, C.migrate(b.state), b.photos); rp.value = ''; L.st = b.state; L.render(); L.toast(S.passkeyDropped ? t('Backup restored. Passkey unlock was turned off because the key changed; turn it on again in Settings.') : t('Backup restored')); } catch (x) { rerr.textContent = x.message; } }, true); } }, t('Restore'))));
  };

  /* ---------------- settings ---------------- */
  L.routes.settings = function () {
    const st = L.st, co = st.company, I = (k, a) => L.input(Object.assign({ name: k, value: co[k] == null ? '' : co[k] }, a)), pct = v => C.fmtBps(v).replace('%', '');
    const f = { name: I('name', { id: 'set-name' }), phone: I('phone'), email: I('email'), street: I('street'), city: I('city'), state: I('state'), license: I('license'),
      retain: L.input({ value: pct(co.retainBps), inputmode: 'decimal' }), markup: L.input({ value: pct(co.markupBps), inputmode: 'decimal' }), tax: L.input({ value: pct(co.matTaxBps), inputmode: 'decimal' }), lab: L.money(co.labRate), wy: L.input({ value: String(co.warrantyYears), inputmode: 'numeric' }),
      terms: L.input({ value: String(co.termsDays), inputmode: 'numeric', id: 'set-terms' }), subTerms: L.input({ value: String(co.subTerms), inputmode: 'numeric' }), insp: L.input({ value: String(co.inspLead), inputmode: 'numeric' }), share: L.input({ value: String(co.subShare), inputmode: 'numeric' }),
      gl: L.money(co.glMin), agg: L.money(co.glAgg), auto: L.money(co.autoMin), umb: L.money(co.umbrella), addl: h('input', { type: 'checkbox', checked: co.addlInsured }), wos: h('input', { type: 'checkbox', checked: co.waiverSubro }), pnc: h('input', { type: 'checkbox', checked: co.primaryNC }),
      lock: L.select([['5', t('5 minutes')], ['10', t('10 minutes')], ['15', t('15 minutes')], ['30', t('30 minutes')]], String(co.lockMin), { id: 'set-lock' }), lang: L.select([['en', 'English'], ['es', 'Español']], C.I.lang, { id: 'set-lang' }),
      role: L.select([['office', t('Office computer')], ['field', t('Field phone')]], st.device.role, { id: 'set-role' }), trades: L.area(st.trades.join('\n'), { rows: 7, id: 'set-trades', name: 'trades', 'aria-label': t('Trades') }) };
    const days = [1, 2, 3, 4, 5, 6, 0].map(x => L.check(C.dowName(x), co.workDays.indexOf(x) >= 0, { value: x }));
    const preset = L.select(Object.keys(C.PRESETS).map(k => [k, t(C.PRESETS[k].label)]), st.preset, { id: 'set-preset' });
    const np1 = L.input({ type: 'password', autocomplete: 'new-password', id: 'np1' }), np2 = L.input({ type: 'password', autocomplete: 'new-password', id: 'np2' }), perr = L.err();
    const num = (x, w, min, max) => { const n = parseInt(x.value, 10); if (isNaN(n) || n < min || n > max) throw new Error(t('{what} must be a whole number from {a} to {b}', { what: w, a: min, b: max })); return n; };
    return h('div', { class: 'stack' }, h('h1', null, t('Settings')),
      L.form({ id: 'settings-form' }, [h('section', { class: 'card stack' }, h('h2', null, t('Language and device')), h('div', { class: 'grid3' }, L.field(t('Language'), f.lang), L.field(t('This device is'), f.role, t('A field phone shows field tools first and sends updates back with a handoff file.')), L.field(t('Auto-lock after'), f.lock))),
        h('section', { class: 'card stack' }, h('h2', null, t('Your company')), h('div', { class: 'grid3' }, L.field(t('Business name'), f.name), L.field(t('Phone'), f.phone), L.field(t('Email'), f.email), L.field(t('Street'), f.street), L.field(t('City'), f.city), L.field(t('State'), f.state)), L.field(t('Your contractor license number'), f.license)),
        h('section', { class: 'card stack' }, h('h2', null, t('Money and schedule defaults')), h('div', { class: 'grid4' }, L.field(t('Sub retainage %'), f.retain), L.field(t('Estimate markup %'), f.markup), L.field(t('Tax on materials %'), f.tax), L.field(t('Labor rate per hour'), f.lab),
          L.field(t('Customer pays within (days)'), f.terms), L.field(t('You pay subs within (days)'), f.subTerms), L.field(t('Book inspections ahead (working days)'), f.insp), L.field(t('Share of a sub’s time you can usually get (%)'), f.share), L.field(t('Your workmanship warranty (years)'), f.wy)),
          h('fieldset', { class: 'checks' }, h('legend', null, t('Working days')), days)),
        h('section', { class: 'card stack' }, h('h2', null, t('Insurance you require from subs')), h('div', { class: 'grid4' }, L.field(t('General liability per occurrence'), f.gl), L.field(t('General liability aggregate'), f.agg), L.field(t('Auto liability'), f.auto), L.field(t('Umbrella (0 = not required)'), f.umb)),
          h('div', { class: 'row' }, h('label', { class: 'check' }, f.addl, h('span', null, t('Additional insured endorsement'))), h('label', { class: 'check' }, f.wos, h('span', null, t('Waiver of subrogation'))), h('label', { class: 'check' }, f.pnc, h('span', null, t('Primary and non-contributory')))),
          h('p', { class: 'fine' }, t('Used in onboarding packets, bid invitations and agreements. Ask your insurance agent what limits fit your work.'))),
        h('section', { class: 'card stack' }, h('h2', null, t('Trades')), h('p', { class: 'muted small' }, t('One per line. Used for tasks, sub specialties, bids, the price book and capacity. Plumbing is the default; electrical, HVAC, general contracting, roofing, landscaping and remodeling presets are below. Keep "Inspection" for inspection steps.')), f.trades,
          h('div', { class: 'row' }, L.field(t('Preset'), preset), h('button', { class: 'btn', type: 'button', id: 'apply-preset', onclick: () => L.confirm(t('Switch the trade list to {p} and add its example price book items? Your jobs, subs and prices stay.', { p: t(C.PRESETS[preset.value].label) }), t('Switch'), () => {
            const p = C.PRESETS[preset.value]; st.preset = preset.value; st.trades = p.trades.slice(); p.book.forEach(b => { if (!st.priceBook.some(x => x.name === b.name)) st.priceBook.push(Object.assign({ id: C.nid(st, 'pb') }, b)); }); L.commit(); L.toast(t('Trades switched to {p}', { p: t(p.label) })); }) }, t('Apply preset')))),
        h('div', { class: 'row end save-bar' }, h('button', { class: 'btn primary', type: 'submit', id: 'settings-save' }, t('Save settings')))], () => {
        const P = (x, w, max) => { const b = C.toBps(x.value); if (isNaN(b) || b > max) throw new Error(t('{what} must be a percent up to {max}', { what: w, max: max / 100 })); return b; };
        const tr = f.trades.value.split('\n').map(x => x.trim()).filter(Boolean); if (!tr.length) throw new Error(t('Keep at least one trade'));
        Object.assign(co, { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), street: f.street.value.trim(), city: f.city.value.trim(), state: f.state.value.trim(), license: f.license.value.trim(),
          retainBps: P(f.retain, t('Retainage'), 2000), markupBps: P(f.markup, t('Markup'), 50000), matTaxBps: P(f.tax, t('Tax'), 3000), labRate: L.cents(f.lab.value, t('the labor rate')), warrantyYears: num(f.wy, t('Warranty years'), 0, 20),
          termsDays: num(f.terms, t('Customer terms'), 0, 120), subTerms: num(f.subTerms, t('Sub terms'), 0, 120), inspLead: num(f.insp, t('Inspection lead time'), 0, 20), subShare: num(f.share, t('Sub share'), 0, 100),
          glMin: L.cents(f.gl.value, t('the GL requirement')), glAgg: L.cents(f.agg.value, t('the GL aggregate')), autoMin: L.cents(f.auto.value || '0', t('the auto limit')), umbrella: L.cents(f.umb.value || '0', t('the umbrella limit')), addlInsured: f.addl.checked, waiverSubro: f.wos.checked, primaryNC: f.pnc.checked,
          lockMin: +f.lock.value, workDays: days.map(x => x.querySelector('input')).filter(i => i.checked).map(i => +i.value), lang: f.lang.value });
        if (!co.workDays.length) co.workDays = [1, 2, 3, 4, 5]; st.trades = tr; st.device.role = f.role.value; L.setLang(f.lang.value); L.restartIdle(); L.commit(); L.toast(t('Settings saved')); }),
      L.docSettingsCard ? L.docSettingsCard() : null,
      h('section', { class: 'card stack' }, h('h2', null, t('Change passphrase')), h('div', { class: 'grid2' }, L.field(t('New passphrase'), np1), L.field(t('Repeat it'), np2)), perr,
        h('div', null, h('button', { class: 'btn', type: 'button', onclick: async e => { perr.textContent = ''; try { const iss = C.passIssues(np1.value); if (iss.length) throw new Error(iss[0]); if (np1.value !== np2.value) throw new Error(t('The two passphrases differ.')); e.target.disabled = true; await S.rekey(np1.value, st, allPhotoIds()); np1.value = np2.value = ''; L.toast(S.passkeyDropped ? t('Passphrase changed. Everything was re-encrypted. Passkey unlock was turned off; turn it on again below.') : t('Passphrase changed. Everything was re-encrypted.')); L.render(); } catch (x) { perr.textContent = x.message; } e.target.disabled = false; } }, t('Change passphrase')))),
      h('section', { class: 'card stack' }, h('h2', null, t('Start fresh or erase')), h('p', { class: 'muted' }, st.demo ? t('You are using the demo company. Start fresh clears every demo job, sub, customer and payment. Your passphrase stays.') : t('Erase removes every record and photo from this browser. Make a backup first.')),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'start-fresh', onclick: () => L.confirm(t('Clear all jobs, subs, crew, customers, estimates, payments and warranties? Your passphrase stays.'), t('Start fresh'), async () => {
          for (const id of allPhotoIds()) await S.delPhoto(id); const n = C.newState(st.preset); n.trades = st.trades; n.company.lang = C.I.lang; n.device = { id: st.device.id || C.randomId(), role: st.device.role, lastHandoff: '' }; L.st = n; L.save(); L.go('#/today'); L.toast(t('Fresh start. Add your company details in Settings.')); }, true) }, t('Start fresh')),
          h('button', { class: 'btn danger', type: 'button', onclick: () => L.confirm(t('Erase everything in this browser, including the passphrase check? This cannot be undone.'), t('Erase everything'), async () => { await S.eraseAll(); location.reload(); }, true) }, t('Erase everything')))),
      h('section', { class: 'card' }, h('h2', null, t('Activity log')), h('ul', { class: 'log' }, st.audit.slice(0, 25).map(a => h('li', null, h('span', { class: 'muted' }, C.fmtShort(a.date)), ' ', tt(a.text))))));
  };

  /* ---------------- honest limits ---------------- */
  L.LIMITS = [
    [N('Not legal or tax advice'), N('Stark Trades is a business tool. Agreement, change order, backcharge, onboarding and waiver texts are templates marked "have a lawyer review". The Spanish templates are translations of the English ones; have those reviewed too. The 1099-NEC list is a guide; check with a tax professional.')],
    [N('Rules differ by state'), N("Lien law (notice deadlines, waiver forms, retainage limits), contractor licensing, workers' comp exemptions, indemnity limits and insurance requirements differ by state and sometimes by city. Check with your state contractor board and a lawyer before you rely on any template.")],
    [N('Not payroll or accounting'), N('It does not run payroll, withhold taxes, file forms or keep double-entry books. Weekly timesheets add up the hours you record and flag weeks over 40; they do not work out wages, overtime pay, breaks or withholding. The Stark Ledger export lists the payments you recorded; your bookkeeper still categorizes them.')],
    [N('Records, not payments or messages'), N('Plan bills, purchase orders, status reports and photo reports are files you print or send yourself. Stark Trades does not email, text, charge cards or collect payments.')],
    [N('Stock counts are only as good as your entries'), N('Van stock changes when you record a use, move, delivery or count. It does not scan barcodes or connect to supplier systems, and it stays on the office computer: field handoff files carry jobs, time, punch lists, logs and safety records, not stock.')],
    [N('Safety lists are reminders, not a safety program'), N('Checklists and toolbox talks are general. They do not replace OSHA rules, your written safety program, site-specific training or a competent person on site.')],
    [N('Permits and certifications are tracked, not checked'), N('Their status comes from the dates you enter. Permit rules, fees and expiry periods differ by city, county and state; check certifications with the issuer.')],
    [N('It cannot check licenses or insurance for you'), N("Compliance status comes from the dates you type in. Verify licenses on your state board's lookup and get certificates straight from the sub's insurance agent.")],
    [N('Estimating aids and forecasts are rough'), N('Fixture lists, assemblies and takeoffs are estimating aids: verify against your local code and engineer. The capacity forecast is a planning guess from your own past jobs, not a promise.')],
    [N('Your data stays on this computer'), N('No network, no accounts, no analytics. That also means no cloud copy: if this computer dies or the browser data is cleared, only your backup file can bring it back. If you forget your passphrase, nobody can recover the data. Everything is encrypted on this computer, saves are checked after writing and kept with a last good copy, and nothing tracks you.')],
    [N('Handoff files are only as safe as their passphrase'), N('Office and field handoff files are encrypted. Share the handoff passphrase in person, not in the same message as the file.')],
    [N('Quotes and invoices are your paperwork'), N('A quote or invoice is a document you print or save as a PDF and give to your customer yourself. Stark Trades does not take or process payments; a payment shows on an invoice only after you record it. Typing a name and date for an accepted quote is a note for your records, not a certified electronic signature. The tax line uses the rate you type: the app has no tax tables and makes no claim that the tax shown is correct for your place.')],
    [N('Sensitive numbers are refused'), N('It will not save full Social Security numbers, tax ID (EIN) digits, bank account or routing numbers, or card numbers. Keep W-9s and banking details on paper or with your accountant. The one exception is the "how to pay" text in Settings, where you may type your own bank details to print on your invoices; Social Security, tax ID and card numbers are still refused there.')],
    [N('Browser storage'), N('Data lives in this browser for this file location. Use a normal (not private) window, and keep the app folder in one place.')]
  ];
  L.routes.limits = function () {
    return h('div', { class: 'stack' }, h('h1', null, t('Honest limits')), h('p', { class: 'muted' }, t('What Stark Trades does not do, in plain words.')),
      h('div', { class: 'grid2', id: 'limits' }, L.LIMITS.map(x => h('section', { class: 'card' }, h('h2', null, t(x[0])), h('p', null, t(x[1]))))));
  };
})();
