(function (ns) {
    'use strict';

    var ICON_CELL = 96;
    var VOLUME_RIGHT_OFFSET_DIP = 26;
    var ICON_INDEX = {
        stop: 0,
        play: 1,
        pause: 2,
        prev: 3,
        next: 4,
        shuffle: 5,
        addFiles: 6,
        repeatOne: 7,
        volumeUp: 8,
        volumeOff: 9
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
        this.muteRect = null;
        this.volumeLabelRect = null;
        this.volumeRect = null;
        this.volumeControlRect = null;
        this.volumeMenuRect = null;
        this.hovered = '';
        this.pressed = '';
        this.volumeDragging = false;
    }

    TransportControls.prototype.layout = function (rect) {
        this.rect = rect;
        var s = ns.Theme.s;
        var padding = Math.min(s(5), Math.floor(rect.w / 20));
        var gap = rect.w >= s(460) ? s(4) : 1;
        var buttonSize = Math.min(s(30), Math.max(1, rect.h - s(6)));
        var labelWidth = Math.min(s(66), Math.max(0, rect.w));
        var trackWidth = ns.Util.clamp(Math.round(rect.w * 0.15), s(96), s(180));
        var gapCount = BUTTONS.length + 3;
        var buttonCount = BUTTONS.length + 1;

        function fixedWidth(size, track, label, spacing) {
            return padding * 2 + buttonCount * size + track + label + gapCount * spacing;
        }

        if (fixedWidth(buttonSize, trackWidth, labelWidth, gap) > rect.w) {
            gap = 1;
            var availableForButtons = rect.w - padding * 2 - trackWidth - labelWidth - gapCount * gap;
            buttonSize = Math.min(buttonSize, Math.max(1, Math.floor(availableForButtons / buttonCount)));
        }
        if (fixedWidth(buttonSize, trackWidth, labelWidth, gap) > rect.w) {
            trackWidth = Math.max(0, rect.w - padding * 2 - buttonCount * buttonSize -
                labelWidth - gapCount * gap);
        }
        if (fixedWidth(buttonSize, trackWidth, labelWidth, gap) > rect.w) {
            labelWidth = Math.max(0, rect.w - padding * 2 - buttonCount * buttonSize -
                trackWidth - gapCount * gap);
        }
        if (fixedWidth(buttonSize, trackWidth, labelWidth, gap) > rect.w) {
            gap = 0;
            buttonSize = Math.min(buttonSize, Math.max(0, Math.floor(
                (rect.w - padding * 2 - trackWidth - labelWidth) / buttonCount)));
        }

        var buttonY = rect.y + Math.max(0, Math.floor((rect.h - buttonSize) / 2));
        var right = rect.x + rect.w - padding;
        var volumeHeight = Math.min(s(6), rect.h);
        var originalVolumeX = right - trackWidth;
        var originalLabelX = originalVolumeX - gap - labelWidth;
        var volumeOffset = Math.min(s(VOLUME_RIGHT_OFFSET_DIP),
            Math.max(0, originalLabelX - rect.x));
        this.volumeRect = {
            x: originalVolumeX - volumeOffset,
            y: rect.y + Math.floor((rect.h - volumeHeight) / 2),
            w: trackWidth,
            h: volumeHeight
        };
        this.volumeLabelRect = {
            x: originalLabelX - volumeOffset,
            y: rect.y,
            w: labelWidth,
            h: rect.h
        };
        this.muteRect = {
            id: 'mute',
            label: 'Mute',
            x: originalLabelX - gap - buttonSize,
            y: buttonY,
            w: buttonSize,
            h: buttonSize
        };
        var volumeEnd = this.volumeRect.x + this.volumeRect.w;
        this.volumeControlRect = {
            x: this.muteRect.x,
            y: rect.y,
            w: Math.max(0, volumeEnd - this.muteRect.x),
            h: rect.h
        };
        var menuLeft = Math.max(this.volumeLabelRect.x,
            this.muteRect.x + this.muteRect.w + gap);
        this.volumeMenuRect = {
            x: menuLeft,
            y: rect.y,
            w: Math.max(0, volumeEnd - menuLeft),
            h: rect.h
        };

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
        this.statusRect = {
            x: x,
            y: rect.y,
            w: Math.max(0, this.muteRect.x - gap - x),
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
        if (ns.Util.inRect(x, y, this.muteRect)) return 'mute';
        return '';
    };

    TransportControls.prototype.volumeHitRect = function () {
        var expansion = ns.Theme.s(4);
        return {
            x: this.volumeRect.x - expansion,
            y: this.rect.y,
            w: this.volumeRect.w + expansion * 2,
            h: this.rect.h
        };
    };

    TransportControls.prototype.playbackSummary = function () {
        return this.model.nowPlayingSummary();
    };

    TransportControls.prototype.volumePosition = function () {
        return ns.VolumeMapping.toPosition(fb.Volume, ns.Settings.volumeMode,
            ns.Settings.volumeCurveK, ns.Settings.volumeVirtualWidthK);
    };

    TransportControls.prototype.volumeText = function () {
        return fb.Volume <= -100 ? '\u2212\u221e dB' : fb.Volume.toFixed(2) + ' dB';
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

    TransportControls.prototype.showVolumeMappingMenu = function (x, y) {
        var menu = window.CreatePopupMenu();
        var virtualMode = ns.Settings.volumeMode === 'virtualWidth';
        var currentK = virtualMode ? ns.Settings.volumeVirtualWidthK : ns.Settings.volumeCurveK;
        var defaultK = virtualMode ? ns.VolumeMapping.defaultVirtualWidthK : ns.VolumeMapping.defaultCurveK;
        var current = ns.VolumeMapping.formatK(currentK, defaultK);
        menu.AppendMenuItem(MF_STRING, 1, '\u66f2\u7ebf\u7cfb\u6570\u6a21\u5f0f');
        menu.AppendMenuItem(MF_STRING, 2, '\u865a\u62df\u5bbd\u5ea6\u6a21\u5f0f');
        menu.CheckMenuRadioItem(1, 2, virtualMode ? 2 : 1);
        menu.AppendMenuSeparator();
        menu.AppendMenuItem(MF_STRING, 3,
            (virtualMode ? '\u865a\u62df\u5bbd\u5ea6\u500d\u7387 k\u2026\uff08\u5f53\u524d ' :
                '\u66f2\u7ebf\u7cfb\u6570 k\u2026\uff08\u5f53\u524d ') + current + '\uff09');
        menu.AppendMenuItem(MF_STRING, 4, '\u91cd\u7f6e\u4e3a ' + ns.VolumeMapping.formatK(defaultK, defaultK));
        menu.AppendMenuSeparator();
        menu.AppendMenuItem(MF_STRING, 5, '\u6253\u5f00\u8bf4\u660e');
        var result = menu.TrackPopupMenu(x, y);
        if (result === 1 || result === 2) {
            ns.Settings.setVolumeMode(result === 2 ? 'virtualWidth' : 'curve');
        } else if (result === 3) {
            var value;
            try {
                value = utils.InputBox(0,
                    '\u8bf7\u8f93\u5165\u5927\u4e8e 0 \u7684\u6709\u9650\u6570\u5b57 k\u3002',
                    virtualMode ? '\u865a\u62df\u5bbd\u5ea6\u500d\u7387' : '\u97f3\u91cf\u66f2\u7ebf\u7cfb\u6570', current, true);
            } catch (_) {
                return true;
            }
            var validation = virtualMode ? ns.Settings.setVolumeVirtualWidthK(value) :
                ns.Settings.setVolumeCurveK(value);
            if (!validation.ok) {
                utils.MessageBox('\u8bbe\u7f6e\u672a\u4fdd\u5b58\u3002\n\n' + validation.error,
                    '\u65e0\u6548\u7684\u97f3\u91cf\u6620\u5c04\u7cfb\u6570', MessageBoxButtons.Ok, MessageBoxIcon.Error);
                return true;
            }
        } else if (result === 4) {
            if (virtualMode) ns.Settings.resetVolumeVirtualWidthK();
            else ns.Settings.resetVolumeCurveK();
        } else if (result === 5) {
            utils.MessageBox(
                '\u66f2\u7ebf\u7cfb\u6570\u6a21\u5f0f\n' +
                'k \u8d8a\u4f4e\uff0c\u7ea6 -40\uff5e-10 dB \u7684\u5e38\u7528\u4e2d\u4f4e\u97f3\u91cf\u533a\u95f4\u8d8a\u7cbe\u7ec6\u3002\n\n' +
                '\u865a\u62df\u5bbd\u5ea6\u6a21\u5f0f\n' +
                'k \u8d8a\u9ad8\uff0c\u4e2d\u95f4\u50cf\u7d20\u7684\u97f3\u91cf\u6b65\u8fdb\u8d8a\u7cbe\u7ec6\uff1b' +
                '\u4f46\u6700\u540e\u4e00\u4e2a\u4e2d\u95f4\u50cf\u7d20\u5230 0 dB \u7684\u65ad\u5c42\u4e5f\u4f1a\u8d8a\u5927\u3002\n\n' +
                '\u4e24\u79cd\u6a21\u5f0f\u7684 k \u90fd\u5fc5\u987b\u662f\u5927\u4e8e 0 \u7684\u6709\u9650\u6570\u5b57\u3002',
                '\u97f3\u91cf\u6620\u5c04\u8bf4\u660e', MessageBoxButtons.Ok, MessageBoxIcon.Information);
        }
        if (result && result !== 5) {
            window.RepaintRect(this.volumeControlRect.x, this.volumeControlRect.y,
                this.volumeControlRect.w, this.volumeControlRect.h);
        }
        return true;
    };

    TransportControls.prototype.context = function (x, y) {
        if (ns.Util.inRect(x, y, this.volumeMenuRect)) return this.showVolumeMappingMenu(x, y);
        if (ns.Util.inRect(x, y, this.statusRect)) return this.showNowPlayingMenu(x, y);
        return false;
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
        if (id === 'mute') return fb.Volume <= -100 ? 'volumeOff' : 'volumeUp';
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

    TransportControls.prototype.drawButton = function (gr, rect) {
        var enabled = this.isEnabled(rect.id);
        this.drawButtonBackground(gr, rect, rect.id, enabled);
        this.drawIcon(gr, rect.id, rect, enabled);
    };

    TransportControls.prototype.drawVolume = function (gr) {
        if (!this.volumeRect || this.volumeRect.w <= 0 || this.volumeRect.h <= 0) return;
        var p = ns.Theme.palette;
        var ratio = this.volumePosition();
        gr.FillSolidRect(this.volumeRect.x, this.volumeRect.y, this.volumeRect.w, this.volumeRect.h, p.window);
        gr.DrawRect(this.volumeRect.x, this.volumeRect.y, Math.max(0, this.volumeRect.w - 1),
            Math.max(0, this.volumeRect.h - 1), 1, p.border);
        var fill = Math.round(this.volumeRect.w * ratio);
        if (fill > 0) gr.FillSolidRect(this.volumeRect.x, this.volumeRect.y, fill, this.volumeRect.h, p.highlight);
        var thumb = Math.min(ns.Theme.s(10), Math.max(2, this.rect.h - ns.Theme.s(5)));
        var cx = this.volumeRect.x + Math.round((this.volumeRect.w - 1) * ratio);
        var thumbX = ns.Util.clamp(cx - Math.floor(thumb / 2), this.volumeRect.x,
            this.volumeRect.x + this.volumeRect.w - thumb);
        var thumbY = this.rect.y + Math.floor((this.rect.h - thumb) / 2);
        gr.FillSolidRect(thumbX, thumbY, thumb, thumb, p.highlight);
        gr.DrawRect(thumbX, thumbY, Math.max(0, thumb - 1), Math.max(0, thumb - 1), 1, p.darkBorder);
    };

    TransportControls.prototype.draw = function (gr) {
        if (!this.rect || this.rect.w <= 0 || this.rect.h <= 0) return;
        var p = ns.Theme.palette;
        var f = ns.Theme.fonts;
        gr.FillSolidRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, p.base);
        for (var i = 0; i < this.buttonRects.length; ++i) this.drawButton(gr, this.buttonRects[i]);
        this.drawButton(gr, this.muteRect);
        ns.Util.drawText(gr, this.playbackSummary(), f.small, p.text, this.statusRect,
            DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        ns.Util.drawText(gr, this.volumeText(), f.small, p.text, this.volumeLabelRect,
            DT_RIGHT | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
        this.drawVolume(gr);
        gr.DrawLine(this.rect.x, this.rect.y + this.rect.h - 1,
            this.rect.x + this.rect.w, this.rect.y + this.rect.h - 1, 1, p.border);
    };

    TransportControls.prototype.setVolumeFromX = function (x) {
        var ratio = ns.Util.clamp((x - this.volumeRect.x) / Math.max(1, this.volumeRect.w - 1), 0, 1);
        fb.Volume = ns.VolumeMapping.toDb(ratio, ns.Settings.volumeMode,
            ns.Settings.volumeCurveK, ns.Settings.volumeVirtualWidthK);
        window.RepaintRect(this.volumeControlRect.x, this.volumeControlRect.y,
            this.volumeControlRect.w, this.volumeControlRect.h);
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
        else if (id === 'mute') fb.VolumeMute();
    };

    TransportControls.prototype.down = function (x, y) {
        if (ns.Util.inRect(x, y, this.volumeHitRect())) {
            this.volumeDragging = true;
            this.setVolumeFromX(x);
            return true;
        }
        var id = this.hit(x, y);
        if (!id || !this.isEnabled(id)) return false;
        this.pressed = id;
        window.RepaintRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        return true;
    };

    TransportControls.prototype.move = function (x, y) {
        if (this.volumeDragging) {
            this.setVolumeFromX(x);
            return true;
        }
        var next = this.hit(x, y);
        var changed = next !== this.hovered;
        this.hovered = next;
        if (changed && this.rect) window.RepaintRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        return changed || !!this.pressed;
    };

    TransportControls.prototype.up = function (x, y) {
        if (this.volumeDragging) {
            this.setVolumeFromX(x);
            this.volumeDragging = false;
            return true;
        }
        if (!this.pressed) return false;
        var id = this.pressed;
        this.pressed = '';
        if (this.hit(x, y) === id && this.isEnabled(id)) this.invoke(id);
        if (this.rect) window.RepaintRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        return true;
    };

    TransportControls.prototype.leave = function () {
        if (!this.hovered && !this.pressed && !this.volumeDragging) return false;
        this.hovered = '';
        this.pressed = '';
        this.volumeDragging = false;
        if (this.rect) window.RepaintRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        return true;
    };

    TransportControls.prototype.wheel = function (x, y, step) {
        if (!ns.Util.inRect(x, y, this.volumeMenuRect)) return false;
        if (step > 0) fb.VolumeUp(); else fb.VolumeDown();
        return true;
    };

    ns.TransportControls = TransportControls;
})(FusionUI);
