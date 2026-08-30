'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourceRoot = path.resolve(__dirname, '..');

function run(relativePath, context) {
    const filename = path.join(sourceRoot, relativePath);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

function assertClose(actual, expected, epsilon = 1e-10) {
    assert(Math.abs(actual - expected) <= epsilon,
        `expected ${actual} to be within ${epsilon} of ${expected}`);
}

{
    const context = { FusionUI: {} };
    run('core/volume-mapping.js', context);
    const mapping = context.FusionUI.VolumeMapping;
    assert.deepStrictEqual(Array.from(mapping.ids), ['amplitude', 'dbLinear', 'legacy']);
    assert.strictEqual(mapping.defaultId, 'amplitude');
    assert.strictEqual(mapping.normalize('unknown'), 'amplitude');
    assertClose(mapping.toPosition(-20, 'amplitude'), 0.1);
    assertClose(mapping.toPosition(-50, 'dbLinear'), 0.5);
    assertClose(mapping.toPosition(-10, 'legacy'), 0.5);
    assert.strictEqual(mapping.toDb(0, 'amplitude'), -100);
    assert.strictEqual(mapping.toPosition(5, 'amplitude'), 1);
    assert.strictEqual(mapping.toDb(2, 'amplitude'), 0);
    for (const id of mapping.ids) {
        for (const db of [-100, -80, -50, -20, -10, 0]) {
            assertClose(mapping.toDb(mapping.toPosition(db, id), id), db, 1e-8);
        }
    }
}

function settingsContext(initial) {
    const properties = new Map(Object.entries(initial || {}));
    const context = {
        FusionUI: {
            Theme: { s: value => value },
            Util: { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) }
        },
        window: {
            GetProperty: (name, fallback) => properties.has(name) ? properties.get(name) : fallback,
            SetProperty: (name, value) => properties.set(name, value)
        },
        fb: {
            TitleFormat: expression => {
                if (expression === 'invalid-format') throw new Error('Invalid format');
                return { EvalWithMetadb: handle => handle ? String(handle.preview || '') : '' };
            }
        }
    };
    run('core/volume-mapping.js', context);
    run('core/settings.js', context);
    return { settings: context.FusionUI.Settings, properties };
}

{
    const result = settingsContext({
        'jsplitterFusion.column.order': 'index,title,length,artist,album'
    });
    assert.deepStrictEqual(Array.from(result.settings.columnOrder), [0, 1, 4, 2, 3, 5]);
    assert.strictEqual(result.properties.get('jsplitterFusion.column.order'),
        'index,title,length,artist,album,filename');
    assert.strictEqual(result.settings.columnVisible[5], false);
}

{
    const result = settingsContext();
    assert.deepStrictEqual(Array.from(result.settings.columnOrder), [0, 1, 2, 3, 5, 4]);
    assert.strictEqual(result.settings.nowPlayingFormat,
        '$if2(%title%,$if2(%filename_ext%,no title))');
    assert.strictEqual(result.settings.volumeMapping, 'amplitude');
    const changed = result.settings.setNowPlayingFormat('%artist% — %title%', { preview: 'Artist — Title' });
    assert.strictEqual(changed.ok, true);
    assert.strictEqual(changed.preview, 'Artist — Title');
    assert.strictEqual(result.settings.nowPlayingFormat, '%artist% — %title%');
    const empty = result.settings.setNowPlayingFormat('   ', null);
    assert.strictEqual(empty.ok, false);
    assert.strictEqual(result.settings.nowPlayingFormat, '%artist% — %title%');
    const invalid = result.settings.setNowPlayingFormat('invalid-format', null);
    assert.strictEqual(invalid.ok, false);
    assert.strictEqual(result.settings.nowPlayingFormat, '%artist% — %title%');
    result.settings.resetNowPlayingFormat();
    assert.strictEqual(result.settings.nowPlayingFormat,
        '$if2(%title%,$if2(%filename_ext%,no title))');
}

