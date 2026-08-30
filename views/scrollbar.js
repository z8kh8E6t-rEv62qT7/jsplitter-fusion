(function (ns) {
    'use strict';

    function Scrollbar(getValue, setValue, orientation, lineStep) {
        this.getValue = getValue;
        this.setValue = setValue;
        this.orientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
        this.lineStep = lineStep == null ? 1 : lineStep;
        this.rect = null;
        this.trackRect = null;
        this.startButton = null;
        this.endButton = null;
        this.total = 0;
        this.visible = 0;
        this.thumb = null;
        this.dragging = false;
        this.dragOffset = 0;
        this.pressedButton = '';
    }

    Scrollbar.prototype.configure = function (rect, total, visible) {
        this.rect = rect;
        this.total = Math.max(0, Number(total) || 0);
        this.visible = Math.max(0, Number(visible) || 0);
        var current = Number(this.getValue()) || 0;
        var value = ns.Util.clamp(current, 0, this.max());
        if (value !== current) this.setValue(value);
        this.updateGeometry();
    };

    Scrollbar.prototype.max = function () {
        return Math.max(0, this.total - this.visible);
    };

    Scrollbar.prototype.trackLength = function () {
        if (!this.trackRect) return 0;
        return this.orientation === 'horizontal' ? this.trackRect.w : this.trackRect.h;
    };

    Scrollbar.prototype.axisPosition = function (x, y) {
        return this.orientation === 'horizontal' ? x : y;
    };

    Scrollbar.prototype.thumbStart = function () {
        if (!this.thumb) return 0;
        return this.orientation === 'horizontal' ? this.thumb.x : this.thumb.y;
    };

    Scrollbar.prototype.thumbLength = function () {
        if (!this.thumb) return 0;
        return this.orientation === 'horizontal' ? this.thumb.w : this.thumb.h;
    };

    Scrollbar.prototype.updateGeometry = function () {
        if (!this.rect || this.rect.w <= 0 || this.rect.h <= 0) {
            this.trackRect = null;
            this.startButton = null;
            this.endButton = null;
            this.thumb = null;
            return;
        }
        var horizontal = this.orientation === 'horizontal';
        var axisLength = horizontal ? this.rect.w : this.rect.h;
        var crossLength = horizontal ? this.rect.h : this.rect.w;
        var buttonLength = Math.min(crossLength, Math.floor(axisLength / 2));
        if (horizontal) {
            this.startButton = { x: this.rect.x, y: this.rect.y, w: buttonLength, h: this.rect.h };
            this.endButton = { x: this.rect.x + this.rect.w - buttonLength, y: this.rect.y,
                w: buttonLength, h: this.rect.h };
            this.trackRect = { x: this.rect.x + buttonLength, y: this.rect.y,
                w: Math.max(0, this.rect.w - buttonLength * 2), h: this.rect.h };
        } else {
            this.startButton = { x: this.rect.x, y: this.rect.y, w: this.rect.w, h: buttonLength };
            this.endButton = { x: this.rect.x, y: this.rect.y + this.rect.h - buttonLength,
                w: this.rect.w, h: buttonLength };
            this.trackRect = { x: this.rect.x, y: this.rect.y + buttonLength,
                w: this.rect.w, h: Math.max(0, this.rect.h - buttonLength * 2) };
        }
        this.updateThumb();
    };

    Scrollbar.prototype.updateThumb = function () {
        var trackLength = this.trackLength();
        if (!this.trackRect || this.trackRect.w <= 0 || this.trackRect.h <= 0 ||
                trackLength <= 0 || this.max() <= 0 || this.total <= 0) {
            this.thumb = null;
            return;
        }
        var minThumb = Math.min(trackLength, ns.Theme.s(20));
        var length = Math.max(minThumb, Math.round(trackLength * this.visible / this.total));
        length = Math.min(trackLength, length);
        var travel = Math.max(1, trackLength - length);
        var start = Math.round(travel * ns.Util.clamp(this.getValue(), 0, this.max()) / this.max());
        var crossLength = this.orientation === 'horizontal' ? this.trackRect.h : this.trackRect.w;
        var inset = Math.min(ns.Theme.s(2), Math.floor(crossLength / 2));
        if (this.orientation === 'horizontal') {
            this.thumb = {
                x: this.trackRect.x + start,
                y: this.trackRect.y + inset,
                w: length,
                h: Math.max(1, this.trackRect.h - inset * 2)
            };
        } else {
            this.thumb = {
                x: this.trackRect.x + inset,
                y: this.trackRect.y + start,
                w: Math.max(1, this.trackRect.w - inset * 2),
                h: length
            };
        }
    };

    Scrollbar.prototype.buttonEnabled = function (id) {
        var value = ns.Util.clamp(Number(this.getValue()) || 0, 0, this.max());
        return id === 'start' ? value > 0 : value < this.max();
    };

    Scrollbar.prototype.step = function () {
        var value = typeof this.lineStep === 'function' ? this.lineStep() : this.lineStep;
        value = Math.round(Number(value) || 0);
        return Math.max(1, value);
    };

    Scrollbar.prototype.drawArrow = function (gr, rect, id, colour) {
        if (!rect || rect.w < 3 || rect.h < 3) return;
        var horizontal = this.orientation === 'horizontal';
        var cx = rect.x + Math.floor(rect.w / 2);
        var cy = rect.y + Math.floor(rect.h / 2);
        var size = Math.max(2, Math.min(ns.Theme.s(3), Math.floor(Math.min(rect.w, rect.h) / 3)));
        for (var offset = 0; offset < size; ++offset) {
            if (horizontal) {
                var px = id === 'start' ? cx - Math.floor(size / 2) + offset : cx + Math.floor(size / 2) - offset;
                gr.DrawLine(px, cy - offset, px, cy + offset, 1, colour);
            } else {
                var py = id === 'start' ? cy - Math.floor(size / 2) + offset : cy + Math.floor(size / 2) - offset;
                gr.DrawLine(cx - offset, py, cx + offset, py, 1, colour);
            }
        }
    };

    Scrollbar.prototype.drawButton = function (gr, rect, id) {
        if (!rect || rect.w <= 0 || rect.h <= 0) return;
        var p = ns.Theme.palette;
        var enabled = this.buttonEnabled(id);
        ns.Util.drawRaised(gr, rect, this.pressedButton === id && enabled ? p.buttonPressed : p.button);
        this.drawArrow(gr, rect, id, enabled ? p.text : p.disabledText);
    };

    Scrollbar.prototype.draw = function (gr) {
        if (!this.rect || this.rect.w <= 0 || this.rect.h <= 0) return;
        var p = ns.Theme.palette;
        gr.FillSolidRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, p.window);
        if (this.orientation === 'horizontal') {
            gr.DrawLine(this.rect.x, this.rect.y, this.rect.x + this.rect.w, this.rect.y, 1, p.border);
        } else {
            gr.DrawLine(this.rect.x, this.rect.y, this.rect.x, this.rect.y + this.rect.h, 1, p.border);
        }
        if (this.thumb) ns.Util.drawRaised(gr, this.thumb, this.dragging ? p.buttonPressed : p.button);
        this.drawButton(gr, this.startButton, 'start');
        this.drawButton(gr, this.endButton, 'end');
    };

    Scrollbar.prototype.set = function (value, repaint) {
        this.setValue(ns.Util.clamp(Math.round(value), 0, this.max()));
        this.updateThumb();
        if (repaint !== false) window.Repaint();
    };

    Scrollbar.prototype.down = function (x, y) {
        if (!ns.Util.inRect(x, y, this.rect)) return false;
        var button = ns.Util.inRect(x, y, this.startButton) ? 'start' :
            (ns.Util.inRect(x, y, this.endButton) ? 'end' : '');
        if (button) {
            if (this.buttonEnabled(button)) {
                this.pressedButton = button;
                this.set(this.getValue() + (button === 'start' ? -this.step() : this.step()));
            }
            return true;
        }
        if (!this.thumb || !ns.Util.inRect(x, y, this.trackRect)) return true;
        var point = this.axisPosition(x, y);
        if (ns.Util.inRect(x, y, this.thumb)) {
            this.dragging = true;
            this.dragOffset = point - this.thumbStart();
        } else {
            this.set(this.getValue() + (point < this.thumbStart() ? -this.visible : this.visible));
        }
        return true;
    };

    Scrollbar.prototype.move = function (x, y) {
        if (this.pressedButton) return true;
        if (!this.dragging || !this.thumb) return false;
        var travel = Math.max(1, this.trackLength() - this.thumbLength());
        var rectStart = this.orientation === 'horizontal' ? this.trackRect.x : this.trackRect.y;
        var pos = ns.Util.clamp(this.axisPosition(x, y) - this.dragOffset - rectStart, 0, travel);
        this.set(Math.round(this.max() * pos / travel));
        return true;
    };

    Scrollbar.prototype.up = function () {
        var wasActive = this.dragging || !!this.pressedButton;
        this.dragging = false;
        this.pressedButton = '';
        if (wasActive) window.Repaint();
        return wasActive;
    };

    ns.Scrollbar = Scrollbar;
})(FusionUI);
