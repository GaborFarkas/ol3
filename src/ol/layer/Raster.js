/**
 * @module ol/layer/Raster
 */
import ImageLayer from '../layer/Image.js';
import Monochrome from '../style/Monochrome.js';
import {assign} from '../obj.js';


/**
 * @typedef {Object} Options
 * @property {number} [opacity=1] Opacity (0, 1).
 * @property {boolean} [visible=true] Visibility.
 * @property {module:ol/extent~Extent} [extent] The bounding extent for layer rendering.  The layer will not be
 * rendered outside of this extent.
 * @property {number} [zIndex=0] The z-index for layer rendering.  At rendering time, the layers
 * will be ordered, first by Z-index and then by position.
 * @property {number} [minResolution] The minimum resolution (inclusive) at which this layer will be
 * visible.
 * @property {number} [maxResolution] The maximum resolution (exclusive) below which this layer will
 * be visible.
 * @property {module:ol/PluggableMap} [map] Sets the layer as overlay on a map. The map will not manage
 * this layer in its layers collection, and the layer will be rendered on top. This is useful for
 * temporary layers. The standard way to add a layer to a map and have it managed by the map is to
 * use {@link module:ol/Map#addLayer}.
 * @property {module:ol/source/Coverage} [source] Source for this layer.
 * @property {module:ol/style/Style~CoverageStyle} [style] Layer style. See
 * {@link module:ol/style/Style~Style} for default style which will be used if this is not defined.
 * @property {module:ol/coverage/Image~FunctionType} [coverageDrawFunction] A
 * custom function for drawing the styled cells on a canvas. It gets styled
 * raster data in an interleaved array (RGBA for each cell), the number of
 * columns as a number, the X and Y resolutions of each cell as an array, and the
 * pixel ratio. The function must return a HTML5 Canvas element.
 */


/**
 * @classdesc
 * Coverage data rendered as a traditional raster layer.
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @fires module:ol/render/Event~RenderEvent
 * @api
 */
class RasterLayer extends ImageLayer {

  /**
   * @param {module:ol/layer/Raster~Options=} opt_options Layer options.
   */
  constructor(opt_options) {
    const options = opt_options ? opt_options : {};

    const baseOptions = assign({}, options);

    delete baseOptions.style;
    delete baseOptions.coverageDrawFunction;
    super(baseOptions);

    /**
     * User provided style.
     * @type {module:ol/style/Style~CoverageStyle|null}
     * @private
     */
    this.style_ = null;

    /**
     * User provided coverage draw function.
     * @type {module:ol/coverage/Image~FunctionType|null}
     * @private
     */
    this.coverageDrawFunction_ = null;

    this.setStyle(options.style);
    this.setCoverageDrawFunction(options.coverageDrawFunction);
  }

  /**
   * Returns the coverage draw function associated to this layer, if any.
   * @return {module:ol/coverage/Image~FunctionType|null} Coverage draw function.
   * @api
   */
  getCoverageDrawFunction() {
    return this.coverageDrawFunction_;
  }

  /**
   * Get the style for cells. This returns whatever was passed to the `style`
   * option at construction or to the `setStyle` method.
   * @return {module:ol/style/Style~CoverageStyle|null} Layer style.
   * @api
   */
  getStyle() {
    return this.style_;
  }

  /**
   * Set the coverage draw function, which is a function getting styled coverage
   * data with basic coverage properties, and expecting a HTML5 Canvas element
   * as a result.
   * @param {module:ol/coverage/Image~FunctionType} coverageDrawFunc Coverage draw function.
   * @api
   */
  setCoverageDrawFunction(coverageDrawFunc) {
    this.coverageDrawFunction_ = coverageDrawFunc !== undefined ?
      coverageDrawFunc : null;
    if (this.getSource()) {
      this.getSource().setCoverageDrawFunction(this.coverageDrawFunction_);
    }
    this.changed();
  }

  /**
   * Set the style for cells.  This can be a single style object. If it is
   *`undefined` the default style is used. If it is `null` the layer has no style
   * (a `null` style), so it will not be rendered. See {@link module:ol/style/Style~Style} for
   * information on the default style.
   * @param {module:ol/style/Style~CoverageStyle|null|undefined} style Layer style.
   * @api
   */
  setStyle(style) {
    this.style_ = style !== undefined ? style : Monochrome.defaultStyle();
    if (this.getSource()) {
      this.getSource().setStyle(this.style_);
    }
    this.changed();
  }

  /**
   * @inheritDoc
   */
  setSource(source) {
    super.setSource(source);
    source.setStyle(this.getStyle());
    source.setCoverageDrawFunction(this.getCoverageDrawFunction());
  }
}


/**
 * Return the associated source of the raster layer.
 * @function
 * @return {module:ol/source/Coverage} Source.
 * @api
 */
RasterLayer.prototype.getSource;


export default RasterLayer;