{
    const result = settingsContext({ 'jsplitterFusion.volume.mapping': 'unknown' });
    assert.strictEqual(result.settings.volumeMapping, 'amplitude');
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.mapping'), 'amplitude');
    assert.strictEqual(result.settings.setVolumeMapping('legacy'), 'legacy');
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.mapping'), 'legacy');
    assert.strictEqual(result.settings.setVolumeMapping('invalid'), 'amplitude');
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.mapping'), 'amplitude');
}

function detailRecord(overrides) {
    return Object.assign({
        title: 'Title', artist: 'Artist', albumArtist: 'Artist', album: 'Album', year: '2026',
        track: '1 / 2', disc: '1 / 1', genre: 'Genre', composer: 'No data', comment: 'No data',
        codec: 'FLAC', bitrate: '1000 kbps', samplerate: '44100 Hz', bitdepth: '16 bit',
        channels: 'stereo', length: '1:00', filesize: '1 KB', replaygainTrackGain: 'No data',
        replaygainTrackPeak: 'No data', replaygainAlbumGain: 'No data', replaygainAlbumPeak: 'No data',
        filename: 'track.flac', directory: 'Album', path: 'D:\\Album\\track.flac', modified: '2026'
    }, overrides || {});
}

function handleList(handles, duration, size) {
    handles.Count = handles.length;
    handles.CalcTotalDuration = () => duration;
    handles.CalcTotalSize = () => size;
    return handles;
}

{
    const nowPlaying = { RawPath: 'D:\\Now.flac', SubSong: 0, details: detailRecord({ title: 'Now' }) };
    const context = {
        FusionUI: {},
        fb: {
            IsPlaying: true,
            IsPaused: false,
            GetNowPlaying: () => nowPlaying,
            TitleFormat: () => ({ EvalWithMetadb: () => '', EvalWithMetadbs: () => [] })
        },
        plman: { PlaylistCount: 0 },
        utils: { FormatFileSize: bytes => bytes + ' B' }
    };
    run('core/utils.js', context);
    run('core/playlist-model.js', context);
    const model = new context.FusionUI.PlaylistModel();
    model.active = 0;
    model.details = handle => handle.details;

    const first = { RawPath: 'D:\\A.flac', SubSong: 0, details: detailRecord() };
    const second = { RawPath: 'D:\\B.flac', SubSong: 0,
        details: detailRecord({ title: 'Other', bitrate: '900 kbps', replaygainTrackGain: '-5.00 dB',
            filename: 'other.flac', path: 'D:\\Album\\other.flac' }) };
    const selected = handleList([first, second], 120, 3072);
    model.selectedHandles = () => selected;

    const selectedContext = model.displayContext();
    assert.strictEqual(selectedContext.source, 'selection');
    assert.strictEqual(selectedContext.count, 2);
    assert.strictEqual(selectedContext.singleHandle, null);
    const aggregate = model.detailsForContext(selectedContext);
    assert.strictEqual(aggregate.items, 2);
    assert.strictEqual(aggregate.artist, 'Artist');
    assert.strictEqual(aggregate.title, 'N/A');
    assert.strictEqual(aggregate.bitrate, 'N/A');
    assert.strictEqual(aggregate.composer, 'No data');
    assert.strictEqual(aggregate.replaygainTrackGain, 'N/A');
    assert.strictEqual(aggregate.replaygainAlbumGain, 'No data');
    assert.strictEqual(aggregate.length, '2:00');
    assert.strictEqual(aggregate.filesize, '3072 B');

    const unknown = handleList([
        { details: detailRecord({ length: 'No data', filesize: 'No data', path: 'No data' }) },
        { details: detailRecord({ length: 'No data', filesize: 'No data', path: 'No data' }) }
    ], 0, 0);
    const unknownAggregate = model.aggregateDetails(unknown);
    assert.strictEqual(unknownAggregate.length, 'No data');
    assert.strictEqual(unknownAggregate.filesize, 'N/A');

    model.selectedHandles = () => handleList([], 0, 0);
    const playbackContext = model.displayContext();
    assert.strictEqual(playbackContext.source, 'playback');
    assert.strictEqual(playbackContext.singleHandle, nowPlaying);

    context.fb.IsPlaying = false;
    const emptyContext = model.displayContext();
    assert.strictEqual(emptyContext.source, 'empty');
}

