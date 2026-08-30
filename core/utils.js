(function (ns) {
    'use strict';

    var U = {};

    U.clamp = function (value, min, max) {
        return Math.max(min, Math.min(max, value));
    };

    U.inRect = function (x, y, rect) {
        return !!rect && x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
    };

    U.formatClock = function (seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        seconds = Math.floor(seconds);
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = seconds % 60;
        if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        return m + ':' + (s < 10 ? '0' : '') + s;
    };

    U.formatSelectionDuration = function (seconds) {
        if (!isFinite(seconds) || seconds <= 0) return '0:00';
        return U.formatClock(seconds);
    };

    U.handleKey = function (handle) {
        if (!handle) return '';
        return String(handle.RawPath || handle.Path || '') + '#' + String(handle.SubSong || 0);
    };

    U.safeText = function (value) {
        value = value == null ? '' : String(value).trim();
        return value.length ? value : 'No data';
    };

    U.eval = function (titleFormat, handle) {
        if (!handle) return '';
        try {
            return titleFormat.EvalWithMetadb(handle);
        } catch (e) {
            return '';
        }
    };

    U.drawText = function (gr, text, font, colour, rect, flags) {
        if (rect.w <= 0 || rect.h <= 0) return;
        gr.GdiDrawText(String(text), font, colour, rect.x, rect.y, rect.w, rect.h,
            flags == null ? DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX : flags);
    };

    U.drawRaised = function (gr, rect, fill) {
        var p = ns.Theme.palette;
        gr.FillSolidRect(rect.x, rect.y, rect.w, rect.h, fill == null ? p.button : fill);
        gr.DrawLine(rect.x, rect.y, rect.x + rect.w - 1, rect.y, 1, p.lightBorder);
        gr.DrawLine(rect.x, rect.y, rect.x, rect.y + rect.h - 1, 1, p.lightBorder);
        gr.DrawLine(rect.x, rect.y + rect.h - 1, rect.x + rect.w - 1, rect.y + rect.h - 1, 1, p.border);
        gr.DrawLine(rect.x + rect.w - 1, rect.y, rect.x + rect.w - 1, rect.y + rect.h - 1, 1, p.border);
    };

    U.drawSunken = function (gr, rect, fill) {
        var p = ns.Theme.palette;
        gr.FillSolidRect(rect.x, rect.y, rect.w, rect.h, fill == null ? p.base : fill);
        gr.DrawLine(rect.x, rect.y, rect.x + rect.w - 1, rect.y, 1, p.darkBorder);
        gr.DrawLine(rect.x, rect.y, rect.x, rect.y + rect.h - 1, 1, p.darkBorder);
        gr.DrawLine(rect.x, rect.y + rect.h - 1, rect.x + rect.w - 1, rect.y + rect.h - 1, 1, p.lightBorder);
        gr.DrawLine(rect.x + rect.w - 1, rect.y, rect.x + rect.w - 1, rect.y + rect.h - 1, 1, p.lightBorder);
    };

    U.showError = function (title, error) {
        var message = error && (error.stack || error.message) ? (error.stack || error.message) : String(error);
        try {
            console.log(title + ': ' + message);
        } catch (_) {}
        return title + '\n' + message;
    };

    ns.Util = U;
})(FusionUI);
