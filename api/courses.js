const { redis, getCourses, getAdmin, readBody, isJson } = require('./_lib');

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      res.status(200).json({ courses: await getCourses() });
      return;
    }

    if (req.method === 'PUT') {
      if (!getAdmin(req)) { res.status(401).json({ error: 'Sign in as an admin first.' }); return; }
      if (!isJson(req)) { res.status(415).json({ error: 'Send JSON.' }); return; }
      const list = readBody(req).courses;
      if (!Array.isArray(list) || list.length > 50) {
        res.status(400).json({ error: 'Send a list of up to 50 courses.' });
        return;
      }
      const seen = {};
      const clean = [];
      for (const item of list) {
        const name = String(item || '').trim();
        if (!name) continue;
        if (name.length > 100) { res.status(400).json({ error: 'Course names must be 100 characters or fewer.' }); return; }
        const key = name.toLowerCase();
        if (seen[key]) continue;
        seen[key] = true;
        clean.push(name);
      }
      await redis(['SET', 'courses', JSON.stringify(clean)]);
      res.status(200).json({ courses: clean });
      return;
    }

    res.setHeader('Allow', 'GET, PUT');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