{
    let nowPlaying = null;
    const context = {
        FusionUI: { Settings: { nowPlayingFormat: '$if2(%title%,$if2(%filename_ext%,no title))' } },
        fb: {
            IsPlaying: true,
            IsPaused: false,
            GetNowPlaying: () => nowPlaying,
            TitleFormat: expression => ({
                EvalWithMetadb: handle => (handle.values && handle.values[expression]) || '',
                EvalWithMetadbs: () => []
            })
        },
        plman: { PlaylistCount: 0 },
        utils: { FormatFileSize: bytes => bytes + ' B' }
    };
    run('core/utils.js', context);
    run('core/playlist-model.js', context);
    const model = new context.FusionUI.PlaylistModel();
    const decodedPcm = {
        RawPath: 'D:\\pcm.wav',
        values: {
            '[%filename_ext%]': 'pcm.wav',
            '$if2(%title%,$if2(%filename_ext%,no title))': 'pcm.wav'
        },
        GetFileInfo: () => ({
            InfoFind: name => name === 'bitspersample' ? 2 : -1,
            InfoValue: index => index === 2 ? '16' : ''
        })
    };
    assert.strictEqual(model.details(decodedPcm).bitdepth, '16 bit');
    const decodedOnly = {
        RawPath: 'D:\\decoded.bin',
        values: { '[%decoded_bitspersample%]': '20' }
    };
    assert.strictEqual(model.details(decodedOnly).bitdepth, '20 bit');
    const storedWins = {
        RawPath: 'D:\\stored.wav',
        values: {
            '[%bitspersample%]': '24',
            '[%decoded_bitspersample%]': '32'
        },
        GetFileInfo: () => ({ InfoFind: () => 0, InfoValue: () => '16' })
    };
    assert.strictEqual(model.details(storedWins).bitdepth, '24 bit');
    assert.strictEqual(model.details({ RawPath: 'D:\\unknown.bin', values: {} }).bitdepth, 'No data');
    assert.strictEqual(model.details({ RawPath: 'D:\\unknown.bin', values: {} }).artist, 'No data');

    nowPlaying = decodedPcm;
    assert.strictEqual(model.nowPlayingSummary(), 'pcm.wav');
    context.fb.IsPlaying = false;
    assert.strictEqual(model.nowPlayingSummary(), '');
}

{
    const handles = [{}, {}, {}, {}, {}];
    handles.Count = handles.length;
    const directories = ['A', 'A', 'B', 'A', 'A'];
    const context = {
        FusionUI: {},
        fb: {
            TitleFormat: expression => ({
                EvalWithMetadbs: () => expression.indexOf('$info(CUE_SOURCE_PATH)') >= 0 ?
                    directories : ['', '', '', '', '']
            })
        },
        plman: {
            PlaylistCount: 1,
            ActivePlaylist: 0,
            GetPlaylistName: () => 'Test',
            GetPlaylistItems: () => handles
        },
        utils: {}
    };
    run('core/utils.js', context);
    run('core/playlist-model.js', context);
    const model = new context.FusionUI.PlaylistModel();
    const groups = model.rows.filter(row => row.type === 'group');
    assert.deepStrictEqual(Array.from(groups, group =>
        [group.directory, group.firstItem, group.itemCount]), [
        ['A', 0, 2],
        ['B', 2, 1],
        ['A', 3, 2]
    ]);
}

