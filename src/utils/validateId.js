const mongoose = require('mongoose');
const { HttpError } = require('./httpError');

function requireValidObjectId(id, label = 'id') {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, `Invalid ${label}`);
  }
}

module.exports = { requireValidObjectId };
