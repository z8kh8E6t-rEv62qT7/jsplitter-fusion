(function (ns) {
    'use strict';

    var ORDER_NAMES = [
        'Default',
        'Repeat Playlist',
        'Repeat Track',
        'Random',
        'Shuffle Tracks',
        'Shuffle Albums',
        'Shuffle Folders'
    ];

    var ICON_CELL = 96;
    var ICON_INDEX = {
        stop: 0,
        play: 1,
        pause: 2,
        prev: 3,
        next: 4,
        shuffle: 5,
        addFiles: 6,
        repeatOne: 7
    };
    var ICONS = gdi.Image(fusionAssetPath('transport-icons.png'));

    var BUTTONS = [
        { id: 'stop', label: 'Stop' },
        { id: 'playPause', label: 'Play / Pause' },
        { id: 'prev', label: 'Previous' },
        { id: 'next', label: 'Next' },
        { id: 'shuffle', label: 'Shuffle Tracks' },
        { id: 'repeatTrack', label: 'Repeat Track' },
        { id: 'addFiles', label: 'Add files' }
    ];

    function TransportControls(model) {
        this.model = model;
        this.rect = null;
        this.buttonRects = [];
        this.statusRect = null;
        this.orderRect = null;
        this.hovered = '';
        this.pressed = '';
    }

    TransportControls.prototype.layout = function (rect) {
        this.rect = rect;
        var s = ns.Theme.s;
        var padding = Math.min(s(5), Math.floor(rect.w / 20));
        var gap = rect.w >= s(460) ? s(4) : 1;
        var orderWidth = ns.Util.clamp(Math.round(rect.w * 0.18), s(72), s(152));
        var statusMinimum = rect.w >= s(480) ? s(48) : 0;
        var available = Math.max(0, rect.w - padding * 2 - orderWidth - statusMinimum - gap * 8);
        var buttonSize = Math.min(s(30), Math.floor(available / BUTTONS.length));
        if (buttonSize < 1) {
            orderWidth = Math.max(0, rect.w - padding * 2 - BUTTONS.length);
            buttonSize = Math.max(0, Math.floor((rect.w - padding * 2 - orderWidth) / BUTTONS.length));
            gap = 0;
        }

        var buttonY = rect.y + Math.max(0, Math.floor((rect.h - buttonSize) / 2));
        var x = rect.x + padding;
        this.buttonRects = [];
        for (var i = 0; i < BUTTONS.length; ++i) {
            this.buttonRects.push({
                id: BUTTONS[i].id,
                label: BUTTONS[i].label,
                x: x,
                y: buttonY,
                w: buttonSize,
                h: buttonSize
            });
            x += buttonSize + gap;
        }

        var orderHeight = Math.max(0, Math.min(s(28), rect.h - s(6)));
        this.orderRect = {
            x: Math.max(x + gap, rect.x + rect.w - padding - orderWidth),
            y: rect.y + Math.max(0, Math.floor((rect.h - orderHeight) / 2)),
            w: Math.max(0, Math.min(orderWidth, rect.x + rect.w - padding - Math.max(x + gap, rect.x + rect.w - padding - orderWidth))),
            h: orderHeight
        };
        this.statusRect = {
            x: x + gap,
            y: rect.y,
            w: Math.max(0, this.orderRect.x - x - gap * 2),
            h: rect.h
        };
    };

    TransportControls.prototype.isEnabled = function (id) {
        if (id === 'stop') return fb.IsPlaying;
        if (id === 'prev' || id === 'next') return fb.IsPlaying || this.model.count() > 0;
        return true;
    };

    TransportControls.prototype.hit = function (x, y) {
        for (var i = 0; i < this.buttonRects.length; ++i) {
            if (ns.Util.inRect(x, y, this.buttonRects[i])) return this.buttonRects[i].id;
        }
        if (ns.Util.inRect(x, y, this.orderRect)) return 'order';
        return '';
    };

    TransportControls.prototype.playbackSummary = function () {
        return this.model.nowPlayingSummary();
    };

    TransportControls.prototype.showNowPlayingMenu = function (x, y) {
        var menu = window.CreatePopupMenu();
        menu.AppendMenuItem(MF_STRING, 1, 'Now Playing format...');
        menu.AppendMenuItem(MF_STRING, 2, 'Reset to default');
        var result = menu.TrackPopupMenu(x, y);
        if (result === 1) {
            var value;
            try {
                value = utils.InputBox(0,
                    'Enter a foobar2000 Title Formatting expression.\n\nExample: %artist% \u2014 %title%',
                    'Now Playing format', ns.Settings.nowPlayingFormat, true);
            } catch (_) {
                return true;
            }
            var validation = ns.Settings.setNowPlayingFormat(value, this.model.nowPlayingHandle());
            if (!validation.ok) {
                utils.MessageBox('The format was not saved.\n\n' + validation.error,
                    'Invalid Now Playing format', MessageBoxButtons.Ok, MessageBoxIcon.Error);
            }
        } else if (result === 2) {
            ns.Settings.resetNowPlayingFormat();
        }
        if (result && this.statusRect) {
            window.RepaintRect(this.statusRect.x, this.statusRect.y, this.statusRect.w, this.statusRect.h);
        }
        return true;
    };

    TransportControls.prototype.context = function (x, y) {
        if (!ns.Util.inRect(x, y, this.statusRect)) return false;
        return this.showNowPlayingMenu(x, y);
    };

    TransportControls.prototype.drawButtonBackground = function (gr, rect, id, enabled) {
        var p = ns.Theme.palette;
        if (!enabled) return;
        if (this.pressed === id) {
            gr.FillSolidRect(rect.x, rect.y, rect.w, rect.h, p.buttonPressed);
            gr.DrawRect(rect.x, rect.y, Math.max(0, rect.w - 1), Math.max(0, rect.h - 1), 1, p.border);
        } else if (this.hovered === id) {
            gr.FillSolidRect(rect.x, rect.y, rect.w, rect.h, p.buttonHover);
            gr.DrawRect(rect.x, rect.y, Math.max(0, rect.w - 1), Math.max(0, rect.h - 1), 1, p.border);
        }
    };

    TransportControls.prototype.iconId = function (id) {
        if (id === 'playPause') return fb.IsPlaying && !fb.IsPaused ? 'pause' : 'play';
        if (id === 'repeatTrack') return 'repeatOne';
        return id;
    };

    TransportControls.prototype.iconAlpha = function (id, enabled) {
        if (!enabled) return 90;
        if (id === 'shuffle') return plman.PlaybackOrder === 4 ? 255 : 110;
        if (id === 'repeatTrack') return plman.PlaybackOrder === 2 ? 255 : 110;
        return 255;
    };

    TransportControls.prototype.drawIcon = function (gr, id, rect, enabled) {
        if (rect.w < 5 || rect.h < 5) return;
        var iconId = this.iconId(id);
        var index = ICON_INDEX[iconId];
        if (index == null) return;
        var size = Math.min(ns.Theme.s(22), Math.max(1, Math.min(rect.w, rect.h) - ns.Theme.s(6)));
        var x = rect.x + Math.floor((rect.w - size) / 2);
        var y = rect.y + Math.floor((rect.h - size) / 2);
        gr.SetInterpolationMode(7);
        gr.DrawImage(ICONS, x, y, size, size, index * ICON_CELL, 0, ICON_CELL, ICON_CELL, 0,
            this.iconAlpha(id, enabled));
        gr.SetInterpolationMode(0);
    };

    TransportControls.prototype.draw = function (gr) {
        if (!this.rect || this.rect.w <= 0 || this.rect.h <= 0) return;
        var p = ns.Theme.palette;
        var f = ns.Theme.fonts;
        gr.FillSolidRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, p.base);
        for (var i = 0; i < this.buttonRects.length; ++i) {
            var rect = this.buttonRects[i];
            var enabled = this.isEnabled(rect.id);
            this.drawButtonBackground(gr, rect, rect.id, enabled);
            this.drawIcon(gr, rect.id, rect, enabled);
        }
        ns.Util.drawText(gr, this.playbackSummary(), f.small, p.text, this.statusRect,
            DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);

        if (this.orderRect.w > 0 && this.orderRect.h > 0) {
            var orderActive = this.pressed === 'order';
            var orderHover = this.hovered === 'order';
            gr.FillSolidRect(this.orderRect.x, this.orderRect.y, this.orderRect.w, this.orderRect.h,
                orderActive ? p.buttonPressed : (orderHover ? p.buttonHover : p.base));
            gr.DrawRect(this.orderRect.x, this.orderRect.y, Math.max(0, this.orderRect.w - 1), Math.max(0, this.orderRect.h - 1), 1, p.border);
            var arrowWidth = Math.min(ns.Theme.s(16), Math.max(0, Math.floor(this.orderRect.w * 0.2)));
            ns.Util.drawText(gr, ORDER_NAMES[ns.Util.clamp(plman.PlaybackOrder, 0, ORDER_NAMES.length - 1)], f.small, p.text,
                { x: this.orderRect.x + ns.Theme.s(7), y: this.orderRect.y,
                    w: Math.max(0, this.orderRect.w - arrowWidth - ns.Theme.s(10)), h: this.orderRect.h });
            if (arrowWidth >= 4) {
                ns.Util.drawText(gr, '\u25be', f.small, p.text,
                    { x: this.orderRect.x + this.orderRect.w - arrowWidth - ns.Theme.s(2), y: this.orderRect.y,
                        w: arrowWidth, h: this.orderRect.h },
                    DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
            }
        }
        gr.DrawLine(this.rect.x, this.rect.y + this.rect.h - 1, this.rect.x + this.rect.w, this.rect.y + this.rect.h - 1, 1, p.border);
    };

    TransportControls.prototype.showOrderMenu = function () {
        var menu = window.CreatePopupMenu();
        for (var i = 0; i < ORDER_NAMES.length; ++i) menu.AppendMenuItem(MF_STRING, i + 1, ORDER_NAMES[i]);
        menu.CheckMenuRadioItem(1, ORDER_NAMES.length, ns.Util.clamp(plman.PlaybackOrder, 0, ORDER_NAMES.length - 1) + 1);
        var result = menu.TrackPopupMenu(this.orderRect.x, this.orderRect.y + this.orderRect.h);
        if (result >= 1 && result <= ORDER_NAMES.length) plman.PlaybackOrder = result - 1;
    };

    TransportControls.prototype.invoke = function (id) {
        if (id === 'stop') fb.Stop();
        else if (id === 'playPause') {
            if (fb.IsPlaying && !fb.IsPaused) fb.Pause();
            else fb.Play();
        }
        else if (id === 'prev') fb.Prev();
        else if (id === 'next') fb.Next();
        else if (id === 'shuffle') plman.PlaybackOrder = plman.PlaybackOrder === 4 ? 0 : 4;
        else if (id === 'repeatTrack') plman.PlaybackOrder = plman.PlaybackOrder === 2 ? 0 : 2;
        else if (id === 'addFiles') fb.RunMainMenuCommand('File/Add files...');
        else if (id === 'order') this.showOrderMenu();
    };

    TransportControls.prototype.down = function (x, y) {
        var id = this.hit(x, y);
        if (!id || (id !== 'order' && !this.isEnabled(id))) return false;
        this.pressed = id;
        window.RepaintRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        return true;
    };

    TransportControls.prototype.move = function (x, y) {
        var next = this.hit(x, y);
        var changed = next !== this.hovered;
        this.hovered = next;
        if (changed && this.rect) window.RepaintRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        return changed || !!this.pressed;
    };

    TransportControls.prototype.up = function (x, y) {
        if (!this.pressed) return false;
        var id = this.pressed;
        this.pressed = '';
        if (this.hit(x, y) === id && (id === 'order' || this.isEnabled(id))) this.invoke(id);
        if (this.rect) window.RepaintRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        return true;
    };

    TransportControls.prototype.leave = function () {
        if (!this.hovered && !this.pressed) return false;
        this.hovered = '';
        this.pressed = '';
        if (this.rect) window.RepaintRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        return true;
    };

    ns.TransportControls = TransportControls;
})(FusionUI);
