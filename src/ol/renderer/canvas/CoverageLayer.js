/**
 * @module ol/renderer/canvas/CoverageLayer
 */
import CanvasVectorLayerRenderer from './VectorLayer.js';
import LayerType from '../../LayerType.js';
import ViewHint from '../../ViewHint.js';
import {containsExtent, getWidth, buffer, containsCoordinate} from '../../extent.js';
import CanvasReplayGroup from '../../render/canvas/ReplayGroup.js';
import {getTolerance, createGrid, renderCoverage} from '../coverage.js';
import CoverageType from '../../coverage/CoverageType.js';
import {deflateCoordinates} from '../../geom/flat/deflate.js';
import {scale} from '../../geom/flat/transform.js';
import {equivalent, transformExtent} from '../../proj.js';
import Stroke from '../../style/Stroke.js';
import State from '../../source/State.js';

/**
 * @classdesc
 * Canvas renderer for coverage layers.
 * @api
 */
class CanvasCoverageLayerRenderer extends CanvasVectorLayerRenderer {

  /**
   * @param {module:ol/layer/Coverage} coverageLayer Coverage layer.
   */
  constructor(coverageLayer) {

    super(coverageLayer);

    /**
     * @private
     * @type {string|undefined}
     */
    this.renderedChecksum_ = undefined;

    /**
     * @private
     * @type {number|undefined}
     */
    this.renderedSourceRevision_ = undefined;

    /**
     * @private
     * @type {number|undefined}
     */
    this.buffer_ = undefined;

    /**
     * @private
     * @type {module:ol/structs/RBush}
     */
    this.coverageCache_ = undefined;

    /**
     * @private
     * @type {number|undefined}
     */
    this.numVertices_ = undefined;
  }

  /**
   * @inheritDoc
   */
  forEachFeatureAtCoordinate(coordinate, frameState, hitTolerance, callback, thisArg) {
    const coverageLayer = /** @type {module:ol/layer/Coverage} */ (this.getLayer());
    const coverageSource = coverageLayer.getSource();

    if (coverageSource.getState() === State.READY) {
      const projection = frameState.viewState.projection;
      const sourceProjection = coverageSource.getProjection();

      const coverageExtent = equivalent(projection, sourceProjection) ?
        coverageSource.getExtent() : transformExtent(coverageSource.getExtent(),
          sourceProjection, projection);

      if (containsCoordinate(coverageExtent, coordinate)) {
        return true;
      }
    }

    return false;
  }

