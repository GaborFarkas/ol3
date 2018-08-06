/**
 * @module ol/coverage/Matrix
 */
import BaseObject from '../Object.js';
import {TYPED_ARRAY} from '../has.js';
import {assert} from '../asserts.js';
import MatrixType from './MatrixType.js';


/**
 * @typedef {module:ol/typedarray~TypedArray|Array.<number|null>} CoverageData
 */


/**
 * @return {Object} Type map.
 */
const typeMap = function() {
  const typeMap = {};
  if (TYPED_ARRAY) {
    typeMap[MatrixType.UINT8] = window.Uint8Array;
    typeMap[MatrixType.INT8] = window.Int8Array;
    typeMap[MatrixType.UINT16] = window.Uint16Array;
    typeMap[MatrixType.INT16] = window.Int16Array;
    typeMap[MatrixType.UINT32] = window.Uint32Array;
    typeMap[MatrixType.INT32] = window.Int32Array;
    typeMap[MatrixType.FLOAT32] = window.Float32Array;
    typeMap[MatrixType.FLOAT64] = window.Float64Array;
  }
  return typeMap;
}();


/**
 * @classdesc Basic container for raw, binary coverage data.
 */
class Matrix extends BaseObject {

  /**
   * @param {ArrayBuffer|Array.<number>} matrix Coverage data.
   * @param {number} stride Number of columns.
   * @param {module:ol/size~Size} resolution Cell resolution.
   * @param {boolean} binary This is a binary coverage.
   */
  constructor(matrix, stride, resolution, binary) {
    super();

    /**
     * @type {ArrayBuffer|Array.<number>}
     * @private
     */
    this.matrix_ = matrix;

    /**
     * @type {number}
     * @private
     */
    this.stride_ = stride;

    /**
     * @type {module:ol/size~Size}
     * @private
     */
    this.resolution_ = resolution;

    /**
     * @type {boolean}
     * @private
     */
    this.binary_ = binary;
  }

  /**
   * @param {module:ol/coverage/MatrixType=} type Return an array with the specified type.
   * @return {ArrayBuffer|module:ol/typedarray~TypedArray|Array.<number>} Coverage data.
   */
  getData(type) {
    if (this.binary_) {
      return type ? this.asArray_(type) : this.matrix_;
    } else {
      return this.matrix_;
    }
  }

  /**
   * @return {number} Stride.
   */
  getStride() {
    return this.stride_;
  }

  /**
   * @return {module:ol/size~Size} Resolution.
   */
  getResolution() {
    return this.resolution_;
  }

  /**
   * @param {module:ol/coverage/MatrixType} type Type of the raster.
   * @return {module:ol/typedarray~TypedArray} Array.
   * @private
   */
  asArray_(type) {
    const view = Matrix.getArrayConstructor(type);
    return new view(this.matrix_);
  }
}


/**
 * @param {module:ol/coverage/MatrixType} type Raster type.
 * @return {?} Typed array constructor.
 * @api
 */
Matrix.getArrayConstructor = function(type) {
  if (TYPED_ARRAY) {
    assert(type in typeMap, 61);
    return typeMap[type];
  }
};

export default Matrix;
