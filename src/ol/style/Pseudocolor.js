/**
 * @module ol/style/Pseudocolor
 */
import PseudocolorMode from './PseudocolorMode.js';
import Collection from '../Collection.js';
import {assert} from '../asserts.js';
import {asArray, asString} from '../color.js';
import {getValues} from '../obj.js';
import {lerp} from '../math.js';
import {stableSort} from '../array.js';


/**
 * @typedef {Array.<module:ol/color~Color,number>} PseudocolorMap An array with
 * two values representing a single break, e.g. `[52, 'orange']`.
 */


/**
 * @typedef {Object} PseudocolorInterval
 * @property {module:ol/style/Pseudocolor~PseudocolorMap} lower
 * @property {module:ol/style/Pseudocolor~PseudocolorMap} higher
 * @property {number} range
 */


/**
 * @typedef {Object} Options
 * @property {number} [min] Minimum cell value. Lower cell values are automatically
 * clamped to 0. Default value is the calculated minimum of the styled band.
 * @property {number} [max] Maximum cell value. Higher cell values are automatically
 * clamped to 255. Default value is the calculated maximum of the styled band.
 * @property {number} [band=0] Band index.
 * @property {module:ol/color~Color|module:ol/colorlike~ColorLike} [startColor="black"] Start color.
 * @property {module:ol/color~Color|module:ol/colorlike~ColorLike} [endColor="white"] End color.
 * @property {module:ol/style/PseudocolorMode} [mode="interpolate"] Pseudocolor
 * styling mode. Currently supported types are `'categorized'` and
 * `'interpolate'`. The interpolate mode interpolates colors between edge values
 * and breakpoints in a linear fashion. In categorized mode, an interval has a
 * single color. In this mode, apart from the maximum value, an interval's
 * lower value is inclusive, while the upper value is exclusive.
 * @property {Array.<module:ol/style/Pseudocolor~PseudocolorMap>} [breakpoints]
 * Additional breakpoints defined with color maps having a value and a color.
 */


/**
 * @classdesc
 * Single band pseudocolor raster style. Cell values are transformed to colors
 * according to the style's or band's minimum and maximum values, the mode,
 * and the provided colors and intervals.
 * @api
 */
class Pseudocolor {

  /**
   * @param {module:ol/style/Pseudocolor~Options=} opt_options Options.
   */
  constructor(opt_options) {

    const options = opt_options || {};

    /**
     * @private
     * @type {number|undefined}
     */
    this.min_ = options.min;

    /**
     * @private
     * @type {number|undefined}
     */
    this.max_ = options.max;

    /**
     * @private
     * @type {number|undefined}
     */
    this.band_ = options.band !== undefined ? options.band : 0;

    /**
     * @private
     * @type {module:ol/color~Color|module:ol/colorlike~ColorLike}
     */
    this.startColor_ = options.startColor !== undefined ? options.startColor :
      [0, 0, 0, 1];

    /**
     * @private
     * @type {module:ol/color~Color|module:ol/colorlike~ColorLike}
     */
    this.endColor_ = options.endColor !== undefined ? options.endColor :
      [255, 255, 255, 1];

    /**
     * @private
     * @type {module:ol/style/PseudocolorMode}
     */
    this.mode_ = options.mode ? options.mode : PseudocolorMode.INTERPOLATE;

    /**
     * @private
     * @type {module:ol/Collection.<module:ol/style/Pseudocolor~PseudocolorMap>}
     */
    this.breakpoints_ = new Collection();

    if (Array.isArray(options.breakpoints)) {
      let i, ii;
      for (i = 0, ii = options.breakpoints.length; i < ii; ++i) {
        this.addBreakpoint(options.breakpoints[i]);
      }
    }

    /**
     * @private
     * @type {string|undefined}
     */
    this.checksum_ = undefined;
  }

