/**
 * @module ol/coverage/Band
 */
import BaseObject from '../Object.js';
import {TYPED_ARRAY} from '../has.js';
import Matrix from './Matrix.js';


/**
 * @typedef {Object} Options
 * @property {boolean} binary
 * @property {module:ol/extent~Extent} extent
 * @property {number|null} nodata
 * @property {ArrayBuffer|Array.<number>} matrix
 * @property {module:ol/coordinate~Coordinate} origin
 * @property {module:ol/size~Size} resolution
 * @property {number} stride
 * @property {module:ol/coverage/MatrixType} type
 */


/**
 * @typedef {Object} CoverageProperties
 * @property {module:ol/extent~Extent} extent
 * @property {number|null} nodata
 * @property {module:ol/coordinate~Coordinate} origin
 * @property {module:ol/size~Size} resolution
 * @property {number} stride
 * @property {module:ol/coverage/MatrixType} type
 */


/**
 * @typedef {Object} CoverageStatistics
 * @property {number} max
 * @property {number} min
 * @property {number} sum
 * @property {number} count
 * @property {number} variance
 */


/**
 * @classdesc Container for a single coverage band. Usually instantiated by
 * coverage sources.
 */
class Band extends BaseObject {

  /**
   * @param {module:ol/coverage/Band~Options} options Options.
   */
  constructor(options) {
    super();

    /**
     * @type {module:ol/coverage/MatrixType}
     * @private
     */
    this.type_ = options.type;

    /**
     * @type {number|null}
     * @private
     */
    this.null_ = options.nodata !== undefined ? options.nodata : null;

    /**
     * @type {module:ol/extent~Extent}
     * @private
     */
    this.extent_ = options.extent;

    /**
     * @type {module:ol/coordinate~Coordinate}
     * @private
     */
    this.origin_ = options.origin || [this.extent_[0] + options.resolution[0] / 2,
      this.extent_[1] + options.resolution[1] / 2];

    /**
     * @type {boolean}
     * @private
     */
    this.binary_ = typeof options.binary === 'boolean' ? options.binary :
      TYPED_ARRAY;

    /**
     * @type {module:ol/coverage/Matrix}
     * @private
     */
    this.matrix_ = this.binary_ ? this.createBinaryMatrix_(options.matrix,
      options.stride, options.resolution, this.binary_, options.type) :
      new Matrix(options.matrix, options.stride, options.resolution,
        this.binary_);

    /**
     * @type {module:ol/coverage/Band~CoverageStatistics}
     * @private
     */
    this.statistics_ = {
      min: undefined,
      max: undefined,
      sum: undefined,
      count: undefined,
      variance: undefined
    };
    this.calculateStatistics();
  }

  /**
   * Returns the raw coverage data or a typed array. If the underlying covergage
   * is not binary, a simple array is returned.
   * @param {boolean=} opt_buffer Return the array buffer, if it is binary.
   * @return {ArrayBuffer|module:ol/typedarray~TypedArray|Array.<number>} Coverage matrix.
   * @api
   */
  getCoverageData(opt_buffer) {
    if (opt_buffer) {
      return this.matrix_.getData();
    }
    return /** @type {module:ol/typedarray~TypedArray|Array.<number>} */ (
      this.matrix_.getData(this.type_));
  }

  /**
   * Returns the number of columns (row length).
   * @return {number} Stride.
   * @api
   */
  getStride() {
    return this.matrix_.getStride();
  }

  /**
   * Returns the extent of this band.
   * @return {module:ol/extent~Extent} Exent.
   * @api
   */
  getExtent() {
    return this.extent_;
  }

  /**
   * Returns the lower-left cell's center.
   * @return {module:ol/coordinate~Coordinate} Origin.
   * @api
   */
  getOrigin() {
    return this.origin_;
  }

  /**
   * Returns the resolution (x,y) of this band.
   * @return {module:ol/size~Size} Resolution.
   * @api
   */
  getResolution() {
    return this.matrix_.getResolution();
  }

  /**
   * Returns the null value associated to this band, if any.
   * @return {number|null} Null value.
   * @api
   */
  getNullValue() {
    return this.null_;
  }

  /**
   * @return {module:ol/coverage/Band~CoverageStatistics} Statistics.
   * @api
   */
  getStatistics() {
    return this.statistics_;
  }

  /**
   * Calculates common indices from raw coverage data.
   * @api
   */
  calculateStatistics() {
    const matrix = this.getCoverageData();
    const stat = this.getStatistics();
    const nullValue = this.getNullValue();
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;
    let i;

    for (i = 0; i < matrix.length; ++i) {
      if (matrix[i] !== nullValue) {
        sum += matrix[i];
        min = matrix[i] < min ? matrix[i] : min;
        max = matrix[i] > max ? matrix[i] : max;
        count++;
      }
    }
    const avg = sum / count;
    let variance = 0;

    for (i = 0; i < matrix.length; ++i) {
      if (matrix[i] !== nullValue) {
        variance += Math.pow(matrix[i] - avg, 2);
      }
    }
    variance /= count;

    stat.min = min;
    stat.max = max;
    stat.sum = sum;
    stat.count = count;
    stat.variance = variance;
  }

  /**
   * @param {ArrayBuffer|Array.<number>} matrix Coverage data.
   * @param {number} stride Stride.
   * @param {module:ol/size~Size} resolution Cell resolution.
   * @param {boolean} binary This is a binary coverage.
   * @param {module:ol/coverage/MatrixType} type CoverageData data type.
   * @return {module:ol/coverage/Matrix} Coverage object.
   * @private
   */
  createBinaryMatrix_(matrix, stride,
    resolution, binary, type) {
    let buffer;
    if (matrix instanceof window.ArrayBuffer) {
      buffer = matrix;
    } else {
      const ctor = Matrix.getArrayConstructor(type);
      buffer = new window.ArrayBuffer(matrix.length * ctor.BYTES_PER_ELEMENT);
      const view = new ctor(buffer);
      for (let i = 0; i < matrix.length; ++i) {
        view[i] = matrix[i];
      }
    }
    return new Matrix(buffer, stride, resolution, binary);
  }

  /**
   * Set the null value of the coverage band.
   * @param {number} nullValue Null value.
   * @api
   */
  setNullValue(nullValue) {
    const oldNull = this.null_;
    this.null_ = nullValue !== undefined ? nullValue : null;
    if (oldNull !== this.null_) {
      this.calculateStatistics();
    }
    this.changed();
  }
}

export default Band;
