const chalk = require('chalk');
const path = require('path');
const mongoose = require('mongoose');

/**
 * Load Mongoose models
 * @param {string[]} models - model paths array
 */
module.exports.loadModels = (models) => {
  models.forEach(modelPath => require(path.resolve(modelPath)));
};

/**
 * Initialise mongoose connection
 * @param {object} db
 * @param {string} db.uri
 * @param {boolean} db.debug
 * @param {object} db.options
 * @param {string} db.options.user
 * @param {string} db.options.pass
 * @return {Promise<object>}
 */
module.exports.connect = async (db) => {
  const { uri, options, debug } = db;
  return mongoose.connect(uri, options)
    .then(() => {
      mongoose.set('debug', debug);
      return mongoose.connection;
    })
    .catch((err) => {
      console.error(chalk.red('Could not connect to MongoDB!'));
      console.log(err);
    });
};

/**
 * Disconnect mongoose
 * @return {Promise<void>}
 */
module.exports.disconnect = async () => {
  return mongoose.disconnect()
    .then(() => {
      console.info(chalk.yellow('Disconnected from MongoDB.'));
    })
    .catch((err) => {
      console.error(chalk.red('Error when disconnected from MongoDB'));
      console.log(err);
    });
};