{
    const menuResults = [3, 2];
    const managerMenus = [];
    const managerCommands = [];
    let reloadItemsCount = 0;
    let activeContextCount = 0;
    function Scrollbar() {
        this.rect = null;
    }
    Scrollbar.prototype.configure = function (rect) { this.rect = rect; };
    Scrollbar.prototype.draw = function () {};
    Scrollbar.prototype.down = function () { return false; };
    Scrollbar.prototype.move = function () { return false; };
    Scrollbar.prototype.up = function () { return false; };
    Scrollbar.prototype.set = function () {};
    const context = {
        FusionUI: {
            Theme: { metrics: { header: 24, row: 24, scrollbar: 14 }, s: value => value },
            Util: {
                clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
                inRect: (x, y, rect) => !!rect && x >= rect.x && y >= rect.y &&
                    x < rect.x + rect.w && y < rect.y + rect.h
            },
            Scrollbar
        },
        plman: {
            PlaylistCount: 2,
            ActivePlaylist: 0,
            SetActivePlaylistContext: () => { activeContextCount += 1; }
        },
        fb: { RunMainMenuCommand: command => { managerCommands.push(command); } },
        window: {
            Repaint: () => {},
            CreatePopupMenu: () => {
                const entries = [];
                managerMenus.push(entries);
                return {
                    AppendMenuItem: (flags, id, label) => { entries.push({ flags, id, label }); },
                    AppendMenuSeparator: () => {},
                    TrackPopupMenu: () => menuResults.shift() || 0
                };
            }
        },
        MF_STRING: 0,
        MF_GRAYED: 1
    };
    run('views/playlist-manager.js', context);
    const model = {
        playlists: [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }],
        reloadItems: () => { reloadItemsCount += 1; }
    };
    const manager = new context.FusionUI.PlaylistManagerView(model);
    manager.layout({ x: 0, y: 0, w: 220, h: 96 });
    assert.strictEqual(manager.visible, 3);
    assert.strictEqual(manager.showScrollbar, false);
    assert.strictEqual(manager.scrollbar.rect.w, 0);
    assert.strictEqual(manager.hit(219, 25), 0);

    model.playlists.push({ name: 'Four' });
    manager.layout({ x: 0, y: 0, w: 220, h: 96 });
    assert.strictEqual(manager.showScrollbar, true);
    assert.strictEqual(manager.scrollbar.rect.w, 14);
    assert.strictEqual(manager.hit(219, 25), -1);

    manager.first = 1;
    model.playlists.length = 2;
    manager.layout({ x: 0, y: 0, w: 220, h: 96 });
    assert.strictEqual(manager.first, 0);
    assert.strictEqual(manager.showScrollbar, false);

    manager.context(10, 49);
    assert.strictEqual(context.plman.ActivePlaylist, 1);
    assert.strictEqual(reloadItemsCount, 1);
    assert.strictEqual(activeContextCount, 1);
    assert.deepStrictEqual(managerCommands, ['File/Save playlist...']);
    manager.context(10, 10);
    assert.deepStrictEqual(managerCommands, ['File/Save playlist...', 'File/Load playlist...']);
    const blankSaveItem = managerMenus[1].find(item => item.id === 3);
    assert.strictEqual(blankSaveItem.flags, context.MF_GRAYED);
}