  /**
   * Adds a breakpoint to the breakpoint list.
   * @param {module:ol/style/Pseudocolor~PseudocolorMap} breakpoint Breakpoint.
   * @api
   */
  addBreakpoint(breakpoint) {
    assert(Array.isArray(breakpoint) && breakpoint.length === 2 &&
        typeof breakpoint[0] === 'number', 65);
    this.breakpoints_.push([breakpoint[0], asArray(breakpoint[1])]);
    this.checksum_ = undefined;
  }

  /**
   * Removes a provided breakpoint or the breakpoint at the provided index.
   * @param {module:ol/style/Pseudocolor~PseudocolorMap|number} breakpoint Breakpoint element or index.
   * @api
   */
  removeBreakpoint(breakpoint) {
    if (Array.isArray(breakpoint)) {
      this.breakpoints_.remove(breakpoint);
      this.checksum_ = undefined;
    } else if (breakpoint) {
      this.breakpoints_.removeAt(breakpoint);
      this.checksum_ = undefined;
    }
  }

  /**
   * Clears the breakpoint list associated with this style.
   * @api
   */
  clearBreakpoints() {
    this.breakpoints_.clear();
    this.checksum_ = undefined;
  }

  /**
   * Clones the style.
   * @return {module:ol/style/Pseudocolor} The cloned style.
   * @api
   */
  clone() {
    const breakpoints = this.getBreakpoints();
    const newBreakpoints = [];
    if (breakpoints.length) {
      for (let i = 0; i < breakpoints.length; ++i) {
        const breakpoint = breakpoints[i];
        const colorArr = breakpoint.color.slice();
        newBreakpoints.push([breakpoint[0], colorArr]);
      }
    }
    const startCol = asArray(this.startColor_).slice(0);
    const endCol = asArray(this.endColor_).slice(0);
    return new Pseudocolor({
      min: this.getMin(),
      max: this.getMax(),
      band: this.getBandIndex(),
      startColor: startCol,
      endColor: endCol,
      mode: this.getMode(),
      breakpoints: newBreakpoints
    });
  }

  /**
   * Get the minimum value.
   * @return {number|undefined} Minimum value.
   * @api
   */
  getMin() {
    return this.min_;
  }

  /**
   * Get the maximum value.
   * @return {number|undefined} Maximum value.
   * @api
   */
  getMax() {
    return this.max_;
  }

  /**
   * Get the styled band's index.
   * @return {number|undefined} Band index.
   * @api
   */
  getBandIndex() {
    return this.band_;
  }

  /**
   * Get the starting color.
   * @return {module:ol/color~Color|module:ol/colorlike~ColorLike} Start color.
   * @api
   */
  getStartColor() {
    return this.startColor_;
  }

  /**
   * Get the ending color.
   * @return {module:ol/color~Color|module:ol/colorlike~ColorLike} End color.
   * @api
   */
  getEndColor() {
    return this.endColor_;
  }

  /**
   * Get the coloring mode.
   * @return {module:ol/style/PseudocolorMode} Mode.
   * @api
   */
  getMode() {
    return this.mode_;
  }

