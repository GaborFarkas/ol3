/**
 * @module ol/layer/Coverage
 */
import {FALSE} from '../functions.js';
import {assign} from '../obj.js';
import LayerType from '../LayerType.js';
import Layer from '../layer/Layer.js';
import Monochrome from '../style/Monochrome.js';


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
 * @property {boolean} [updateWhileAnimating=false] When set to `true`, feature
 * batches will be recreated during animations. This means that no
 * cells will be shown clipped, but the setting will have a performance impact for large
 * coverages. When set to `false`, batches will be recreated when no animation
 * is active.
 * @property {boolean} [updateWhileInteracting=false] When set to `true`,
 * feature batches will be recreated during interactions. See also
 * `updateWhileAnimating`.
 * @property {number} [strokeWidth] Cosmetic stroke width for the canvas renderer
 * in order to mask out gaps between adjacent cells. The default value is 0, if
 * the cells are rectangular and the layer is not reprojected, 1 otherwise. Note
 * that providing a floating point value severely decreases performance.
 */


/**
 * @classdesc
 * Coverage layers rendered on the client side as vectors.
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @fires module:ol/render/Event~RenderEvent
 * @api
 */
class CoverageLayer extends Layer {

  /**
   * @param {module:ol/layer/Coverage~Options=} opt_options Layer options.
   */
  constructor(opt_options) {
    const options = opt_options ? opt_options : {};

    const baseOptions = assign({}, options);

    delete baseOptions.style;
    delete baseOptions.strokeWidth;
    delete baseOptions.updateWhileAnimating;
    delete baseOptions.updateWhileInteracting;
    super(baseOptions);

    /**
     * User provided style.
     * @type {module:ol/style/Style~CoverageStyle|null}
     * @private
     */
    this.style_ = options.style !== undefined ? options.style : Monochrome.defaultStyle();

    /**
     * Cosmetic stroke width provided by the user.
     * @type {number}
     * @private
     */
    this.stroke_ = options.strokeWidth;

    /**
     * @type {boolean}
     * @private
     */
    this.updateWhileAnimating_ = options.updateWhileAnimating !== undefined ?
      options.updateWhileAnimating : false;

    /**
     * @type {boolean}
     * @private
     */
    this.updateWhileInteracting_ = options.updateWhileInteracting !== undefined ?
      options.updateWhileInteracting : false;

    /**
     * The layer type.
     * @protected
     * @type {module:ol/LayerType}
     */
    this.type = LayerType.COVERAGE;
  }

  /**
   * @return {number} Stroke width.
   */
  getStroke() {
    return this.stroke_;
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
   * @return {boolean} Whether the rendered layer should be updated while
   * animating.
   */
  getUpdateWhileAnimating() {
    return this.updateWhileAnimating_;
  }

  /**
   * @return {boolean} Whether the rendered layer should be updated while
   * interacting.
   */
  getUpdateWhileInteracting() {
    return this.updateWhileInteracting_;
  }

  /**
   * Set the style for cells. This can be a single style object. If it is
   * `undefined` the default style is used. If it is `null` the layer has no style
   * (a `null` style), so it will not be rendered. See {@link module:ol/style/Style~Style} for
   * information on the default style.
   * @param {module:ol/style/Style~CoverageStyle|null|undefined} style Layer style.
   * @api
   */
  setStyle(style) {
    this.style_ = style !== undefined ? style : Monochrome.defaultStyle();
    this.changed();
  }
}


/**
 * Dummy function for compatibility.
 * @return {boolean} False.
 */
CoverageLayer.prototype.getDeclutter = FALSE;


/**
 * Return the associated source of the raster layer.
 * @function
 * @return {module:ol/source/Coverage} Source.
 * @api
 */
CoverageLayer.prototype.getSource;


export default CoverageLayer;
