import L from 'leaflet'

//For more information use this: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
// Extend the Canvas renderer with the custom drawing function
L.Canvas.include({
    _updateMarker6Points: function (layer: any) {
        if (!this._drawing || layer._empty()) { return; }

        if (!this._drawnLayers) {
            this._drawnLayers = {};
        }

        var p = layer._point,
            ctx = this._ctx,
            r = Math.max(Math.round(layer._radius), 1);

        this._drawnLayers[layer._leaflet_id] = layer;

        ctx.beginPath();
        ctx.moveTo(p.x + r, p.y);
        ctx.lineTo(p.x + 0.43 * r, p.y + 0.25 * r);
        ctx.lineTo(p.x + 0.50 * r, p.y + 0.87 * r);
        ctx.lineTo(p.x, p.y + 0.50 * r);
        ctx.lineTo(p.x - 0.50 * r, p.y + 0.87 * r);
        ctx.lineTo(p.x - 0.43 * r, p.y + 0.25 * r);
        ctx.lineTo(p.x - r, p.y);
        ctx.lineTo(p.x - 0.43 * r, p.y - 0.25 * r);
        ctx.lineTo(p.x - 0.50 * r, p.y - 0.87 * r);
        ctx.lineTo(p.x, p.y - 0.50 * r);
        ctx.lineTo(p.x + 0.50 * r, p.y - 0.87 * r);
        ctx.lineTo(p.x + 0.43 * r, p.y - 0.25 * r);
        ctx.closePath();
        this._fillStroke(ctx, layer);
    }
});

// Extend CircleMarker to create a custom marker with a 6-point star shape
var Marker6Point = (L.CircleMarker as any).extend({
    constructor: function (latlng: L.LatLngExpression, options: L.CircleMarkerOptions) {
        (L.CircleMarker as any).prototype.initialize.call(this, latlng, options);
    },
    _updatePath: function () {
        this._renderer._updateMarker6Points(this);
    }
});

export function marker6Points(latlng: L.LatLngExpression, options?: L.CircleMarkerOptions) {
    return new Marker6Point(latlng, options)
}

// Extend the Canvas renderer with the custom drawing function for a square
L.Canvas.include({
    _updateSquareMarker: function (layer: any) {
        if (!this._drawing || layer._empty()) { return; }

        if (!this._drawnLayers) {
            this._drawnLayers = {};
        }

        var p = layer._point,
            ctx = this._ctx,
            r = Math.max(Math.round(layer._radius), 1);

        this._drawnLayers[layer._leaflet_id] = layer;

        ctx.beginPath();
        ctx.moveTo(p.x - r, p.y - r);
        ctx.lineTo(p.x + r, p.y - r);
        ctx.lineTo(p.x + r, p.y + r);
        ctx.lineTo(p.x - r, p.y + r);
        ctx.closePath();
        this._fillStroke(ctx, layer);
    }
});

// Extend CircleMarker to create a custom marker with a square shape
var SquareMarker = (L.CircleMarker as any).extend({
    initialize: function (latlng: L.LatLngExpression, options: L.CircleMarkerOptions) {
        (L.CircleMarker as any).prototype.initialize.call(this, latlng, options);
    },
    _updatePath: function () {
        this._renderer._updateSquareMarker(this);
    }
});

export function squareMarker(latlng: L.LatLngExpression, options?: L.CircleMarkerOptions) {
    return new SquareMarker(latlng, options)
}

// Extend the Canvas renderer with the custom drawing function for a diamond
L.Canvas.include({
    _updateDiamondMarker: function (layer: any) {
        if (!this._drawing || layer._empty()) { return; }

        if (!this._drawnLayers) {
            this._drawnLayers = {};
        }

        var p = layer._point,
            ctx = this._ctx,
            r = Math.max(Math.round(layer._radius), 1) * Math.sqrt(2);

        this._drawnLayers[layer._leaflet_id] = layer;

        ctx.beginPath();
        ctx.moveTo(p.x - r, p.y);
        ctx.lineTo(p.x, p.y - r);
        ctx.lineTo(p.x + r, p.y);
        ctx.lineTo(p.x, p.y + r);
        ctx.closePath();
        this._fillStroke(ctx, layer);
    }
});

// Extend CircleMarker to create a custom marker with a diamond shape
var DiamondMarker = (L.CircleMarker as any).extend({
    initialize: function (latlng: L.LatLngExpression, options: L.CircleMarkerOptions) {
        (L.CircleMarker as any).prototype.initialize.call(this, latlng, options);
    },
    _updatePath: function () {
        this._renderer._updateDiamondMarker(this);
    }
});

export function diamondMarker(latlng: L.LatLngExpression, options?: L.CircleMarkerOptions) {
    return new DiamondMarker(latlng, options)
}

// Extend the Canvas renderer with the custom drawing function for the custom shape
L.Canvas.include({
    _updateLemon: function (layer: any) {
        if (!this._drawing || layer._empty()) { return; }

        if (!this._drawnLayers) {
            this._drawnLayers = {};
        }

        var p = layer._point,
            ctx = this._ctx,
            r = Math.max(Math.round(layer._radius), 1);

        this._drawnLayers[layer._leaflet_id] = layer;

        ctx.beginPath();
        ctx.moveTo(p.x - r, p.y + r);
        ctx.lineTo(p.x - r, p.y);
        ctx.arcTo(p.x - r, p.y - r, p.x, p.y - r, r);
        ctx.lineTo(p.x + r, p.y - r);
        ctx.lineTo(p.x + r, p.y);
        ctx.arcTo(p.x + r, p.y + r, p.x, p.y + r, r);
        ctx.lineTo(p.x - r, p.y + r);
        ctx.closePath();
        this._fillStroke(ctx, layer);
    }
});

// Extend CircleMarker to create a custom marker with the custom shape
var LemonMarker = (L.CircleMarker as any).extend({
    initialize: function (latlng: L.LatLngExpression, options: L.CircleMarkerOptions) {
        (L.CircleMarker as any).prototype.initialize.call(this, latlng, options);
    },
    _updatePath: function () {
        this._renderer._updateLemon(this);
    }
});

export function lemonMarker(latlng: L.LatLngExpression, options?: L.CircleMarkerOptions) {
    return new LemonMarker(latlng, options);
}