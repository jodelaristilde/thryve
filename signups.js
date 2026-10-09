const { redis, getAdmin, readBody, isJson } = require('./_lib');

function keyOf(rec) {
  // Older sign-ups have no id, so fall back to date + email.
  return rec.id || (rec.date + '|' + rec.email);
}

function dateOnly(iso) {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
}

function csvCell(value) {
  let s = String(value == null ? '' : value);
  // Stop spreadsheet apps from running a sign-up as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!getAdmin(req)) { res.status(401).json({ error: 'Sign in as an admin first.' }); return; }

  try {
    const rows = (await redis(['LRANGE', 'signups', 0, -1])) || [];

    if (req.method === 'DELETE') {
      if (!isJson(req)) { res.status(415).json({ error: 'Send JSON.' }); return; }
      const ids = readBody(req).ids;
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
        res.status(400).json({ error: 'Choose between 1 and 500 sign-ups to delete.' });
        return;
      }
      const wanted = {};
      ids.forEach(function (id) { wanted[String(id)] = true; });
      let removed = 0;
      for (const raw of rows) {
        const rec = JSON.parse(raw);
        if (wanted[keyOf(rec)]) {
          await redis(['LREM', 'signups', 1, raw]);
          removed++;
        }
      }
      res.status(200).json({ removed: removed });
      return;
    }

    let signups = rows.map(function (raw) {
      const rec = JSON.parse(raw);
      rec.id = keyOf(rec);
      return rec;
    }).reverse(); // newest first

    if (req.query.format === 'csv') {
      if (req.query.course) {
        signups = signups.filter(function (s) { return s.course === req.query.course; });
      }
      const lines = [['Date', 'Full name', 'Telephone', 'Email', 'Course'].map(csvCell).join(',')];
      signups.forEach(function (s) {
        lines.push([dateOnly(s.date), s.name, s.tel, s.email, s.course].map(csvCell).join(','));
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="thryve-signups.csv"');
      res.status(200).send('\uFEFF' + lines.join('\r\n'));
      return;
    }

    res.status(200).json({ signups: signups });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
