function joinUrl(base, path) {
  return `${base.replace(/\/$/, '')}${path}`;
}

module.exports = { joinUrl };
