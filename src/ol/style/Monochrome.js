/**
 * @module ol/style/Monochrome
 */
import {clamp} from '../math.js';


/**
 * @typedef {Object} Options
 * @property {number} [min] Minimum cell value. Lower cell values are
 * clipped. Default value is the calculated minimum of the styled band.
 * @property {number} [max] Maximum cell value. Higher cell values are
 * clipped. Default value is the calculated maximum of the styled band.
 * @property {number} [band=0] Band index.
 */


/**
 * @classdesc
 * Single band greyscale raster style. Cell values are transformed to byte
 * range (0-255) according to the supplied or calculated minimum and maximum
 * cell values.
 * @api
 */
class Monochrome {
  /**
   * @param {module:ol/style/Monochrome~Options=} opt_options Options.
   */
  constructor(opt_options) {

    const options = opt_options || {};

    /**
     * @private
     * @type {number}
     */
    this.min_ = options.min;

    /**
     * @private
     * @type {number}
     */
    this.max_ = options.max;

    /**
     * @private
     * @type {number}
     */
    this.band_ = options.band !== undefined ? options.band : 0;

    /**
     * @private
     * @type {string}
     */
    this.checksum_ = undefined;
  }

  /**
   * Clones the style.
   * @return {module:ol/style/Monochrome} The cloned style.
   * @api
   */
  clone() {
    return new Monochrome({
      min: this.getMin(),
      max: this.getMax(),
      band: this.getBandIndex()
    });
  }

  /**
   * Get the minimum value.
   * @return {number} Minimum value.
   * @api
   */
  getMin() {
    return this.min_;
  }

  /**
   * Get the maximum value.
   * @return {number} Maximum value.
   * @api
   */
  getMax() {
    return this.max_;
  }

  /**
   * Get the styled band's index.
   * @return {number} Band index.
   * @api
   */
  getBandIndex() {
    return this.band_;
  }

  /**
   * Set the minimum value.
   * @param {number} min New minimum value.
   * @api
   */
  setMin(min) {
    this.min_ = min;
    this.checksum_ = undefined;
  }

  /**
   * Set the maximum value.
   * @param {number} max New maximum value.
   * @api
   */
  setMax(max) {
    this.max_ = max;
    this.checksum_ = undefined;
  }

  /**
   * Set the styled band's index.
   * @param {number} band New band index.
   * @api
   */
  setBandIndex(band) {
    this.band_ = band;
    this.checksum_ = undefined;
  }

  /**
   * Fill missing values from band statistics.
   * @param {Array.<module:ol/coverage/Band>} bands Coverage bands.
   */
  fillMissingValues(bands) {
    const bandIndex = this.getBandIndex();
    if (bandIndex !== undefined && bands[bandIndex]) {
      const bandStat = bands[bandIndex].getStatistics();
      if (!this.getMin() && bandStat.min) {
        this.setMin(bandStat.min);
      }
      if (!this.getMax() && bandStat.max) {
        this.setMax(bandStat.max);
      }
    }
  }

  /**
   * Apply this style to the specified matrix.
   * @param {Array.<number>|module:ol/typedarray~TypedArray} matrix Input matrix.
   * @param {number} nodata NoData value.
   * @param {number} minAlpha Minimum alpha value.
   * @param {number} maxAlpha Maximum alpha value.
   * @return {Array.<number>} Styled interleaved matrix.
   */
  apply(matrix, nodata, minAlpha, maxAlpha) {
    const interleaved = [];
    let k = 0;
    let i, ii;
    let min = this.getMin();
    if (typeof min !== 'number') {
      min = Math.min.apply(matrix);
    }
    let max = this.getMax();
    if (typeof max !== 'number') {
      max = Math.max.apply(matrix);
    }
    const range = max - min;

    for (i = 0, ii = matrix.length; i < ii; ++i) {
      const lerp = (matrix[i] - min) / range;
      //TODO: Make clipping out of range data optional.
      const value = clamp(Math.round(255 * lerp), 0, 255);

      interleaved[k++] = value;
      interleaved[k++] = value;
      interleaved[k++] = value;
      interleaved[k++] = matrix[i] === nodata ? maxAlpha : minAlpha;
    }
    return interleaved;
  }

  /**
   * @return {string} The checksum.
   */
  getChecksum() {
    if (this.checksum_ === undefined) {
      this.checksum_ = 'm';
      if (this.getBandIndex() !== undefined) {
        this.checksum_ += this.getBandIndex().toString() + ',' +
        (this.getMin() !== undefined ? this.getMin().toString() : '-') + ',' +
        (this.getMax() !== undefined ? this.getMax().toString() : '-');
      } else {
        this.checksum_ += '-';
      }
    }

    return this.checksum_;
  }
}


/**
 * @param {number=} opt_index Band index.
 * @return {module:ol/style/Monochrome} Default raster style.
 */
Monochrome.defaultStyle = function(opt_index) {
  return new Monochrome({band: opt_index ? opt_index : 0});
};

export default Monochrome;