{
    function Scrollbar() {}
    Scrollbar.prototype.set = function () {};
    const menuResults = [1, 2, 100, 0, 1, 2];
    const playlistMenus = [];
    const mainMenuCommands = [];
    const nativeMenuBuildStarts = [];
    const nativeMenuExecutions = [];
    const undoPlaylists = [];
    const removePlaylists = [];
    const clearedPlaylists = [];
    const groupSelections = [];
    const activeContexts = [];
    let selectedCount = 2;
    const context = {
        FusionUI: {
            Theme: { metrics: { header: 24 }, s: value => value },
            Util: { inRect: () => false },
            Settings: { getScroll: () => 0, getHScroll: () => 0 },
            Scrollbar
        },
        fb: {
            RunMainMenuCommand: command => { mainMenuCommands.push(command); },
            CreateContextMenuManager: () => ({
                InitContextPlaylist: () => {},
                BuildMenu: (menu, start) => { nativeMenuBuildStarts.push(start); },
                ExecuteByID: id => { nativeMenuExecutions.push(id); }
            })
        },
        plman: {
            UndoBackup: playlist => { undoPlaylists.push(playlist); },
            RemovePlaylistSelection: playlist => { removePlaylists.push(playlist); },
            ClearPlaylistSelection: playlist => { clearedPlaylists.push(playlist); },
            SetPlaylistSelection: (playlist, indices, state) => {
                groupSelections.push({ playlist, indices: Array.from(indices), state });
            },
            SetActivePlaylistContext: () => { activeContexts.push(true); }
        },
        window: {
            CreatePopupMenu: () => {
                const entries = [];
                playlistMenus.push(entries);
                return {
                    AppendMenuItem: (flags, id, label) => { entries.push({ flags, id, label }); },
                    AppendMenuSeparator: () => {},
                    TrackPopupMenu: () => menuResults.shift()
                };
            }
        },
        MF_STRING: 0,
        MF_GRAYED: 1
    };
    run('views/playlist-view.js', context);
    const model = {
        active: 0,
        count: () => 5,
        selectedHandles: () => ({ Count: selectedCount }),
        isSelected: () => true,
        select: () => {}
    };
    const playlist = new context.FusionUI.PlaylistView(model);
    playlist.rect = { x: 0, y: 0, w: 300, h: 200 };
    playlist.itemHit = () => 0;

    playlist.context(10, 30);
    assert.deepStrictEqual(undoPlaylists, [0]);
    assert.deepStrictEqual(removePlaylists, [0]);
    playlist.context(10, 30);
    assert.deepStrictEqual(mainMenuCommands, ['File/Add files...']);
    playlist.context(10, 30);
    assert.deepStrictEqual(nativeMenuExecutions, [0]);
    assert.deepStrictEqual(nativeMenuBuildStarts, [100, 100, 100]);

    selectedCount = 0;
    playlist.visualHit = () => null;
    playlist.context(10, 30);
    assert.strictEqual(playlistMenus[3][0].flags, context.MF_GRAYED);

    const repeatedDirectoryGroup = { type: 'group', directory: 'A', firstItem: 0, itemCount: 2 };
    playlist.visualHit = () => ({ visualIndex: 0, row: repeatedDirectoryGroup });
    playlist.context(10, 30);
    assert.deepStrictEqual(clearedPlaylists, [0]);
    assert.deepStrictEqual(groupSelections, [{ playlist: 0, indices: [0, 1], state: true }]);
    assert.deepStrictEqual(undoPlaylists, [0, 0]);
    assert.deepStrictEqual(removePlaylists, [0, 0]);
    assert.strictEqual(activeContexts.length, 1);

    playlist.context(10, 30);
    assert.deepStrictEqual(mainMenuCommands, ['File/Add files...', 'File/Add files...']);

    assert.strictEqual(playlist.removeGroup({ type: 'group', firstItem: 3, itemCount: 2 }), true);
    assert.deepStrictEqual(groupSelections[1], { playlist: 0, indices: [3, 4], state: true });
    const undoCount = undoPlaylists.length;
    assert.strictEqual(playlist.removeGroup({ type: 'group', firstItem: 4, itemCount: 2 }), false);
    assert.strictEqual(undoPlaylists.length, undoCount);
}

{
    const context = {
        FusionUI: {
            Theme: { s: value => value },
            Util: { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) },
            TransportControls: function () {}
        }
    };
    run('views/bottom-bar.js', context);
    const bar = new context.FusionUI.BottomBar({});
    bar.seekTrackRect = { x: 100, y: 20, w: 200, h: 18 };
    const start = bar.seekThumbGeometry(0);
    const nearEnd = bar.seekThumbGeometry(0.999);
    const end = bar.seekThumbGeometry(1);
    assert.strictEqual(start.x, 100);
    assert(nearEnd.x >= 100 && nearEnd.x + nearEnd.w <= 300);
    assert.strictEqual(end.x + end.w, 300);
    assert.strictEqual(start.w, 10);
}

