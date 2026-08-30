'use strict';

window.DefineScript('JSplitter Fusion', {
    author: '',
    options: { grab_focus: true },
    features: { drag_n_drop: true }
});

include(fb.ComponentPath + 'docs\\Flags.js');
include(fb.ComponentPath + 'docs\\Helpers.js');

var FusionUI = {};
var fusionRoot = fb.ProfilePath + 'jsplitter-fusion\\';
var fusionError = '';
var fusionApp = null;

function fusionInclude(relativePath) {
    include(relativePath);
}

function fusionAssetPath(relativePath) {
    return fusionRoot + 'assets\\' + relativePath;
}

try {
    fusionInclude('theme.js');
    fusionInclude('core\\utils.js');
    fusionInclude('core\\settings.js');
    fusionInclude('core\\playlist-model.js');
    fusionInclude('core\\artwork.js');
    fusionInclude('views\\scrollbar.js');
    fusionInclude('views\\playlist-manager.js');
    fusionInclude('views\\playlist-view.js');
    fusionInclude('views\\right-pane.js');
    fusionInclude('views\\transport-controls.js');
    fusionInclude('views\\bottom-bar.js');
    fusionInclude('views\\app.js');
    fusionApp = new FusionUI.FusionApp();
    fusionApp.layout(window.Width, window.Height);
} catch (e) {
    fusionError = e && (e.stack || e.message) ? (e.stack || e.message) : String(e);
    try { console.log('JSplitter Fusion startup error: ' + fusionError); } catch (_) {}
}

function guarded(action) {
    if (!fusionApp || fusionError) return false;
    try {
        return action();
    } catch (e) {
        fusionError = e && (e.stack || e.message) ? (e.stack || e.message) : String(e);
        try { console.log('JSplitter Fusion runtime error: ' + fusionError); } catch (_) {}
        window.Repaint();
        return false;
    }
}

function on_paint(gr) {
    if (fusionError || !fusionApp) {
        gr.FillSolidRect(0, 0, window.Width, window.Height, RGB(239, 239, 239));
        var font = gdi.Font('Segoe UI', Math.max(12, Math.round(12 * ((window.DPI || 96) / 96))), 0);
        gr.GdiDrawText('JSplitter Fusion \u811a\u672c\u9519\u8bef\n\n' + (fusionError || '\u521d\u59cb\u5316\u5931\u8d25'), font, RGB(176, 32, 32),
            12, 12, Math.max(0, window.Width - 24), Math.max(0, window.Height - 24), DT_LEFT | DT_TOP | DT_WORDBREAK | DT_NOPREFIX);
        return;
    }
    guarded(function () { fusionApp.draw(gr); });
}

function on_size() { guarded(function () { fusionApp.layout(window.Width, window.Height); window.Repaint(); }); }
function on_mouse_lbtn_down(x, y) { guarded(function () { return fusionApp.mouseDown(x, y); }); }
function on_mouse_lbtn_up(x, y) { guarded(function () { return fusionApp.mouseUp(x, y); }); }
function on_mouse_lbtn_dblclk(x, y) { guarded(function () { return fusionApp.doubleClick(x, y); }); }
function on_mouse_rbtn_up(x, y) { return guarded(function () { return fusionApp.context(x, y); }); }
function on_mouse_move(x, y) { guarded(function () { return fusionApp.mouseMove(x, y); }); }
function on_mouse_leave() { guarded(function () { fusionApp.mouseLeave(); }); }
function on_mouse_wheel(step) { return guarded(function () { return fusionApp.wheel(step); }); }
function on_key_down(vkey) { return guarded(function () { return fusionApp.keyDown(vkey); }); }

function on_drag_enter(action, x, y, mask) { guarded(function () { return fusionApp.drag(action, x, y, false); }); }
function on_drag_over(action, x, y, mask) { guarded(function () { return fusionApp.drag(action, x, y, false); }); }
function on_drag_drop(action, x, y, mask) { guarded(function () { return fusionApp.drag(action, x, y, true); }); }
function on_drag_leave() { guarded(function () { fusionApp.dragLeave(); }); }

function on_playlists_changed() { guarded(function () { fusionApp.reloadAll(); }); }
function on_playlist_switch() { guarded(function () { fusionApp.reloadAll(); }); }
function on_playlist_items_added(playlistIndex) { guarded(function () { fusionApp.reloadItems(playlistIndex); }); }
function on_playlist_items_removed(playlistIndex) { guarded(function () { fusionApp.reloadItems(playlistIndex); }); }
function on_playlist_items_reordered(playlistIndex) { guarded(function () { fusionApp.reloadItems(playlistIndex); }); }
function on_playlist_items_selection_change() { guarded(function () { fusionApp.selectionChanged(); }); }
function on_item_focus_change(playlistIndex) { guarded(function () { fusionApp.selectionChanged(); }); }

function on_playback_new_track() { guarded(function () { fusionApp.displayChanged(); }); }
function on_playback_dynamic_info_track() { guarded(function () { fusionApp.displayChanged(); }); }
function on_playback_starting() { guarded(function () { window.Repaint(); }); }
function on_playback_pause() { guarded(function () { window.Repaint(); }); }
function on_playback_stop() { guarded(function () { fusionApp.displayChanged(); }); }
function on_playback_time() {
    guarded(function () {
        var rect = fusionApp.bottom.rect;
        var seekY = rect.y + FusionUI.Theme.metrics.transportRow;
        window.RepaintRect(rect.x, seekY, rect.w, FusionUI.Theme.metrics.seekRow);
    });
}
function on_volume_change() {
    guarded(function () {
        var rect = fusionApp.bottom.rect;
        var summaryY = rect.y + FusionUI.Theme.metrics.transportRow + FusionUI.Theme.metrics.seekRow;
        window.RepaintRect(rect.x, summaryY, rect.w, Math.max(0, rect.y + rect.h - summaryY));
    });
}
function on_playback_order_changed() {
    guarded(function () {
        var rect = fusionApp.bottom.rect;
        window.RepaintRect(rect.x, rect.y, rect.w, FusionUI.Theme.metrics.transportRow);
    });
}
function on_metadb_changed() { guarded(function () { fusionApp.reloadItems(); }); }
function on_font_changed() {
    guarded(function () {
        FusionUI.Theme.refreshFonts();
        fusionApp.layout(window.Width, window.Height);
        window.Repaint();
    });
}
