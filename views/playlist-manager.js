(function (ns) {
    'use strict';

    function PlaylistManagerView(model) {
        this.model = model;
        this.rect = null;
        this.first = 0;
        this.visible = 1;
        this.showScrollbar = false;
        this.downIndex = -1;
        this.dragIndex = -1;
        this.dropIndex = -1;
        this.downPoint = null;
        var self = this;
        this.scrollbar = new ns.Scrollbar(
            function () { return self.first; },
            function (value) { self.first = value; },
            'vertical',
            3
        );
    }

    PlaylistManagerView.prototype.layout = function (rect) {
        this.rect = rect;
        var m = ns.Theme.metrics;
        this.visible = Math.max(1, Math.floor((rect.h - m.header) / m.row));
        this.showScrollbar = this.model.playlists.length > this.visible;
        this.first = this.showScrollbar ?
            ns.Util.clamp(this.first, 0, this.model.playlists.length - this.visible) : 0;
        this.scrollbar.configure({
            x: rect.x + rect.w - (this.showScrollbar ? m.scrollbar : 0),
            y: rect.y + m.header,
            w: this.showScrollbar ? m.scrollbar : 0,
            h: rect.h - m.header
        }, this.model.playlists.length, this.visible);
    };

    PlaylistManagerView.prototype.draw = function (gr) {
        var p = ns.Theme.palette;
        var m = ns.Theme.metrics;
        var f = ns.Theme.fonts;
        if (this.rect.w <= 1 || this.rect.h <= 1) return;
        gr.FillSolidRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, p.base);
        ns.Util.drawRaised(gr, { x: this.rect.x, y: this.rect.y, w: this.rect.w, h: m.header });
        ns.Util.drawText(gr, 'Playlists', f.bold, p.text,
            { x: this.rect.x + m.padding, y: this.rect.y, w: this.rect.w - m.padding * 2, h: m.header });
        var contentWidth = Math.max(0, this.rect.w - (this.showScrollbar ? m.scrollbar : 0));
        for (var row = 0; row < this.visible; ++row) {
            var index = this.first + row;
            if (index >= this.model.playlists.length) break;
            var y = this.rect.y + m.header + row * m.row;
            var selected = index === plman.ActivePlaylist;
            var fill = selected ? p.highlight : (index % 2 ? p.alternateBase : p.base);
            gr.FillSolidRect(this.rect.x, y, contentWidth, m.row, fill);
            if (this.dragIndex >= 0 && this.dropIndex === index) {
                gr.FillSolidRect(this.rect.x, y, contentWidth, ns.Theme.s(2), p.highlight);
            }
            ns.Util.drawText(gr, this.model.playlists[index].name, f.normal,
                selected ? p.highlightText : p.text,
                { x: this.rect.x + m.padding, y: y, w: contentWidth - m.padding * 2, h: m.row });
            gr.DrawLine(this.rect.x, y + m.row - 1, this.rect.x + contentWidth, y + m.row - 1, 1, p.grid);
        }
        if (this.showScrollbar) this.scrollbar.draw(gr);
        gr.DrawRect(this.rect.x, this.rect.y, this.rect.w - 1, this.rect.h - 1, 1, p.border);
    };

    PlaylistManagerView.prototype.hit = function (x, y) {
        var m = ns.Theme.metrics;
        var contentRight = this.rect.x + this.rect.w - (this.showScrollbar ? m.scrollbar : 0);
        if (!ns.Util.inRect(x, y, this.rect) || y < this.rect.y + m.header || x >= contentRight) return -1;
        var index = this.first + Math.floor((y - this.rect.y - m.header) / m.row);
        return index < this.model.playlists.length ? index : -1;
    };

    PlaylistManagerView.prototype.activate = function (index) {
        if (index < 0 || index >= plman.PlaylistCount) return false;
        if (plman.ActivePlaylist !== index) {
            plman.ActivePlaylist = index;
            this.model.reloadItems();
        }
        plman.SetActivePlaylistContext();
        window.Repaint();
        return true;
    };

    PlaylistManagerView.prototype.down = function (x, y) {
        if (this.showScrollbar && this.scrollbar.down(x, y)) return true;
        var index = this.hit(x, y);
        if (index < 0) return false;
        this.downIndex = index;
        this.downPoint = { x: x, y: y };
        this.activate(index);
        return true;
    };

    PlaylistManagerView.prototype.move = function (x, y) {
        if (this.showScrollbar && this.scrollbar.move(x, y)) return true;
        if (this.downIndex < 0 || !this.downPoint) return false;
        if (this.dragIndex < 0) {
            var distance = Math.abs(x - this.downPoint.x) + Math.abs(y - this.downPoint.y);
            if (distance < ns.Theme.s(6)) return true;
            this.dragIndex = this.downIndex;
        }
        var hit = this.hit(x, y);
        this.dropIndex = hit < 0 ? this.model.playlists.length - 1 : hit;
        window.Repaint();
        return true;
    };

    PlaylistManagerView.prototype.up = function () {
        if (this.showScrollbar && this.scrollbar.up()) return true;
        if (this.dragIndex >= 0 && this.dropIndex >= 0 && this.dragIndex !== this.dropIndex) {
            plman.MovePlaylist(this.dragIndex, this.dropIndex);
        }
        var handled = this.downIndex >= 0;
        this.downIndex = -1;
        this.dragIndex = -1;
        this.dropIndex = -1;
        this.downPoint = null;
        if (handled) window.Repaint();
        return handled;
    };

    PlaylistManagerView.prototype.wheel = function (step) {
        if (!this.showScrollbar) return false;
        this.scrollbar.set(this.first - step * 3);
        return true;
    };

    PlaylistManagerView.prototype.create = function () {
        var name;
        try { name = utils.InputBox(0, '\u64ad\u653e\u5217\u8868\u540d\u79f0\uff1a', '\u65b0\u5efa\u64ad\u653e\u5217\u8868', '\u65b0\u5efa\u64ad\u653e\u5217\u8868', true); }
        catch (_) { return; }
        name = String(name || '').trim();
        if (!name) return;
        var index = plman.CreatePlaylist(plman.PlaylistCount, name);
        plman.ActivePlaylist = index;
    };

    PlaylistManagerView.prototype.rename = function (index) {
        if (index < 0 || index >= plman.PlaylistCount) return;
        var oldName = plman.GetPlaylistName(index);
        var name;
        try { name = utils.InputBox(0, '\u65b0\u540d\u79f0\uff1a', '\u91cd\u547d\u540d\u64ad\u653e\u5217\u8868', oldName, true); }
        catch (_) { return; }
        name = String(name || '').trim();
        if (name && name !== oldName) plman.RenamePlaylist(index, name);
    };

    PlaylistManagerView.prototype.remove = function (index) {
        if (index < 0 || index >= plman.PlaylistCount) return;
        var result = utils.MessageBox('\u5220\u9664\u64ad\u653e\u5217\u8868\u201c' + plman.GetPlaylistName(index) + '\u201d\uff1f\n\u97f3\u9891\u6587\u4ef6\u4e0d\u4f1a\u88ab\u5220\u9664\u3002',
            '\u5220\u9664\u64ad\u653e\u5217\u8868', MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (result === DialogResult.Yes) plman.RemovePlaylistSwitch(index);
    };

    PlaylistManagerView.prototype.context = function (x, y) {
        var index = this.hit(x, y);
        if (index >= 0) this.activate(index);
        var menu = window.CreatePopupMenu();
        menu.AppendMenuItem(MF_STRING, 1, '\u65b0\u5efa\u64ad\u653e\u5217\u8868...');
        menu.AppendMenuItem(MF_STRING, 2, '\u8f7d\u5165\u64ad\u653e\u5217\u8868...');
        menu.AppendMenuItem(index >= 0 ? MF_STRING : MF_GRAYED, 3, '\u4fdd\u5b58\u64ad\u653e\u5217\u8868...');
        menu.AppendMenuSeparator();
        menu.AppendMenuItem(index >= 0 ? MF_STRING : MF_GRAYED, 4, '\u91cd\u547d\u540d...');
        menu.AppendMenuItem(index >= 0 ? MF_STRING : MF_GRAYED, 5, '\u5220\u9664');
        var result = menu.TrackPopupMenu(x, y);
        if (result === 1) this.create();
        else if (result === 2) fb.RunMainMenuCommand('File/Load playlist...');
        else if (result === 3) fb.RunMainMenuCommand('File/Save playlist...');
        else if (result === 4) this.rename(index);
        else if (result === 5) this.remove(index);
        return true;
    };

    PlaylistManagerView.prototype.key = function (vkey) {
        var active = plman.ActivePlaylist;
        if (vkey === VK_UP && active > 0) plman.ActivePlaylist = active - 1;
        else if (vkey === VK_DOWN && active + 1 < plman.PlaylistCount) plman.ActivePlaylist = active + 1;
        else if (vkey === VK_HOME && plman.PlaylistCount) plman.ActivePlaylist = 0;
        else if (vkey === VK_END && plman.PlaylistCount) plman.ActivePlaylist = plman.PlaylistCount - 1;
        else if (vkey === 0x71) this.rename(active);
        else if (vkey === VK_INSERT) this.create();
        else if (vkey === VK_DELETE) this.remove(active);
        else return false;
        return true;
    };

    ns.PlaylistManagerView = PlaylistManagerView;
})(FusionUI);