  /**
   * @inheritDoc
   */
  prepareFrame(frameState, layerState) {

    const coverageLayer = /** @type {module:ol/layer/Coverage} */ (this.getLayer());
    const coverageSource = coverageLayer.getSource();

    const style = coverageLayer.getStyle();
    if (!style) {
      return false;
    } else if (this.renderedChecksum_ !== style.getChecksum()) {
      style.fillMissingValues(coverageSource.getBands());
    }

    const animating = frameState.viewHints[ViewHint.ANIMATING];
    const interacting = frameState.viewHints[ViewHint.INTERACTING];
    const updateWhileAnimating = coverageLayer.getUpdateWhileAnimating();
    const updateWhileInteracting = coverageLayer.getUpdateWhileInteracting();

    if ((!updateWhileAnimating && animating) ||
        (!updateWhileInteracting && interacting)) {
      return true;
    }

    const extent = frameState.extent;
    const viewState = frameState.viewState;
    const projection = viewState.projection;
    const resolution = viewState.resolution;
    const pixelRatio = frameState.pixelRatio;
    const coverageLayerRevision = coverageLayer.getRevision();
    const projectionExtent = viewState.projection.getExtent();

    if (coverageSource.getWrapX() && viewState.projection.canWrapX() &&
        !containsExtent(projectionExtent, frameState.extent)) {
      // For the replay group, we need an extent that intersects the real world
      // (-180° to +180°). To support geometries in a coordinate range from -540°
      // to +540°, we add at least 1 world width on each side of the projection
      // extent. If the viewport is wider than the world, we need to add half of
      // the viewport width to make sure we cover the whole viewport.
      const worldWidth = getWidth(projectionExtent);
      const gutter = Math.max(getWidth(extent) / 2, worldWidth);
      extent[0] = projectionExtent[0] - gutter;
      extent[2] = projectionExtent[2] + gutter;
    }

    if (this.renderedResolution == resolution &&
        this.renderedRevision == coverageLayerRevision &&
        containsExtent(this.renderedExtent, extent)) {
      this.replayGroupChanged = false;
      return true;
    }

    this.replayGroup = null;

    const replayGroup = new CanvasReplayGroup(getTolerance(resolution, pixelRatio),
      extent, resolution, pixelRatio, false, undefined, 0);

    const type = coverageSource.getType() || CoverageType.RECTANGULAR;
    if (this.renderedChecksum_ != style.getChecksum() ||
      this.renderedSourceRevision_ != coverageSource.getRevision()) {

      const styledCoverage = coverageSource.getStyledBand(style, 1, 0);
      if (!styledCoverage) {
        return false;
      }
      const pattern = coverageSource.getPattern();
      const cellCoords = this.getCellCoordinates_(type,
        styledCoverage.getResolution(), pattern);
      const vertices = cellCoords.length;
      const rtree = createGrid(styledCoverage, cellCoords, type,
        coverageSource.getProjection(), projection, 0, pattern);

      this.renderedChecksum_ = style.getChecksum();
      this.renderedSourceRevision_ = coverageSource.getRevision();
      this.buffer_ = Math.max.apply(null, styledCoverage.getResolution());
      this.coverageCache_ = rtree;
      this.numVertices_ = vertices;
    }

    const flatCoverage = [];
    const bufferedExtent = buffer(extent, this.buffer_);
    deflateCoordinates(flatCoverage, 0,
      this.coverageCache_.getInExtent(bufferedExtent), this.numVertices_ + 4);
    if (!flatCoverage.length) {
      return false;
    }

    const strokeWidth = coverageLayer.getStroke() !== undefined ? coverageLayer.getStroke() :
      type !== CoverageType.RECTANGULAR || !equivalent(
        coverageSource.getProjection(), projection) ? 1 : 0;
    const stroke = strokeWidth !== 0 ? new Stroke({
      width: strokeWidth
    }) : undefined;
    renderCoverage(replayGroup, flatCoverage, this.numVertices_, stroke);
    replayGroup.finish();

    this.renderedResolution = resolution;
    this.renderedRevision = coverageLayerRevision;
    this.renderedExtent = extent;
    this.replayGroup = replayGroup;

    this.replayGroupChanged = true;
    return true;
  }

  /**
   * @private
   * @param {module:ol/coverage/CoverageType} type Coverage type.
   * @param {module:ol/size~Size} resolution Cell resolution.
   * @param {module:ol/source/Coverage~CoveragePattern} pattern Coverage pattern.
   * @return {Array.<number>} Cell coordinates relative to centroid.
   */
  getCellCoordinates_(type, resolution, pattern) {
    const halfX = resolution[0] / 2;
    const halfY = resolution[1] / 2;
    switch (type) {
      case CoverageType.HEXAGONAL:
        const fourthY = halfY / 2;
        return [-halfX, -fourthY, 0, -halfY, halfX, -fourthY, halfX, fourthY,
          0, halfY, -halfX, fourthY];
      case CoverageType.CUSTOM:
        const shape = [];
        deflateCoordinates(shape, 0, pattern.shape, 2);
        return scale(shape, 0, shape.length, 2, resolution[0], resolution[1],
          [0, 0]);
      // Default type is CoverageType.RECTANGULAR.
      default:
        return [-halfX, -halfY, halfX, -halfY, halfX, halfY, -halfX, halfY];
    }
  }
}


/**
 * Determine if this renderer handles the provided layer.
 * @param {module:ol/layer/Layer} layer The candidate layer.
 * @return {boolean} The renderer can render the layer.
 */
CanvasCoverageLayerRenderer['handles'] = function(layer) {
  return layer.getType() === LayerType.COVERAGE;
};


/**
 * Create a layer renderer.
 * @param {module:ol/renderer/Map} mapRenderer The map renderer.
 * @param {module:ol/layer/Layer} layer The layer to be rendererd.
 * @return {module:ol/renderer/canvas/CoverageLayer} The layer renderer.
 */
CanvasCoverageLayerRenderer['create'] = function(mapRenderer, layer) {
  return new CanvasCoverageLayerRenderer(/** @type {module:ol/layer/Coverage} */ (layer));
};


export default CanvasCoverageLayerRenderer;