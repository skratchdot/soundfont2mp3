function SoundfontProcessingError(message) {
  this.message = message;
  this.stack = (new Error()).stack;
};

SoundfontProcessingError.prototype = Object.create(Error.prototype);

SoundfontProcessingError.prototype.name = 'SoundfontProcessingError';

SoundfontProcessingError.prototype.constructor = SoundfontProcessingError;

exports = module.exports = SoundfontProcessingError;