{
    let resetCount = 0;
    const mainMenuCommands = [];
    const context = {
        FusionUI: {
            Theme: { s: value => value },
            Util: {
                clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
                inRect: (x, y, rect) => !!rect && x >= rect.x && y >= rect.y &&
                    x < rect.x + rect.w && y < rect.y + rect.h
            },
            Settings: {
                nowPlayingFormat: '%title%',
                resetNowPlayingFormat: () => { resetCount += 1; }
            }
        },
        fusionAssetPath: name => name,
        gdi: { Image: () => ({}) },
        fb: {
            IsPlaying: false,
            IsPaused: false,
            RunMainMenuCommand: command => { mainMenuCommands.push(command); }
        },
        plman: { PlaybackOrder: 0 },
        window: {
            CreatePopupMenu: () => ({
                AppendMenuItem: () => {},
                TrackPopupMenu: () => 2
            }),
            RepaintRect: () => {}
        },
        MF_STRING: 0
    };
    run('views/transport-controls.js', context);
    const controls = new context.FusionUI.TransportControls({ count: () => 0 });
    controls.invoke('shuffle');
    assert.strictEqual(context.plman.PlaybackOrder, 4);
    assert.strictEqual(controls.iconAlpha('shuffle', true), 255);
    assert.strictEqual(controls.iconAlpha('repeatTrack', true), 110);
    controls.invoke('repeatTrack');
    assert.strictEqual(context.plman.PlaybackOrder, 2);
    assert.strictEqual(controls.iconAlpha('shuffle', true), 110);
    assert.strictEqual(controls.iconAlpha('repeatTrack', true), 255);
    controls.invoke('repeatTrack');
    assert.strictEqual(context.plman.PlaybackOrder, 0);
    controls.invoke('addFiles');
    assert.deepStrictEqual(mainMenuCommands, ['File/Add files...']);
    controls.statusRect = { x: 20, y: 0, w: 100, h: 30 };
    assert.strictEqual(controls.context(30, 10), true);
    assert.strictEqual(resetCount, 1);
    assert.strictEqual(controls.context(10, 10), false);
}

{
    const context = {
        FusionUI: {
            Theme: { s: value => value, palette: {} },
            Util: {
                clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
                inRect: (x, y, rect) => !!rect && x >= rect.x && y >= rect.y &&
                    x < rect.x + rect.w && y < rect.y + rect.h,
                drawRaised: () => {}
            }
        },
        window: { Repaint: () => {} }
    };
    run('views/scrollbar.js', context);
    let verticalValue = 0;
    const vertical = new context.FusionUI.Scrollbar(
        () => verticalValue, value => { verticalValue = value; }, 'vertical', 3);
    vertical.configure({ x: 0, y: 0, w: 14, h: 100 }, 100, 10);
    assert.deepStrictEqual([vertical.trackRect.x, vertical.trackRect.y, vertical.trackRect.w, vertical.trackRect.h],
        [0, 14, 14, 72]);
    assert(vertical.thumb.y >= vertical.trackRect.y);
    assert.strictEqual(vertical.buttonEnabled('start'), false);
    assert.strictEqual(vertical.down(7, 93), true);
    assert.strictEqual(verticalValue, 3);
    vertical.up();
    vertical.down(7, 7);
    assert.strictEqual(verticalValue, 0);

    let horizontalValue = 0;
    const horizontal = new context.FusionUI.Scrollbar(
        () => horizontalValue, value => { horizontalValue = value; }, 'horizontal', () => 48);
    horizontal.configure({ x: 0, y: 0, w: 200, h: 14 }, 400, 200);
    assert.deepStrictEqual([horizontal.trackRect.x, horizontal.trackRect.y,
        horizontal.trackRect.w, horizontal.trackRect.h], [14, 0, 172, 14]);
    horizontal.down(193, 7);
    assert.strictEqual(horizontalValue, 48);
}

{
    const drawnText = [];
    const context = {
        FusionUI: {
            Theme: {
                s: value => value,
                palette: { base: 0, text: 1, highlight: 2, border: 3 },
                darkPalette: { remaining: 4 },
                fonts: { normal: {} }
            },
            TransportControls: function () {}
        },
        fb: { IsPlaying: false, IsPaused: false, PlaybackLength: 8, PlaybackTime: 0 },
        window: { Repaint: () => {}, RepaintRect: () => {} },
        DT_LEFT: 0, DT_RIGHT: 0, DT_VCENTER: 0, DT_SINGLELINE: 0, DT_NOPREFIX: 0
    };
    run('core/utils.js', context);
    run('views/bottom-bar.js', context);
    const bar = new context.FusionUI.BottomBar({});
    bar.seekRect = { x: 0, y: 0, w: 300, h: 36 };
    bar.seekTrackRect = { x: 70, y: 9, w: 160, h: 18 };
    bar.elapsedRect = { x: 0, y: 0, w: 60, h: 36 };
    bar.remainingRect = { x: 240, y: 0, w: 60, h: 36 };
    const graphics = {
        FillSolidRect: () => {}, FillRoundRect: () => {}, PushClip: () => {}, PopClip: () => {},
        DrawLine: () => {}, GdiDrawText: text => drawnText.push(text)
    };
    bar.drawProgress(graphics);
    assert.deepStrictEqual(drawnText, ['00:00', '00:00']);
    drawnText.length = 0;
    context.fb.IsPlaying = true;
    context.fb.PlaybackLength = 0;
    context.fb.PlaybackTime = 12;
    bar.drawProgress(graphics);
    assert.deepStrictEqual(drawnText, ['0:12', 'N/A']);
}

