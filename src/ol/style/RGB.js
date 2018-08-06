/**
 * @module ol/style/RGB
 */
import Monochrome from './Monochrome.js';
import {clamp} from '../math.js';


/**
 * @typedef {Object} Options
 * @property {module:ol/style/Monochrome} [red] The monochrome band associated to
 * the RGB composite's red channel. Default is a default monochrome style
 * with band 0.
 * @property {module:ol/style/Monochrome} [green] The monochrome band associated
 * to the RGB composite's green channel. Default is a default monochrome style
 * with band 1.
 * @property {module:ol/style/Monochrome} [blue] The monochrome band associated
 * to the RGB composite's blue channel. Default is a default monochrome style
 * with band 2.
 */


/**
 * @classdesc
 * Composite RGB raster style. Different bands are associated to every color
 * channel creating an RGB composite as a result.
 * @api
 */
class RGB {

  /**
   * @param {module:ol/style/RGB~Options=} opt_options Options.
   */
  constructor(opt_options) {

    const options = opt_options || {};

    /**
     * @private
     * @type {module:ol/style/Monochrome}
     */
    this.red_ = options.red ? options.red : Monochrome.defaultStyle(0);

    /**
     * @private
     * @type {module:ol/style/Monochrome}
     */
    this.green_ = options.green ? options.green : Monochrome.defaultStyle(1);

    /**
     * @private
     * @type {module:ol/style/Monochrome}
     */
    this.blue_ = options.blue ? options.blue : Monochrome.defaultStyle(2);
  }

  /**
   * Clones the style.
   * @return {module:ol/style/RGB} The cloned style.
   * @api
   */
  clone() {
    return new RGB({
      red: this.red_.clone(),
      green: this.green_.clone(),
      blue: this.blue_.clone()
    });
  }

  /**
   * Returns the component band indices in RGB order.
   * @return {Array.<number>} Band indices.
   * @api
   */
  getBandIndex() {
    return [this.getRed().getBandIndex(), this.getGreen().getBandIndex(),
      this.getBlue().getBandIndex()];
  }

  /**
   * Get the red channel's style.
   * @return {module:ol/style/Monochrome} Red channel's style.
   * @api
   */
  getRed() {
    return this.red_;
  }

  /**
   * Get the green channel's style.
   * @return {module:ol/style/Monochrome} Green channel's style.
   * @api
   */
  getGreen() {
    return this.green_;
  }

  /**
   * Get the blue channel's style.
   * @return {module:ol/style/Monochrome} Blue channel's style.
   * @api
   */
  getBlue() {
    return this.blue_;
  }

  /**
   * Set the red channel's style.
   * @param {module:ol/style/Monochrome} red Red channel's new style.
   * @api
   */
  setRed(red) {
    this.red_ = red;
  }

  /**
   * Set the green channel's style.
   * @param {module:ol/style/Monochrome} green Green channel's new style.
   * @api
   */
  setGreen(green) {
    this.green_ = green;
  }

  /**
   * Set the blue channel's style.
   * @param {module:ol/style/Monochrome} blue Blue channel's new style.
   * @api
   */
  setBlue(blue) {
    this.blue_ = blue;
  }

  /**
   * Fill missing values from band statistics.
   * @param {Array.<module:ol/coverage/Band>} bands Coverage bands.
   */
  fillMissingValues(bands) {
    this.getRed().fillMissingValues(bands);
    this.getGreen().fillMissingValues(bands);
    this.getBlue().fillMissingValues(bands);
  }

  /**
   * Apply this style to the specified matrices.
   * @param {Array.<Array.<number>|module:ol/typedarray~TypedArray>} matrices Aligned matrices in
   * RGB order. If a channel is missing, the order still needs to be kept (e.g. RB).
   * @param {Array.<number>} nodata NoData values.
   * @param {number} minAlpha Minimum alpha value.
   * @param {number} maxAlpha Maximum alpha value.
   * @return {Array.<number>} Styled interleaved matrix.
   */
  apply(matrices, nodata, minAlpha, maxAlpha) {
    const bandIndices = this.getBandIndex();
    let i, ii;
    for (i = 0; i < 3; ++i) {
      if (bandIndices[i] === undefined) {
        matrices.splice(i, 0, undefined);
        nodata.splice(i, 0, undefined);
      }
    }

    const refMatrix = matrices[0] ? matrices[0] : matrices[1] ? matrices[1] : matrices[2]
      ? matrices[2] : [];

    const interleaved = [];
    let k = 0;
    const redMin = this.getRed().getMin();
    const redMax = this.getRed().getMax();
    const greenMin = this.getGreen().getMin();
    const greenMax = this.getGreen().getMax();
    const blueMin = this.getBlue().getMin();
    const blueMax = this.getBlue().getMax();

    for (i = 0, ii = refMatrix.length; i < ii; ++i) {
      const redLerp = matrices[0] ? (matrices[0][i] - redMin) / (redMax - redMin) : 0;
      const greenLerp = matrices[1] ? (matrices[1][i] - greenMin) / (greenMax - greenMin) : 0;
      const blueLerp = matrices[2] ? (matrices[2][i] - blueMin) / (blueMax - blueMin) : 0;

      const redNodata = matrices[0] ? matrices[0][i] === nodata[0] : true;
      const greenNodata = matrices[1] ? matrices[1][i] === nodata[1] : true;
      const blueNodata = matrices[2] ? matrices[2][i] === nodata[2] : true;

      interleaved[k++] = clamp(Math.round(255 * redLerp), 0, 255);
      interleaved[k++] = clamp(Math.round(255 * greenLerp), 0, 255);
      interleaved[k++] = clamp(Math.round(255 * blueLerp), 0, 255);
      interleaved[k++] = redNodata && greenNodata && blueNodata ? maxAlpha : minAlpha;
    }
    return interleaved;
  }

  /**
   * @return {string} The checksum.
   */
  getChecksum() {
    return 'r' + this.getRed().getChecksum() + 'g' +
      this.getGreen().getChecksum() + 'b' + this.getBlue().getChecksum();
  }
}


export default RGB;
