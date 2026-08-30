(function (ns) {
    'use strict';

    function BottomBar(model) {
        this.model = model;
        this.transport = new ns.TransportControls(model);
        this.rect = null;
        this.seekRect = null;
        this.seekTrackRect = null;
        this.elapsedRect = null;
        this.remainingRect = null;
        this.summaryRect = null;
        this.volumeRect = null;
        this.seekDragging = false;
        this.seekRatio = 0;
        this.volumeDragging = false;
        this.transportRowHeight = 0;
        this.seekRowHeight = 0;
        this.summaryRowHeight = 0;
    }

    BottomBar.prototype.layout = function (rect) {
        this.rect = rect;
        var m = ns.Theme.metrics;
        var s = ns.Theme.s;
        this.transportRowHeight = Math.min(m.transportRow, rect.h);
        this.seekRowHeight = Math.min(m.seekRow, Math.max(0, rect.h - this.transportRowHeight));
        this.summaryRowHeight = Math.max(0, rect.h - this.transportRowHeight - this.seekRowHeight);

        this.transport.layout({ x: rect.x, y: rect.y, w: rect.w, h: this.transportRowHeight });
        this.seekRect = {
            x: rect.x,
            y: rect.y + this.transportRowHeight,
            w: rect.w,
            h: this.seekRowHeight
        };
        var outerPadding = Math.min(s(8), Math.floor(this.seekRect.w / 12));
        var timeWidth = Math.min(s(76), Math.max(0, Math.floor((this.seekRect.w - outerPadding * 2 - s(40)) / 2)));
        var trackGap = Math.min(s(8), Math.max(1, Math.floor(this.seekRect.w / 40)));
        this.elapsedRect = {
            x: this.seekRect.x + outerPadding,
            y: this.seekRect.y,
            w: timeWidth,
            h: this.seekRect.h
        };
        this.remainingRect = {
            x: this.seekRect.x + this.seekRect.w - outerPadding - timeWidth,
            y: this.seekRect.y,
            w: timeWidth,
            h: this.seekRect.h
        };
        var trackHeight = Math.min(s(18), Math.max(0, this.seekRect.h - s(8)));
        var trackX = this.elapsedRect.x + this.elapsedRect.w + trackGap;
        this.seekTrackRect = {
            x: trackX,
            y: this.seekRect.y + Math.floor((this.seekRect.h - trackHeight) / 2),
            w: Math.max(0, this.remainingRect.x - trackGap - trackX),
            h: trackHeight
        };
        this.summaryRect = {
            x: rect.x,
            y: this.seekRect.y + this.seekRect.h,
            w: rect.w,
            h: this.summaryRowHeight
        };

        var rightWidth = Math.min(s(250), Math.max(0, Math.round(rect.w * 0.27)));
        var volumeLeft = rect.x + rect.w - rightWidth + Math.min(s(72), rightWidth);
        var volumeHeight = Math.min(s(6), this.summaryRowHeight);
        this.volumeRect = {
            x: volumeLeft,
            y: this.summaryRect.y + Math.floor((this.summaryRowHeight - volumeHeight) / 2),
            w: Math.max(0, rect.x + rect.w - s(8) - volumeLeft),
            h: volumeHeight
        };
    };

    BottomBar.prototype.seekPosition = function () {
        if (this.seekDragging) return this.seekRatio;
        if (!fb.IsPlaying || fb.PlaybackLength <= 0) return 0;
        return ns.Util.clamp(fb.PlaybackTime / fb.PlaybackLength, 0, 1);
    };

    BottomBar.prototype.volumePosition = function () {
        return ns.Util.clamp(Math.pow(2, fb.Volume / 10), 0, 1);
    };

    BottomBar.prototype.audioSummary = function () {
        var context = this.model.displayContext();
        var details = this.model.detailsForContext(context);
        if (!details) return '';
        var values = [details.codec, details.bitrate, details.samplerate, details.bitdepth, details.channels];
        return values.join('  |  ');
    };

    BottomBar.prototype.itemCountText = function (count, singular, plural) {
        return count + ' ' + (count === 1 ? singular : plural);
    };

    BottomBar.prototype.librarySummary = function () {
        var count = this.model.count();
        return this.itemCountText(count, 'item', 'items') +
            '  |  Length: ' + ns.Util.formatSelectionDuration(this.model.playlistDuration());
    };

    BottomBar.prototype.contextSummary = function () {
        var context = this.model.displayContext();
        if (!context.count) return '0:00  |  0 tracks';
        var details = this.model.detailsForContext(context);
        var duration = details && details.length ? details.length : 'N/A';
        return duration + '  |  ' + this.itemCountText(context.count, 'track', 'tracks');
    };

    BottomBar.prototype.seekThumbGeometry = function (ratio) {
        var track = this.seekTrackRect;
        var thumbWidth = Math.min(ns.Theme.s(10), track.w);
        var thumbHeight = Math.min(ns.Theme.s(18), track.h);
        var thumbX = track.x + Math.round(Math.max(0, track.w - thumbWidth) * ns.Util.clamp(ratio, 0, 1));
        return {
            x: thumbX,
            y: track.y + Math.floor((track.h - thumbHeight) / 2),
            w: thumbWidth,
            h: thumbHeight,
            centre: thumbX + Math.floor(thumbWidth / 2)
        };
    };

    BottomBar.prototype.drawProgress = function (gr) {
        if (!this.seekRect || this.seekRect.w <= 0 || this.seekRect.h <= 0) return;
        var p = ns.Theme.palette;
        var dark = ns.Theme.darkPalette;
        var f = ns.Theme.fonts;
        var s = ns.Theme.s;
        var ratio = this.seekPosition();
        gr.FillSolidRect(this.seekRect.x, this.seekRect.y, this.seekRect.w, this.seekRect.h, p.base);
        if (this.seekTrackRect.w > 0 && this.seekTrackRect.h > 0) {
            var radius = Math.min(s(4), Math.floor(this.seekTrackRect.h / 2), Math.floor(this.seekTrackRect.w / 2));
            gr.FillRoundRect(this.seekTrackRect.x, this.seekTrackRect.y, this.seekTrackRect.w,
                this.seekTrackRect.h, radius, radius, dark.remaining);
            if (fb.IsPlaying && fb.PlaybackLength > 0) {
                var thumb = this.seekThumbGeometry(ratio);
                var fillWidth = ratio >= 1 ? this.seekTrackRect.w :
                    ns.Util.clamp(thumb.centre - this.seekTrackRect.x, 0, this.seekTrackRect.w);
                if (fillWidth > 0) {
                    gr.PushClip(this.seekTrackRect.x, this.seekTrackRect.y, fillWidth, this.seekTrackRect.h);
                    try {
                        gr.FillRoundRect(this.seekTrackRect.x, this.seekTrackRect.y, this.seekTrackRect.w,
                            this.seekTrackRect.h, radius, radius, p.highlight);
                    } finally {
                        gr.PopClip();
                    }
                }
                var thumbRadius = Math.min(s(3), Math.floor(Math.min(thumb.w, thumb.h) / 2));
                gr.FillRoundRect(thumb.x, thumb.y, thumb.w, thumb.h,
                    thumbRadius, thumbRadius, p.highlight);
            }
        }

        var active = fb.IsPlaying || fb.IsPaused;
        var shown = active ? (this.seekDragging ? fb.PlaybackLength * this.seekRatio : fb.PlaybackTime) : 0;
        var elapsed = active ? ns.Util.formatClock(shown) : '00:00';
        var remaining = !active ? '00:00' : (fb.PlaybackLength > 0 ?
            '\u2212' + ns.Util.formatClock(Math.max(0, fb.PlaybackLength - shown)) : 'N/A');
        ns.Util.drawText(gr, elapsed, f.normal, p.text, this.elapsedRect,
            DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
        ns.Util.drawText(gr, remaining, f.normal, p.text, this.remainingRect,
            DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
        gr.DrawLine(this.seekRect.x, this.seekRect.y, this.seekRect.x + this.seekRect.w, this.seekRect.y, 1, p.border);
        gr.DrawLine(this.seekRect.x, this.seekRect.y + this.seekRect.h - 1,
            this.seekRect.x + this.seekRect.w, this.seekRect.y + this.seekRect.h - 1, 1, p.border);
    };

    BottomBar.prototype.drawVolume = function (gr) {
        if (!this.volumeRect || this.volumeRect.w <= 0 || this.volumeRect.h <= 0) return;
        var p = ns.Theme.palette;
        var ratio = this.volumePosition();
        gr.FillSolidRect(this.volumeRect.x, this.volumeRect.y, this.volumeRect.w, this.volumeRect.h, p.window);
        gr.DrawRect(this.volumeRect.x, this.volumeRect.y, Math.max(0, this.volumeRect.w - 1), Math.max(0, this.volumeRect.h - 1), 1, p.border);
        var fill = Math.round(this.volumeRect.w * ratio);
        if (fill > 0) gr.FillSolidRect(this.volumeRect.x, this.volumeRect.y, fill, this.volumeRect.h, p.highlight);
        var thumb = Math.min(ns.Theme.s(10), Math.max(2, this.summaryRowHeight - ns.Theme.s(5)));
        var cx = this.volumeRect.x + Math.round((this.volumeRect.w - 1) * ratio);
        var thumbX = ns.Util.clamp(cx - Math.floor(thumb / 2), this.volumeRect.x, this.volumeRect.x + this.volumeRect.w - thumb);
        var thumbY = this.summaryRect.y + Math.floor((this.summaryRect.h - thumb) / 2);
        gr.FillSolidRect(thumbX, thumbY, thumb, thumb, p.highlight);
        gr.DrawRect(thumbX, thumbY, Math.max(0, thumb - 1), Math.max(0, thumb - 1), 1, p.darkBorder);
    };

    BottomBar.prototype.drawSummary = function (gr) {
        if (!this.summaryRect || this.summaryRect.w <= 0 || this.summaryRect.h <= 0) return;
        var p = ns.Theme.palette;
        var f = ns.Theme.fonts;
        var s = ns.Theme.s;
        gr.FillSolidRect(this.summaryRect.x, this.summaryRect.y, this.summaryRect.w, this.summaryRect.h, p.base);
        var rightWidth = Math.min(s(250), Math.max(0, Math.round(this.summaryRect.w * 0.27)));
        var available = Math.max(0, this.summaryRect.w - rightWidth);
        var libraryWidth = Math.floor(available * 0.31);
        var selectionWidth = Math.floor(available * 0.25);
        var audioWidth = Math.max(0, available - libraryWidth - selectionWidth);
        ns.Util.drawText(gr, this.librarySummary(), f.small, p.text,
            { x: this.summaryRect.x + s(5), y: this.summaryRect.y,
                w: Math.max(0, libraryWidth - s(8)), h: this.summaryRect.h });
        ns.Util.drawText(gr, this.contextSummary(), f.small, p.text,
            { x: this.summaryRect.x + libraryWidth, y: this.summaryRect.y,
                w: Math.max(0, selectionWidth - s(5)), h: this.summaryRect.h });
        ns.Util.drawText(gr, this.audioSummary(), f.small, p.text,
            { x: this.summaryRect.x + libraryWidth + selectionWidth, y: this.summaryRect.y,
                w: audioWidth, h: this.summaryRect.h },
            DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        ns.Util.drawText(gr, fb.Volume.toFixed(2) + ' dB', f.small, p.text,
            { x: this.summaryRect.x + this.summaryRect.w - rightWidth, y: this.summaryRect.y,
                w: Math.min(s(66), rightWidth), h: this.summaryRect.h },
            DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
        this.drawVolume(gr);
        gr.DrawLine(this.summaryRect.x, this.summaryRect.y,
            this.summaryRect.x + this.summaryRect.w, this.summaryRect.y, 1, p.border);
    };

    BottomBar.prototype.draw = function (gr) {
        if (!this.rect || this.rect.w <= 0 || this.rect.h <= 0) return;
        var p = ns.Theme.palette;
        gr.FillSolidRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, p.base);
        gr.DrawLine(this.rect.x, this.rect.y, this.rect.x + this.rect.w, this.rect.y, 1, p.border);
        this.transport.draw(gr);
        this.drawProgress(gr);
        this.drawSummary(gr);
    };

    BottomBar.prototype.setSeekFromX = function (x) {
        this.seekRatio = ns.Util.clamp((x - this.seekTrackRect.x) / Math.max(1, this.seekTrackRect.w), 0, 1);
        window.RepaintRect(this.seekRect.x, this.seekRect.y, this.seekRect.w, this.seekRect.h);
    };

    BottomBar.prototype.setVolumeFromX = function (x) {
        var ratio = ns.Util.clamp((x - this.volumeRect.x) / Math.max(1, this.volumeRect.w), 0, 1);
        var db = ratio <= 0 ? -100 : 10 * Math.log(ratio) / Math.LN2;
        fb.Volume = ns.Util.clamp(db, -100, 0);
    };

    BottomBar.prototype.down = function (x, y) {
        if (ns.Util.inRect(x, y, this.transport.rect) && this.transport.down(x, y)) return true;
        if (ns.Util.inRect(x, y, this.seekTrackRect) && fb.IsPlaying && fb.PlaybackLength > 0) {
            this.seekDragging = true;
            this.setSeekFromX(x);
            return true;
        }
        var volumeHit = { x: this.volumeRect.x - ns.Theme.s(4), y: this.summaryRect.y,
            w: this.volumeRect.w + ns.Theme.s(8), h: this.summaryRect.h };
        if (ns.Util.inRect(x, y, volumeHit)) {
            this.volumeDragging = true;
            this.setVolumeFromX(x);
            return true;
        }
        return ns.Util.inRect(x, y, this.rect);
    };

    BottomBar.prototype.move = function (x, y) {
        if (this.seekDragging) {
            this.setSeekFromX(x);
            return true;
        }
        if (this.volumeDragging) {
            this.setVolumeFromX(x);
            return true;
        }
        return this.transport.move(x, y);
    };

    BottomBar.prototype.up = function (x, y) {
        if (this.seekDragging) {
            this.setSeekFromX(x);
            this.seekDragging = false;
            if (fb.IsPlaying && fb.PlaybackLength > 0) fb.PlaybackTime = fb.PlaybackLength * this.seekRatio;
            window.RepaintRect(this.seekRect.x, this.seekRect.y, this.seekRect.w, this.seekRect.h);
            return true;
        }
        if (this.volumeDragging) {
            this.setVolumeFromX(x);
            this.volumeDragging = false;
            return true;
        }
        return this.transport.up(x, y);
    };

    BottomBar.prototype.leave = function () {
        var handled = this.transport.leave();
        if (this.seekDragging || this.volumeDragging) {
            this.seekDragging = false;
            this.volumeDragging = false;
            window.RepaintRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
            handled = true;
        }
        return handled;
    };

    BottomBar.prototype.wheel = function (x, y, step) {
        var hit = { x: this.volumeRect.x - ns.Theme.s(72), y: this.summaryRect.y,
            w: this.volumeRect.w + ns.Theme.s(80), h: this.summaryRect.h };
        if (!ns.Util.inRect(x, y, hit)) return false;
        if (step > 0) fb.VolumeUp(); else fb.VolumeDown();
        return true;
    };

    BottomBar.prototype.context = function (x, y) {
        return this.transport.context(x, y);
    };

    ns.BottomBar = BottomBar;
})(FusionUI);
