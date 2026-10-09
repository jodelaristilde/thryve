const { getAdmin } = require('./_lib');

module.exports = function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ user: getAdmin(req) });
};
