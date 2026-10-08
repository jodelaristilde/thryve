const { redis, getAdmin } = require('./_lib');

function csvCell(value) {
  let s = String(value == null ? '' : value);
  // Stop spreadsheet apps from running a sign-up as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!getAdmin(req)) { res.status(401).json({ error: 'Sign in as an admin first.' }); return; }
  try {
    const rows = (await redis(['LRANGE', 'signups', 0, -1])) || [];
    const signups = rows.map(function (r) { return JSON.parse(r); }).reverse(); // newest first

    if (req.query.format === 'csv') {
      const lines = [['Date', 'Full name', 'Telephone', 'Email', 'Course'].map(csvCell).join(',')];
      signups.forEach(function (s) {
        lines.push([s.date, s.name, s.tel, s.email, s.course].map(csvCell).join(','));
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
