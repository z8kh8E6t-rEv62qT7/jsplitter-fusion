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
        this.activeTab = 'item';
        this.playbackScroll = 0;
        this.output = new ns.OutputInfoModel();
        this.outputTimer = null;
        this.disposed = false;
    }

    RightPaneView.prototype.layout = function (rect) {
        this.rect = rect;
        var m = ns.Theme.metrics;
        var maximumSide = Math.max(0, rect.h - m.header - m.padding * 2);
        var side = Math.min(Math.max(0, rect.w - m.padding * 2), maximumSide);
        var artHeight = Math.min(rect.h, m.header + m.padding * 2 + side);
        this.artRect = { x: rect.x, y: rect.y, w: rect.w, h: artHeight };
        this.detailRect = { x: rect.x, y: rect.y + artHeight, w: rect.w, h: Math.max(0, rect.h - artHeight) };
        this.syncOutputTimer();
    };

    RightPaneView.prototype.repaintDetails = function () {
        var rect = this.detailRect;
        if (rect && rect.w > 0 && rect.h > 0) window.RepaintRect(rect.x, rect.y, rect.w, rect.h);
    };

    RightPaneView.prototype.outputVisible = function () {
        return !this.disposed && this.activeTab === 'playback' && this.detailRect &&
            this.detailRect.w > 1 && this.detailRect.h > ns.Theme.metrics.header;
    };

    RightPaneView.prototype.refreshOutput = function () {
        if (!this.outputVisible() || !window.IsVisible) return;
        try {
            if (this.output.refresh()) this.repaintDetails();
        } catch (error) {
            // Polling errors remain local to this optional page.
            try { console.log('Playback details refresh: ' + String(error)); } catch (_) {}
        }
    };

    RightPaneView.prototype.syncOutputTimer = function () {
        if (!this.outputVisible()) {
            if (this.outputTimer !== null) window.ClearInterval(this.outputTimer);
            this.outputTimer = null;
        } else if (this.outputTimer === null) {
            this.refreshOutput();
            var self = this;
            this.outputTimer = window.SetInterval(function () { self.refreshOutput(); }, 1000);
        }
    };

    RightPaneView.prototype.dispose = function () {
        this.disposed = true;
        this.syncOutputTimer();
    };

    RightPaneView.prototype.tabRects = function () {
        var rect = this.detailRect;
        if (!rect) return [];
        var firstWidth = Math.floor(rect.w / 2);
        var height = Math.min(rect.h, ns.Theme.metrics.header);
        return [
            { id: 'item', title: 'Item details', x: rect.x, y: rect.y, w: firstWidth, h: height },
            { id: 'playback', title: 'Playback details', x: rect.x + firstWidth,
                y: rect.y, w: rect.w - firstWidth, h: height }
        ];
    };

    RightPaneView.prototype.drawTabs = function (gr) {
        var p = ns.Theme.palette;
        var tabs = this.tabRects();
        for (var i = 0; i < tabs.length; ++i) {
            var tab = tabs[i];
            if (tab.w <= 0 || tab.h <= 0) continue;
            ns.Util.drawRaised(gr, tab, tab.id === this.activeTab ? p.base : p.button);
            ns.Util.drawText(gr, tab.title, tab.id === this.activeTab ? ns.Theme.fonts.bold : ns.Theme.fonts.normal,
                p.text, { x: tab.x + ns.Theme.s(3), y: tab.y,
                    w: Math.max(0, tab.w - ns.Theme.s(6)), h: tab.h },
                DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        }
    };

    RightPaneView.prototype.selectTab = function (tab) {
        if (this.disposed || (tab !== 'item' && tab !== 'playback') || tab === this.activeTab) return;
        this.activeTab = tab;
        this.syncOutputTimer();
        this.repaintDetails();
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

    RightPaneView.prototype.playbackLayout = function (gr, body) {
        var m = ns.Theme.metrics;
        var width = Math.max(1, body.w - m.padding * 2);
        var lineHeight = Math.max(ns.Theme.s(21), Math.ceil(gr.CalcTextHeight('Ag\u56fd', ns.Theme.fonts.normal)));
        var result = [];
        var y = m.padding;
        // Draw exactly the lines measured by GDI, so scrolling and wrapping agree.
        for (var i = 0; i < this.output.rows.length; ++i) {
            var row = this.output.rows[i];
            var font = row.kind === 'group' ? ns.Theme.fonts.bold : ns.Theme.fonts.normal;
            if (row.kind === 'group' && i > 0) y += m.padding;
            var text = row.kind === 'field' ? row.label + '\uff1a' + row.value : row.text;
            var paragraphs = text.replace(/\r\n?/g, '\n').split('\n');
            for (var j = 0; j < paragraphs.length; ++j) {
                var wrapped = gr.EstimateLineWrap(paragraphs[j] || ' ', font, width);
                for (var k = 0; k < wrapped.length; k += 2) {
                    result.push({ text: String(wrapped[k]), y: y, h: lineHeight,
                        font: font, note: row.kind === 'note' });
                    y += lineHeight;
                }
            }
        }
        return { lines: result, height: y + m.padding, width: width };
    };

    RightPaneView.prototype.drawPlaybackDetails = function (gr, body) {
        var layout = this.playbackLayout(gr, body);
        this.playbackScroll = ns.Util.clamp(this.playbackScroll, 0, Math.max(0, layout.height - body.h));
        for (var i = 0; i < layout.lines.length; ++i) {
            var line = layout.lines[i];
            var y = body.y + line.y - this.playbackScroll;
            if (y + line.h <= body.y || y >= body.y + body.h) continue;
            ns.Util.drawText(gr, line.text, line.font,
                line.note ? ns.Theme.palette.disabledText : ns.Theme.palette.text,
                { x: body.x + ns.Theme.metrics.padding, y: y, w: layout.width, h: line.h },
                DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
        }
    };

    RightPaneView.prototype.drawDetails = function (gr) {
        var p = ns.Theme.palette;
        var m = ns.Theme.metrics;
        var f = ns.Theme.fonts;
        if (this.detailRect.w <= 1 || this.detailRect.h <= 1) return;
        gr.FillSolidRect(this.detailRect.x, this.detailRect.y + m.header,
            this.detailRect.w, Math.max(0, this.detailRect.h - m.header), p.base);
        var lines = this.activeTab === 'item' ? this.detailLines() : [];
        var body = { x: this.detailRect.x, y: this.detailRect.y + m.header,
            w: this.detailRect.w, h: Math.max(0, this.detailRect.h - m.header) };
        if (body.w > 0 && body.h > 0) {
            gr.PushClip(body.x, body.y, body.w, body.h);
            try {
                if (this.activeTab === 'playback') {
                    this.drawPlaybackDetails(gr, body);
                } else if (!lines.length) {
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
        this.drawTabs(gr);
        gr.DrawRect(this.detailRect.x, this.detailRect.y, this.detailRect.w - 1, this.detailRect.h - 1, 1, p.border);
    };

    RightPaneView.prototype.draw = function (gr) {
        this.drawArtwork(gr);
        this.drawDetails(gr);
    };

    RightPaneView.prototype.down = function (x, y) {
        var tabs = this.tabRects();
        for (var i = 0; i < tabs.length; ++i) {
            if (ns.Util.inRect(x, y, tabs[i])) {
                this.selectTab(tabs[i].id);
                return true;
            }
        }
        return ns.Util.inRect(x, y, this.rect);
    };

    RightPaneView.prototype.move = function () { return false; };

    RightPaneView.prototype.up = function () { return false; };

    RightPaneView.prototype.wheel = function (x, y, step) {
        if (!ns.Util.inRect(x, y, this.detailRect)) return false;
        if (y < this.detailRect.y + ns.Theme.metrics.header) return false;
        if (this.activeTab === 'playback') this.playbackScroll = Math.max(0, this.playbackScroll - step * ns.Theme.s(42));
        else this.detailScroll = Math.max(0, this.detailScroll - step * ns.Theme.s(42));
        this.repaintDetails();
        return true;
    };

    ns.RightPaneView = RightPaneView;
})(FusionUI);