{
    const menuItems = [];
    const checkedItems = [];
    const repaints = [];
    let volumeUpCount = 0;
    let volumeDownCount = 0;
    let popupResult = 2;
    const context = {
        FusionUI: {
            Theme: { s: value => value },
            Util: {
                clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
                inRect: (x, y, rect) => !!rect && x >= rect.x && y >= rect.y &&
                    x < rect.x + rect.w && y < rect.y + rect.h
            },
            Settings: {
                volumeMapping: 'amplitude',
                setVolumeMapping(value) { this.volumeMapping = value; return value; }
            },
            TransportControls: function () { this.context = () => false; }
        },
        fb: {
            Volume: -20,
            VolumeUp: () => { volumeUpCount += 1; },
            VolumeDown: () => { volumeDownCount += 1; }
        },
        window: {
            CreatePopupMenu: () => ({
                AppendMenuItem: (_flags, id, label) => menuItems.push({ id, label }),
                CheckMenuRadioItem: (first, last, selected) => checkedItems.push({ first, last, selected }),
                TrackPopupMenu: () => popupResult
            }),
            RepaintRect: (...args) => repaints.push(args)
        },
        MF_STRING: 0
    };
    run('core/volume-mapping.js', context);
    run('views/bottom-bar.js', context);
    const bar = new context.FusionUI.BottomBar({});
    bar.summaryRect = { x: 0, y: 0, w: 180, h: 24 };
    bar.volumeControlRect = { x: 0, y: 0, w: 120, h: 24 };
    bar.volumeRect = { x: 70, y: 9, w: 101, h: 6 };
    assertClose(bar.volumePosition(), 0.1);
    bar.setVolumeFromX(80);
    assertClose(context.fb.Volume, -20);
    const volumeBeforeMenu = context.fb.Volume;
    assert.strictEqual(bar.context(10, 10), true);
    assert.strictEqual(context.FusionUI.Settings.volumeMapping, 'dbLinear');
    assert.strictEqual(context.fb.Volume, volumeBeforeMenu);
    assert.deepStrictEqual(menuItems.map(item => item.label), ['真实振幅', 'dB 线性', '旧版曲线']);
    assert.deepStrictEqual(checkedItems, [{ first: 1, last: 3, selected: 1 }]);
    assert.deepStrictEqual(repaints, [[0, 0, 120, 24]]);
    popupResult = 0;
    assert.strictEqual(bar.context(80, 10), true);
    assert.strictEqual(context.FusionUI.Settings.volumeMapping, 'dbLinear');
    assert.strictEqual(bar.wheel(80, 10, 1), true);
    assert.strictEqual(bar.wheel(80, 10, -1), true);
    assert.strictEqual(volumeUpCount, 1);
    assert.strictEqual(volumeDownCount, 1);
}

const playlistSource = fs.readFileSync(path.join(sourceRoot, 'views/playlist-view.js'), 'utf8');
assert(playlistSource.includes("'Filename'"));
assert(playlistSource.includes('columnIndex === 5'));

const mainSource = fs.readFileSync(path.join(sourceRoot, 'main.js'), 'utf8');
assert(mainSource.includes('include(relativePath);'));
assert(!mainSource.includes('include(fusionRoot + relativePath);'));
assert(mainSource.indexOf("fusionInclude('core\\\\volume-mapping.js');") <
    mainSource.indexOf("fusionInclude('core\\\\settings.js');"));

console.log('JSplitter Fusion tests passed');
