const mongoose = require('mongoose');
const { mergeDeep } = require('./util');

const operation = Symbol();
const OPERATION_TYPE = {
  SAVE: 'save',
  DELETE: 'delete'
};

/**
 * Return normalized mongoose query object
 * @param {object} query
 * @return {object}
 */
const normalizeQuery = (query) => {
  let { $or, $and, ...rest } = query;
  Object.keys({ $or, $and }).forEach(key => {
    if (query[key] && query[key].length) {
      rest = Object.assign(rest, { [key]: query[key] });
    }
  });
  return rest;
};

/**
 * Prepare filter
 * @param {object} query
 * @param {string[]} filterNames
 * @returns {string[]}
 */
const prepareFilter = (query, filterNames) => {
  const andFilter = [];
  filterNames.forEach(name => {
    if (query[name] !== undefined) {
      const value = mongoose.Types.ObjectId.isValid(query[name]) ?
        mongoose.Types.ObjectId(query[name]) :
        query[name];
      andFilter.push({ [name ]: value });
    }
  });
  return andFilter;
};

/**
 * @typedef ControllerOptions
 * @field {string[]} fieldNames
 * @field {string[]} [populateFields]
 * @field {string[]} [fieldNamesSearch]
 * @field {string[]} [fieldNamesSearchFilter]
 * @field {string[]} [listExtraQueryFields]
 */

/**
 * @class BasicController
 * @version 1.0.0
 */
class BasicController {
  /**
   * Basic controller constructor
   * @param {string} modelName
   * @param {ControllerOptions} options
   */
  constructor(modelName, options = {}) {
    this.mongoose = mongoose;
    this.model = mongoose.model(modelName);
    this.modelNameAttr = modelName.toLowerCase();
    this.options = options;
  }

  /**
   * Read item
   * @param req
   * @param res
   * @returns {Promise<*>}
   */
  async read(req, res) {
    return res.json(req[this.modelNameAttr]);
  }

  /**
   * Create item
   * @param req
   * @param res
   * @returns {Promise<void>}
   */
  async create(req, res) {
    const itemData = {};
    this.options.fieldNames.forEach(field => itemData[field] = req.body[field]);
    const updatedItemData = await this.preCreateHandler(req, itemData);
    const item = new this.model(updatedItemData);
    item.user = req.user;
    return this[operation](OPERATION_TYPE.SAVE, item, res);
  }

  /**
   * Update item
   * @param req
   * @param res
   * @returns {Promise<void>}
   */
  async update(req, res) {
    const itemData = {};
    this.options.fieldNames.forEach(field => itemData[field] = req.body[field]);
    const updatedItemData = await this.preUpdateHandler(req, itemData);
    const item = Object.assign(req[this.modelNameAttr], updatedItemData);
    return this[operation](OPERATION_TYPE.SAVE, item, res);
  }

  /**
   * Delete item
   * @param req
   * @param res
   * @returns {Promise<void>}
   */
  async delete(req, res) {
    const item = req[this.modelNameAttr];
    const updatedItem = await this.preDeleteHandler(req, item);
    return this[operation](OPERATION_TYPE.DELETE, updatedItem, res);
  }

  /**
   * Get item list by params
   * @param req
   * @param res
   * @returns {Promise<*>}
   */
  async list(req, res) {
    const { limit = 20, page = 1, q = '' } = req.query;
    const { fieldNamesSearch = [], fieldNamesSearchFilter = [] } = this.options;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const $or = fieldNamesSearch.map(field => ({ [field]: { $regex: new RegExp(escaped, 'i') } }));
    const $and = prepareFilter(req.query, fieldNamesSearchFilter);
    const extraQuery = await this.preListHandler(req);
    const query = mergeDeep({ $or, $and }, extraQuery);
    let items = this.model.find(normalizeQuery(query))
      .limit(+limit)
      .skip((page - 1) * limit)
      .sort('-created')
      .populate('user', 'displayName');
    if (this.options.populateFields) {
      items = items.populate(this.options.populateFields.join(' '));
    }
    const count = this.model.countDocuments();
    return Promise.all([items, count])
      .then(([items, count]) => res.json({ items, count }))
      .catch((err) => {
        return res.status(400).send({
          message: err.message
        });
      });
  }

  /**
   * Get item by id
   * @param req
   * @param res
   * @param next
   * @param id
   * @returns {Promise<*>}
   */
  async get(req, res, next, id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send({
        message: 'ID is invalid'
      });
    }

    let item = this.model.findById(id)
      .populate('user', 'displayName');
    if (this.options.populateFields) {
      item.populate(this.options.populateFields.join(' '));
    }
    return item
      .then(data => {
        if (!data) {
          return res.status(404).send({
            message: 'No item with that identifier has been found'
          });
        }
        req[this.modelNameAttr] = data;
        next();
      })
      .catch(err => {
        return next(err);
      });
  }

  /**
   * Pre-create item hook
   * @param req
   * @param item
   * @returns {Promise<*>}
   */
  async preCreateHandler(req, item) {
    return Promise.resolve(item);
  }

  /**
   * Pre-update item hook
   * @param req
   * @param item
   * @returns {Promise<*>}
   */
  async preUpdateHandler(req, item) {
    return Promise.resolve(item);
  }

  /**
   * Pre-delete item hook
   * @param req
   * @param item
   * @returns {Promise<*>}
   */
  async preDeleteHandler(req, item) {
    return Promise.resolve(item);
  }

  /**
   * Pre-list handler
   * @param req
   * @returns {Promise<*>}
   */
  async preListHandler(req) {
    return {};
  }

  /**
   * Save/delete operation
   * @param {string} operationType
   * @param {object} item
   * @param res
   * @returns {Promise<*>}
   */
  async [operation](operationType, item, res) {
    try {
      const saveResponse = await item[operationType]();
      return res.json(saveResponse);
    } catch (e) {
      return res.status(400).send({
        message: e.message
      });
    }
  }
}

module.exports = BasicController;
