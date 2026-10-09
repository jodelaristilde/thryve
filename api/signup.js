const crypto = require('crypto');
const { redis, getCourses, readBody, isJson } = require('./_lib');

const NOT_SURE = 'Not sure yet';

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    if (!isJson(req)) { res.status(415).json({ error: 'Send JSON.' }); return; }
    const b = readBody(req);

    // Hidden field that real visitors never fill in. Bots do.
    if (b.company) { res.status(200).json({ ok: true }); return; }

    const name = String(b.name || '').trim();
    const tel = String(b.tel || '').trim();
    const email = String(b.email || '').trim();
    const course = String(b.course || '').trim();

    if (name.length < 2 || name.length > 100) { res.status(400).json({ error: 'Enter your full name.' }); return; }
    if (tel.length > 30 || tel.replace(/\D/g, '').length < 7) { res.status(400).json({ error: 'Enter a valid phone number.' }); return; }
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'Enter a valid email address.' }); return; }

    const allowed = (await getCourses()).concat([NOT_SURE]);
    if (allowed.indexOf(course) === -1) { res.status(400).json({ error: 'Choose a course from the list.' }); return; }

    const record = { id: crypto.randomUUID(), date: new Date().toISOString(), name: name, tel: tel, email: email, course: course };
    await redis(['RPUSH', 'signups', JSON.stringify(record)]);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'We could not save your sign-up. Please try again.' });
  }
};
