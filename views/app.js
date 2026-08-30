(function (ns) {
    'use strict';

    function FusionApp() {
        this.model = new ns.PlaylistModel();
        var self = this;
        this.artwork = new ns.ArtworkController(function () {
            if (self.right && self.right.rect) window.RepaintRect(self.right.rect.x, self.right.rect.y, self.right.rect.w, self.right.rect.h);
        });
        this.manager = new ns.PlaylistManagerView(this.model);
        this.playlist = new ns.PlaylistView(this.model);
        this.right = new ns.RightPaneView(this.model, this.artwork);
        this.bottom = new ns.BottomBar(this.model);
        this.width = 0;
        this.height = 0;
        this.leftRect = null;
        this.centreRect = null;
        this.rightRect = null;
        this.leftSplitter = null;
        this.rightSplitter = null;
        this.splitDrag = '';
        this.lastMouse = { x: 0, y: 0 };
        this.focusArea = 'tracks';
        plman.SetActivePlaylistContext();
        this.refreshArtwork();
    }

    FusionApp.prototype.layout = function (width, height) {
        this.width = Math.max(0, width);
        this.height = Math.max(0, height);
        var m = ns.Theme.metrics;
        var contentHeight = Math.max(0, this.height - m.bottom);
        var usable = Math.max(0, this.width - m.splitter * 2);
        var left = ns.Settings.leftWidth;
        var minimumDetails = m.header + ns.Theme.s(180);
        var heightLimitedRight = Math.max(0, contentHeight - m.header - minimumDetails);
        var right = Math.min(ns.Settings.rightWidth, heightLimitedRight);
        var centre = usable - left - right;

        if (centre < m.minCentre) {
            var sideSpace = Math.max(0, usable - m.minCentre);
            var desiredSides = Math.max(1, left + right);
            left = Math.round(sideSpace * left / desiredSides);
            right = sideSpace - left;
            var effectiveMinRight = Math.min(m.minRight, heightLimitedRight);
            if (sideSpace >= m.minLeft + effectiveMinRight) {
                left = ns.Util.clamp(left, m.minLeft, sideSpace - effectiveMinRight);
                right = sideSpace - left;
            }
            centre = usable - left - right;
        }

        this.leftRect = { x: 0, y: 0, w: Math.max(0, left), h: contentHeight };
        this.leftSplitter = { x: this.leftRect.w, y: 0, w: m.splitter, h: contentHeight };
        this.centreRect = { x: this.leftSplitter.x + m.splitter, y: 0, w: Math.max(0, centre), h: contentHeight };
        this.rightSplitter = { x: this.centreRect.x + this.centreRect.w, y: 0, w: m.splitter, h: contentHeight };
        this.rightRect = { x: this.rightSplitter.x + m.splitter, y: 0, w: Math.max(0, right), h: contentHeight };

        this.manager.layout(this.leftRect);
        this.playlist.layout(this.centreRect);
        this.right.layout(this.rightRect);
        this.bottom.layout({ x: 0, y: contentHeight, w: this.width, h: Math.min(m.bottom, this.height) });
    };

    FusionApp.prototype.drawSplitter = function (gr, rect) {
        var p = ns.Theme.palette;
        gr.FillSolidRect(rect.x, rect.y, rect.w, rect.h, p.window);
        gr.DrawLine(rect.x, rect.y, rect.x, rect.y + rect.h, 1, p.lightBorder);
        gr.DrawLine(rect.x + rect.w - 1, rect.y, rect.x + rect.w - 1, rect.y + rect.h, 1, p.border);
    };

    FusionApp.prototype.draw = function (gr) {
        gr.FillSolidRect(0, 0, this.width, this.height, ns.Theme.palette.window);
        if (this.leftRect.h > 0) {
            if (this.leftRect.w > 1) this.manager.draw(gr);
            this.drawSplitter(gr, this.leftSplitter);
            if (this.centreRect.w > 1) this.playlist.draw(gr);
            this.drawSplitter(gr, this.rightSplitter);
            if (this.rightRect.w > 1) this.right.draw(gr);
        }
        if (this.bottom.rect.h > 0) this.bottom.draw(gr);
    };

    FusionApp.prototype.refreshArtwork = function () {
        var context = this.model.displayContext();
        this.artwork.refresh(context.count === 1 ? context.singleHandle : null);
    };

    FusionApp.prototype.displayChanged = function () {
        this.model.invalidateDisplayDetails();
        this.refreshArtwork();
        window.Repaint();
    };

    FusionApp.prototype.reloadAll = function () {
        this.model.reloadPlaylists();
        this.model.reloadItems();
        this.playlist.reloadScroll();
        this.layout(this.width, this.height);
        this.refreshArtwork();
        window.Repaint();
    };

    FusionApp.prototype.reloadItems = function (playlistIndex) {
        if (playlistIndex != null && playlistIndex !== this.model.active) return;
        this.model.reloadItems();
        this.layout(this.width, this.height);
        this.refreshArtwork();
        window.Repaint();
    };

    FusionApp.prototype.selectionChanged = function () {
        this.displayChanged();
    };

    FusionApp.prototype.focusForPoint = function (x, y) {
        if (ns.Util.inRect(x, y, this.leftRect)) return 'playlists';
        if (ns.Util.inRect(x, y, this.centreRect)) return 'tracks';
        if (ns.Util.inRect(x, y, this.rightRect)) return 'right';
        if (ns.Util.inRect(x, y, this.bottom.rect)) return 'bottom';
        return this.focusArea;
    };

    FusionApp.prototype.mouseDown = function (x, y) {
        this.lastMouse = { x: x, y: y };
        if (ns.Util.inRect(x, y, this.leftSplitter)) {
            this.splitDrag = 'left';
            return true;
        }
        if (ns.Util.inRect(x, y, this.rightSplitter)) {
            this.splitDrag = 'right';
            return true;
        }
        this.focusArea = this.focusForPoint(x, y);
        if (this.focusArea === 'playlists') return this.manager.down(x, y);
        if (this.focusArea === 'tracks') return this.playlist.down(x, y);
        if (this.focusArea === 'right') return this.right.down(x, y);
        if (this.focusArea === 'bottom') return this.bottom.down(x, y);
        return false;
    };

    FusionApp.prototype.mouseMove = function (x, y) {
        this.lastMouse = { x: x, y: y };
        var m = ns.Theme.metrics;
        if (this.splitDrag === 'left') {
            var left = ns.Util.clamp(x, m.minLeft, Math.max(m.minLeft, this.width - ns.Settings.rightWidth - m.minCentre - m.splitter * 2));
            ns.Settings.setLeftWidth(left);
            this.layout(this.width, this.height);
            window.Repaint();
            window.SetCursor(IDC_SIZEWE);
            return true;
        }
        if (this.splitDrag === 'right') {
            var contentHeight = Math.max(0, this.height - m.bottom);
            var minimumDetails = m.header + ns.Theme.s(180);
            var heightMaximum = Math.max(0, contentHeight - m.header - minimumDetails);
            var widthMaximum = Math.max(0, this.width - ns.Settings.leftWidth - m.minCentre - m.splitter * 2);
            var maximum = Math.min(ns.Theme.s(640), heightMaximum, widthMaximum);
            var minimum = Math.min(m.minRight, maximum);
            var right = ns.Util.clamp(this.width - x - m.splitter, minimum, maximum);
            ns.Settings.setRightWidth(right);
            this.layout(this.width, this.height);
            window.Repaint();
            window.SetCursor(IDC_SIZEWE);
            return true;
        }
        if (this.manager.move(x, y) || this.playlist.move(x, y) || this.right.move(x, y) || this.bottom.move(x, y)) return true;
        if (ns.Util.inRect(x, y, this.leftSplitter) || ns.Util.inRect(x, y, this.rightSplitter) || this.playlist.headerBoundary(x, y) >= 0) {
            window.SetCursor(IDC_SIZEWE);
        } else {
            window.SetCursor(IDC_ARROW);
        }
        return false;
    };

    FusionApp.prototype.mouseUp = function (x, y) {
        if (this.splitDrag) {
            this.splitDrag = '';
            window.SetCursor(IDC_ARROW);
            return true;
        }
        return this.manager.up() || this.playlist.up(x, y) || this.right.up() || this.bottom.up(x, y);
    };

    FusionApp.prototype.mouseLeave = function () {
        this.bottom.leave();
        window.SetCursor(IDC_ARROW);
    };

    FusionApp.prototype.doubleClick = function (x, y) {
        if (ns.Util.inRect(x, y, this.centreRect)) return this.playlist.doubleClick(x, y);
        return false;
    };

    FusionApp.prototype.context = function (x, y) {
        if (ns.Util.inRect(x, y, this.leftRect)) return this.manager.context(x, y);
        if (ns.Util.inRect(x, y, this.centreRect)) return this.playlist.context(x, y);
        if (ns.Util.inRect(x, y, this.bottom.rect)) return this.bottom.context(x, y);
        return false;
    };

    FusionApp.prototype.wheel = function (step) {
        var x = this.lastMouse.x;
        var y = this.lastMouse.y;
        if (this.bottom.wheel(x, y, step)) return true;
        if (this.right.wheel(x, y, step)) return true;
        if (ns.Util.inRect(x, y, this.leftRect)) return this.manager.wheel(step);
        if (ns.Util.inRect(x, y, this.centreRect)) return this.playlist.wheel(step);
        return false;
    };

    FusionApp.prototype.keyDown = function (vkey) {
        var ctrl = utils.IsKeyPressed(VK_CONTROL);
        var shift = utils.IsKeyPressed(VK_SHIFT);
        // JSplitter's bundled Flags.js does not expose VK_MENU.  Use the
        // documented Win32 virtual-key value for Alt explicitly.
        var alt = utils.IsKeyPressed(0x12);
        if (vkey === 0x4F && !ctrl && !shift && !alt) {
            fb.RunMainMenuCommand('File/Add files...');
            return true;
        }
        if (this.focusArea === 'playlists') return this.manager.key(vkey);
        return this.playlist.key(vkey);
    };

    FusionApp.prototype.drag = function (action, x, y, isDrop) {
        return this.playlist.externalDrag(action, x, y, isDrop);
    };

    FusionApp.prototype.dragLeave = function () {
        this.playlist.dragLeave();
    };

    ns.FusionApp = FusionApp;
})(FusionUI);
