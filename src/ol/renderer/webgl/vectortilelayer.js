goog.provide('ol.renderer.webgl.VectorTileLayer');

goog.require('ol');
goog.require('ol.dom');
goog.require('ol.extent');
goog.require('ol.proj');
goog.require('ol.proj.Units');
goog.require('ol.layer.VectorTileRenderType');
goog.require('ol.render.ReplayType');
goog.require('ol.render.webgl.ReplayGroup');
goog.require('ol.render.replay');
goog.require('ol.renderer.webgl.TileLayer');
goog.require('ol.renderer.vector');
goog.require('ol.size');
goog.require('ol.transform');


if (ol.ENABLE_WEBGL) {

  /**
   * @constructor
   * @extends {ol.renderer.webl.TileLayer}
   * @param {ol.renderer.webgl.Map} mapRenderer Map renderer.
   * @param {ol.layer.VectorTile} layer VectorTile layer.
   */
  ol.renderer.webgl.VectorTileLayer = function(mapRenderer, layer) {

    this.context = null;

    ol.renderer.webgl.TileLayer.call(this, mapRenderer, layer);

    /**
     * @private
     * @type {boolean}
     */
    this.dirty_ = false;

    /**
     * @private
     * @type {number}
     */
    this.renderedLayerRevision_;

    /**
     * @private
     * @type {ol.Extent}
     */
    this.tmpExtent_;

    // Use lower resolution for pure vector rendering. Closest resolution otherwise.
    this.zDirection =
        layer.getRenderMode() == ol.layer.VectorTileRenderType.VECTOR ? 1 : 0;

  };
  ol.inherits(ol.renderer.webgl.VectorTileLayer, ol.renderer.webgl.TileLayer);


  /**
   * @const
   * @type {!Object.<string, Array.<ol.render.ReplayType>>}
   */
  ol.renderer.webgl.VectorTileLayer.IMAGE_REPLAYS = {
    'image': ol.render.replay.ORDER,
    'hybrid': [ol.render.ReplayType.POLYGON, ol.render.ReplayType.LINE_STRING]
  };


  /**
   * @const
   * @type {!Object.<string, Array.<ol.render.ReplayType>>}
   */
  ol.renderer.webgl.VectorTileLayer.VECTOR_REPLAYS = {
    'hybrid': [ol.render.ReplayType.IMAGE, ol.render.ReplayType.TEXT],
    'vector': ol.render.replay.ORDER
  };


  /**
   * @inheritDoc
   */
  ol.renderer.webgl.VectorTileLayer.prototype.prepareFrame = function(frameState, layerState, context) {
    var layer = this.getLayer();
    var layerRevision = layer.getRevision();
    var viewState = frameState.viewState;
    this.tmpExtent_ = ol.extent.buffer(frameState.extent,
        layer.getRenderBuffer() * viewState.resolution);
    /*if (this.renderedLayerRevision_ != layerRevision) {
      var renderMode = layer.getRenderMode();
      if (!this.context && renderMode != ol.layer.VectorTileRenderType.VECTOR) {
        this.context = ol.dom.createCanvasContext2D();
      }
      if (this.context && renderMode == ol.layer.VectorTileRenderType.VECTOR) {
        this.context = null;
      }
    }*/
    this.renderedLayerRevision_ = layerRevision;
    return ol.renderer.webgl.TileLayer.prototype.prepareFrame.apply(this, arguments);
  };


  /**
   * @inheritDoc
   */
  ol.renderer.webgl.VectorTileLayer.prototype.drawTileImage = function(
      tile, frameState, gl, tileOffset, pixelSize, pixelRatio, gutter) {
    var vectorTile = /** @type {ol.VectorTile} */ (tile);
    var context = this.mapRenderer.getContext();

    this.createReplayGroup_(vectorTile, frameState, context);
    /*if (this.context) {
      this.renderTileImage_(vectorTile, frameState, layerState);
      ol.renderer.webgl.TileLayer.prototype.drawTileImage.apply(this, arguments);
    }*/
  };


  /**
   * @inheritDoc
   */
  ol.renderer.webgl.VectorTileLayer.prototype.composeFrame = function(frameState, layerState, context) {

    var layer = this.getLayer();
    var source = /** @type {ol.source.VectorTile} */ (layer.getSource());
    var viewState = frameState.viewState;
    var pixelRatio = frameState.pixelRatio;
    var size = frameState.size;//ol.size.toSize(this.tilePixelSize_);

    for (var i = 0, ii = this.renderedTiles_.length; i < ii; ++i) {
      var tile = this.renderedTiles_[i];
      var replayGroup = tile.getReplayState().replayGroup;
      var center = viewState.center;
      var transform = this.getReplayTransform_(tile, frameState);

      if (replayGroup && !replayGroup.isEmpty()) {
        replayGroup.replay(context,
            center, viewState.resolution, viewState.rotation,
            size, pixelRatio, layerState.opacity, {}, transform);
      }
    }
  };


  /**
   * @param {ol.VectorTile} tile Tile.
   * @param {olx.FrameState} frameState Frame state.
   * @param {ol.WebGLRenderingContext} context Context.
   * @private
   */
  ol.renderer.webgl.VectorTileLayer.prototype.createReplayGroup_ = function(tile,
      frameState, context) {
    var layer = this.getLayer();
    var pixelRatio = frameState.pixelRatio;
    var projection = frameState.viewState.projection;
    var revision = layer.getRevision();
    var renderOrder = layer.getRenderOrder() || null;

    var replayState = tile.getReplayState();
    if (!replayState.dirty && replayState.renderedRevision == revision &&
        replayState.renderedRenderOrder == renderOrder) {
      return;
    }

    replayState.replayGroup = null;
    replayState.dirty = false;

    var source = /** @type {ol.source.VectorTile} */ (layer.getSource());
    var tileGrid = source.getTileGrid();
    var tileCoord = tile.tileCoord;
    var tileProjection = tile.getProjection();
    var resolution = tileGrid.getResolution(tileCoord[0]);
    var extent, reproject, tileResolution;

    if (tileProjection.getUnits() == ol.proj.Units.TILE_PIXELS) {
      var tilePixelRatio = tileResolution = source.getTilePixelRatio();
      var tileSize = ol.size.toSize(tileGrid.getTileSize(tileCoord[0]));
      extent = [0, 0, tileSize[0] * tilePixelRatio, tileSize[1] * tilePixelRatio];
    } else {
      tileResolution = resolution;
      extent = tileGrid.getTileCoordExtent(tileCoord);
      if (!ol.proj.equivalent(projection, tileProjection)) {
        reproject = true;
        tile.setProjection(projection);
      }
    }
    replayState.dirty = false;
    var replayGroup = new ol.render.webgl.ReplayGroup(
        ol.renderer.vector.getTolerance(tileResolution, pixelRatio),
        extent, layer.getRenderBuffer());

    /**
     * @param {ol.Feature|ol.render.Feature} feature Feature.
     * @this {ol.renderer.webgl.VectorTileLayer}
     */
    function renderFeature(feature) {
      var styles;
      var styleFunction = feature.getStyleFunction();
      if (styleFunction) {
        styles = styleFunction.call(/** @type {ol.Feature} */ (feature), resolution);
      } else {
        styleFunction = layer.getStyleFunction();
        if (styleFunction) {
          styles = styleFunction(feature, resolution);
        }
      }
      if (styles) {
        if (!Array.isArray(styles)) {
          styles = [styles];
        }
        var dirty = this.renderFeature(feature, tileResolution, pixelRatio, styles,
            replayGroup);
        this.dirty_ = this.dirty_ || dirty;
        replayState.dirty = replayState.dirty || dirty;
      }
    }

    var features = tile.getFeatures();
    if (renderOrder && renderOrder !== replayState.renderedRenderOrder) {
      features.sort(renderOrder);
    }
    var feature;
    for (var i = 0, ii = features.length; i < ii; ++i) {
      feature = features[i];
      if (reproject) {
        feature.getGeometry().transform(tileProjection, projection);
      }
      renderFeature.call(this, feature);
    }

    replayGroup.finish(context);

    replayState.renderedRevision = revision;
    replayState.renderedRenderOrder = renderOrder;
    replayState.replayGroup = replayGroup;
    replayState.resolution = NaN;
  };


  /**
   * @param {ol.Feature} feature Feature.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {(ol.style.Style|Array.<ol.style.Style>)} styles The style or array of
   *     styles.
   * @param {ol.render.webgl.ReplayGroup} replayGroup Replay group.
   * @return {boolean} `true` if an image is loading.
   */
  ol.renderer.webgl.VectorTileLayer.prototype.renderFeature = function(feature, resolution, pixelRatio, styles, replayGroup) {
    if (!styles) {
      return false;
    }
    var loading = false;
    if (Array.isArray(styles)) {
      for (var i = styles.length - 1, ii = 0; i >= ii; --i) {
        loading = ol.renderer.vector.renderFeature(
            replayGroup, feature, styles[i],
            ol.renderer.vector.getSquaredTolerance(resolution, pixelRatio),
            this.handleStyleImageChange_, this) || loading;
      }
    } else {
      loading = ol.renderer.vector.renderFeature(
          replayGroup, feature, styles,
          ol.renderer.vector.getSquaredTolerance(resolution, pixelRatio),
          this.handleStyleImageChange_, this) || loading;
    }
    return loading;
  };


  /**
   * @inheritDoc
   */
  ol.renderer.webgl.VectorTileLayer.prototype.setUpProgram = function(context, gl) {
    return undefined;
  };


  /**
   * @inheritDoc
   */
  ol.renderer.webgl.VectorTileLayer.prototype.tilePyramidCallback = function(tile,
      tileGrid, pixelRatio) {
    return undefined;
  };


  /**
   * @inheritDoc
   */
  ol.renderer.webgl.VectorTileLayer.prototype.isTileLoaded = function(tile) {
    return true;
  };


  /**
   * @inheritDoc
   */
  ol.renderer.webgl.VectorTileLayer.prototype.createLoadedTileFinder = function(source, projection, tiles) {
    return (
        /**
         * @param {number} zoom Zoom level.
         * @param {ol.TileRange} tileRange Tile range.
         * @return {boolean} The tile range is fully loaded.
         */
        function(zoom, tileRange) {
          function callback(tile) {
            if (!tiles[zoom]) {
              tiles[zoom] = {};
            }
            tiles[zoom][tile.tileCoord.toString()] = tile;
            return true;
          }
          return source.forEachLoadedTile(projection, zoom, tileRange, callback);
        });
  };


  /**
   * @param {ol.Tile} tile Tile.
   * @param {olx.FrameState} frameState Frame state.
   * @return {ol.Transform} transform Transform.
   * @private
   */
  ol.renderer.webgl.VectorTileLayer.prototype.getReplayTransform_ = function(tile, frameState) {
    if (tile.getProjection().getUnits() == ol.proj.Units.TILE_PIXELS) {
      var layer = this.getLayer();
      var source = /** @type {ol.source.VectorTile} */ (layer.getSource());
      var tileGrid = source.getTileGrid();
      var tileCoord = tile.tileCoord;
      var tileResolution =
          tileGrid.getResolution(tileCoord[0]) / source.getTilePixelRatio();
      var viewState = frameState.viewState;
      var pixelRatio = frameState.pixelRatio;
      var renderResolution = viewState.resolution / pixelRatio;
      var tileExtent = tileGrid.getTileCoordExtent(tileCoord);
      var center = viewState.center;
      var origin = ol.extent.getTopLeft(tileExtent);
      var size = frameState.size;
      var offsetX = Math.round(pixelRatio * size[0] / 2);
      var offsetY = Math.round(pixelRatio * size[1] / 2);
      var transform = ol.transform.compose(ol.transform.create(),
          offsetX, offsetY,
          tileResolution / renderResolution, tileResolution / renderResolution,
          viewState.rotation,
          (origin[0] - center[0]) / tileResolution,
          (center[1] - origin[1]) / tileResolution);
      return ol.transform.scale(transform, 2 / (pixelRatio * size[0]), 2 / (pixelRatio * size[1]));
    }
  };
}