  /**
   * Get the additional breakpoints.
   * @return {Array.<module:ol/style/Pseudocolor~PseudocolorMap>} Color map.
   * @api
   */
  getBreakpoints() {
    return this.breakpoints_.getArray().slice();
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
   * Set the starting color.
   * @param {module:ol/color~Color|module:ol/colorlike~ColorLike} color New start color.
   * @api
   */
  setStartColor(color) {
    this.startColor_ = color;
    this.checksum_ = undefined;
  }

  /**
   * Set the ending color.
   * @param {module:ol/color~Color|module:ol/colorlike~ColorLike} color New end color.
   * @api
   */
  setEndColor(color) {
    this.endColor_ = color;
    this.checksum_ = undefined;
  }

  /**
   * Set the coloring mode.
   * @param {module:ol/style/PseudocolorMode} mode Mode.
   * @api
   */
  setMode(mode) {
    const valid = getValues(PseudocolorMode);
    assert(valid.indexOf(mode) !== -1, 62);
    this.mode_ = mode;
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
    let i, ii, j;
    let min = this.getMin();
    if (typeof min !== 'number') {
      min = Math.min.apply(matrix);
    }
    let max = this.getMax();
    if (typeof max !== 'number') {
      max = Math.max.apply(matrix);
    }
    const intervals = this.createIntervals_(min, max);
    const jj = intervals.length;
    const categorized = this.getMode() === PseudocolorMode.CATEGORIZED;

    for (i = 0, ii = matrix.length; i < ii; ++i) {
      //TODO: Make clipping out of range data optional.
      if (matrix[i] < min || matrix[i] > max) {
        const value = matrix[i] < min ? 0 : 255;
        interleaved[k++] = value;
        interleaved[k++] = value;
        interleaved[k++] = value;
      } else {
        for (j = 0; j < jj; ++j) {
          if (matrix[i] <= intervals[j].higher[0]) {
            if (categorized) {
              interleaved[k++] = intervals[j].lower[1][0];
              interleaved[k++] = intervals[j].lower[1][1];
              interleaved[k++] = intervals[j].lower[1][2];
            } else {
              const ratio = (matrix[i] - intervals[j].lower[0]) / intervals[j].range;
              interleaved[k++] = lerp(intervals[j].lower[1][0],
                intervals[j].higher[1][0], ratio);
              interleaved[k++] = lerp(intervals[j].lower[1][1],
                intervals[j].higher[1][1], ratio);
              interleaved[k++] = lerp(intervals[j].lower[1][2],
                intervals[j].higher[1][2], ratio);
            }
            break;
          }
        }
      }
      interleaved[k++] = matrix[i] === nodata ? maxAlpha : minAlpha;
    }
    return interleaved;
  }

  /**
   * @return {string} The checksum.
   */
  getChecksum() {
    if (this.checksum_ === undefined) {
      this.checksum_ = 'p';
      if (this.getBandIndex() !== undefined) {
        this.checksum_ += this.getBandIndex().toString() + ',' +
        this.getMode() + ',' +
        this.getMin() !== undefined ? this.getMin().toString() : '-' + ',' +
        this.getStartColor() ? asString(this.getStartColor()) : '-' + ',' +
        this.getMax() !== undefined ? this.getMax().toString() : '-' +
        this.getEndColor() ? asString(this.getEndColor()) : '-' + ',';
        if (this.getBreakpoints().length) {
          let i, ii;
          const breakpoints = this.getBreakpoints();
          this.checksum_ += '(';
          for (i = 0, ii = breakpoints.length; i < ii; ++i) {
            this.checksum_ += breakpoints[i][0].toString() + ',' +
            asString(breakpoints[i][1]) + ',';
          }
          this.checksum_ = this.checksum_.slice(0, -1);
          this.checksum_ += ')';
        } else {
          this.checksum_ += '-';
        }
      } else {
        this.checksum_ += '-';
      }
    }

    return this.checksum_;
  }

  /**
   * @private
   * @param {number} min Min.
   * @param {number} max Max.
   * @return {Array.<module:ol/style/Pseudocolor~PseudocolorInterval>} Intervals.
   */
  createIntervals_(min, max) {
    const intervals = [];
    const sColor = asArray(this.getStartColor());
    const eColor = asArray(this.getEndColor());
    let prev = [min, sColor];
    let i, ii;
    const breakpoints = this.getBreakpoints();
    if (breakpoints.length) {
      stableSort(breakpoints, function(a, b) {
        return a[0] - b[0];
      });
      //TODO: Use a linked list.
      for (i = 0, ii = breakpoints.length; i < ii; ++i) {
        const p = breakpoints[i];
        // Start and end colors take precedence.
        if (p[0] > min && p[0] < max) {
          intervals.push({
            lower: prev,
            higher: p,
            range: p[0] - prev[0]
          });
          prev = p;
        }
      }
    }
    intervals.push({
      lower: prev,
      higher: [max, eColor],
      range: max - prev[0]
    });
    return intervals;
  }
}


export default Pseudocolor;
