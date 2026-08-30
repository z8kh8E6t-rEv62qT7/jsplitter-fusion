(function (ns) {
    'use strict';

    function RightPaneView(model, artwork) {
        this.model = model;
        this.artwork = artwork;
        this.rect = null;
        this.artRect = null;
        this.detailRect = null;
        this.detailScroll = 0;
        this.detailKey = '';
    }

    RightPaneView.prototype.layout = function (rect) {
        this.rect = rect;
        var m = ns.Theme.metrics;
        var maximumSide = Math.max(0, rect.h - m.header - m.padding * 2);
        var side = Math.min(Math.max(0, rect.w - m.padding * 2), maximumSide);
        var artHeight = Math.min(rect.h, m.header + m.padding * 2 + side);
        this.artRect = { x: rect.x, y: rect.y, w: rect.w, h: artHeight };
        this.detailRect = { x: rect.x, y: rect.y + artHeight, w: rect.w, h: Math.max(0, rect.h - artHeight) };
    };

    RightPaneView.prototype.drawPanelHeader = function (gr, rect, title) {
        var m = ns.Theme.metrics;
        ns.Util.drawRaised(gr, { x: rect.x, y: rect.y, w: rect.w, h: m.header });
        ns.Util.drawText(gr, title, ns.Theme.fonts.bold, ns.Theme.palette.text,
            { x: rect.x + m.padding, y: rect.y, w: rect.w - m.padding * 2, h: m.header });
    };

    RightPaneView.prototype.drawArtwork = function (gr) {
        var p = ns.Theme.palette;
        var m = ns.Theme.metrics;
        var f = ns.Theme.fonts;
        if (this.artRect.w <= 1 || this.artRect.h <= 1) return;
        this.drawPanelHeader(gr, this.artRect, 'Artwork');
        var area = {
            x: this.artRect.x + Math.floor((this.artRect.w - Math.max(0, this.artRect.h - m.header - m.padding * 2)) / 2),
            y: this.artRect.y + m.header + m.padding,
            w: Math.max(0, this.artRect.h - m.header - m.padding * 2),
            h: Math.max(0, this.artRect.h - m.header - m.padding * 2)
        };
        if (area.w > 1 && area.h > 1) ns.Util.drawSunken(gr, area, p.window);
        if (this.artwork.image && area.w > 4 && area.h > 4) {
            var image = this.artwork.image;
            var inner = { x: area.x + 2, y: area.y + 2, w: area.w - 4, h: area.h - 4 };
            var scale = Math.min(inner.w / image.Width, inner.h / image.Height);
            var w = Math.max(1, Math.round(image.Width * scale));
            var h = Math.max(1, Math.round(image.Height * scale));
            var x = inner.x + Math.floor((inner.w - w) / 2);
            var y = inner.y + Math.floor((inner.h - h) / 2);
            gr.DrawImage(image, x, y, w, h, 0, 0, image.Width, image.Height, 0, 255);
        } else {
            var text = this.artwork.loading ? '\u6b63\u5728\u52a0\u8f7d\u5c01\u9762...' : 'No artwork';
            ns.Util.drawText(gr, text, f.normal, p.disabledText, area,
                DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
        }
        gr.DrawRect(this.artRect.x, this.artRect.y, this.artRect.w - 1, this.artRect.h - 1, 1, p.border);
    };

    RightPaneView.prototype.detailLines = function () {
        var context = this.model.displayContext();
        if (context.key !== this.detailKey) {
            this.detailKey = context.key;
            this.detailScroll = 0;
        }
        var details = this.model.detailsForContext(context);
        if (!details) return [];
        var lines = [];
        if (context.count > 1) lines.push(['Items', String(context.count)]);
        lines.push(
            ['Title', details.title],
            ['Artist', details.artist],
            ['Album artist', details.albumArtist],
            ['Album', details.album],
            ['Year', details.year],
            ['Track', details.track],
            ['Disc', details.disc],
            ['Genre', details.genre],
            ['Composer', details.composer],
            ['Comment', details.comment],
            ['', ''],
            ['Codec', details.codec],
            ['Bitrate', details.bitrate],
            ['Sample rate', details.samplerate],
            ['Bit depth', details.bitdepth],
            ['Channels', details.channels],
            ['Length', details.length],
            ['File size', details.filesize],
            ['', ''],
            ['RG track gain', details.replaygainTrackGain],
            ['RG track peak', details.replaygainTrackPeak],
            ['RG album gain', details.replaygainAlbumGain],
            ['RG album peak', details.replaygainAlbumPeak],
            ['', ''],
            ['File name', details.filename],
            ['Directory', details.directory],
            ['Full path', details.path],
            ['Modified', details.modified]
        );
        return lines;
    };

    RightPaneView.prototype.drawDetails = function (gr) {
        var p = ns.Theme.palette;
        var m = ns.Theme.metrics;
        var f = ns.Theme.fonts;
        if (this.detailRect.w <= 1 || this.detailRect.h <= 1) return;
        gr.FillSolidRect(this.detailRect.x, this.detailRect.y + m.header,
            this.detailRect.w, Math.max(0, this.detailRect.h - m.header), p.base);
        var lines = this.detailLines();
        var body = { x: this.detailRect.x, y: this.detailRect.y + m.header,
            w: this.detailRect.w, h: Math.max(0, this.detailRect.h - m.header) };
        if (body.w > 0 && body.h > 0) {
            gr.PushClip(body.x, body.y, body.w, body.h);
            try {
                if (!lines.length) {
                    ns.Util.drawText(gr, '\u6ca1\u6709\u9009\u4e2d\u7684\u9879\u76ee', f.normal, p.disabledText,
                        body, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
                } else {
                    var lineHeight = ns.Theme.s(21);
                    var contentHeight = lines.length * lineHeight + m.padding * 2;
                    var viewportHeight = body.h;
                    this.detailScroll = ns.Util.clamp(this.detailScroll, 0, Math.max(0, contentHeight - viewportHeight));
                    var y = body.y + m.padding - this.detailScroll;
                    var labelWidth = ns.Theme.s(112);
                    for (var i = 0; i < lines.length; ++i) {
                        if (y + lineHeight > body.y && y < body.y + body.h && lines[i][0]) {
                            ns.Util.drawText(gr, lines[i][0] + ':', f.normal, p.disabledText,
                                { x: this.detailRect.x + m.padding, y: y, w: labelWidth, h: lineHeight });
                            ns.Util.drawText(gr, lines[i][1], f.normal, p.text,
                                { x: this.detailRect.x + m.padding + labelWidth, y: y,
                                    w: this.detailRect.w - labelWidth - m.padding * 3, h: lineHeight });
                        }
                        y += lineHeight;
                    }
                }
            } finally {
                gr.PopClip();
            }
        }
        this.drawPanelHeader(gr, this.detailRect, 'Item details');
        gr.DrawRect(this.detailRect.x, this.detailRect.y, this.detailRect.w - 1, this.detailRect.h - 1, 1, p.border);
    };

    RightPaneView.prototype.draw = function (gr) {
        this.drawArtwork(gr);
        this.drawDetails(gr);
    };

    RightPaneView.prototype.down = function (x, y) {
        return ns.Util.inRect(x, y, this.rect);
    };

    RightPaneView.prototype.move = function () { return false; };

    RightPaneView.prototype.up = function () { return false; };

    RightPaneView.prototype.wheel = function (x, y, step) {
        if (!ns.Util.inRect(x, y, this.detailRect)) return false;
        this.detailScroll = Math.max(0, this.detailScroll - step * ns.Theme.s(42));
        window.Repaint();
        return true;
    };

    ns.RightPaneView = RightPaneView;
})(FusionUI);
