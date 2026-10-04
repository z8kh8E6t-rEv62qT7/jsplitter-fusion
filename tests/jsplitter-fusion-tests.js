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
    assert.deepStrictEqual(Array.from(mapping.modes), ['curve', 'virtualWidth', 'hybrid']);
    assert.strictEqual(mapping.defaultMode, 'curve');
    assert.strictEqual(mapping.defaultCurveK, 0.5);
    assert.strictEqual(mapping.defaultVirtualWidthK, 1);
    assert.strictEqual(mapping.defaultHybridCurveK, 0.5);
    assert.strictEqual(mapping.defaultHybridVirtualWidthK, 1);
    assert.strictEqual(mapping.normalizeMode('unknown'), 'curve');
    assertClose(mapping.curveToPosition(-20, 0.5), Math.pow(10, -0.5));
    assertClose(mapping.curveToPosition(-20, 1), 0.1);
    assertClose(mapping.curveToPosition(-20, 2), 0.01);
    assert.strictEqual(mapping.curveToDb(0, 0.5), -100);
    assert.strictEqual(mapping.curveToPosition(5, 0.5), 1);
    assert.strictEqual(mapping.curveToDb(2, 0.5), 0);
    assert.strictEqual(mapping.validateK('0,75').value, 0.75);
    assert.strictEqual(mapping.validateK('').ok, false);
    assert.strictEqual(mapping.validateK('not-a-number').ok, false);
    assert.strictEqual(mapping.validateK(0).ok, false);
    assert.strictEqual(mapping.validateK(-1).ok, false);
    assert.strictEqual(mapping.validateK(Infinity).ok, false);
    assert.strictEqual(mapping.validateK(-Infinity).ok, false);
    assert.strictEqual(mapping.validateK(0.000001).value, 0.000001);
    assert.strictEqual(mapping.validateK(1000000).value, 1000000);
    assert.strictEqual(mapping.normalizeK('invalid'), 0.5);
    assert.strictEqual(mapping.normalizeK('invalid', 0.5), 0.5);
    assert.strictEqual(mapping.formatK(0.5000, 0.5), '0.5');
    for (const k of [0.5, 1, 2]) {
        for (const db of [-100, -80, -50, -20, -10, 0]) {
            assertClose(mapping.curveToDb(mapping.curveToPosition(db, k), k), db, 1e-8);
        }
    }

    for (const k of [0.1, 1, 1.5, 2, 10]) {
        assert.strictEqual(mapping.virtualWidthToPosition(-100, k), 0);
        assert.strictEqual(mapping.virtualWidthToPosition(0, k), 1);
        assert.strictEqual(mapping.virtualWidthToDb(0, k), -100);
        assert.strictEqual(mapping.virtualWidthToDb(1, k), 0);
    }
    assertClose(mapping.virtualWidthToPosition(-20, 0.1), 0.01);
    assertClose(mapping.virtualWidthToPosition(-20, 1), 0.1);
    assertClose(mapping.virtualWidthToPosition(-20, 1.5), 0.15);
    assertClose(mapping.virtualWidthToPosition(-20, 2), 0.2);
    assert.strictEqual(mapping.virtualWidthToPosition(-20, 10), 1);
    assert.strictEqual(mapping.virtualWidthToPosition(-1, 1.5), 1);
    assertClose(mapping.virtualWidthToDb(0.1, 1.5), 20 * Math.log10(0.1 / 1.5));
    assertClose(mapping.virtualWidthToDb(0.99, 1.5), 20 * Math.log10(0.99 / 1.5));
    assert.strictEqual(mapping.virtualWidthToDb(1, 1.5), 0);
    assert.strictEqual(mapping.virtualWidthToDb(0.5, 0.1), 0);
    for (const pair of [[0.5, 1], [1, 1.5], [2, 0.1]]) {
        const [curveK, virtualWidthK] = pair;
        assert.strictEqual(mapping.hybridToPosition(-100, curveK, virtualWidthK), 0);
        assert.strictEqual(mapping.hybridToPosition(0, curveK, virtualWidthK), 1);
        assert.strictEqual(mapping.hybridToDb(0, curveK, virtualWidthK), -100);
        assert.strictEqual(mapping.hybridToDb(1, curveK, virtualWidthK), 0);
    }
    assertClose(mapping.hybridToPosition(-20, 0.5, 1.5), Math.pow(10, -0.5) * 1.5);
    assertClose(mapping.hybridToDb(0.25, 0.5, 1.5),
        20 * Math.log10(0.25 / 1.5) / 0.5);
    assert.strictEqual(mapping.hybridToPosition(-1, 0.5, 10), 1);
    assert.strictEqual(mapping.hybridToDb(0.5, 0.5, 0.1), 0);
    for (const pair of [[0.000001, 1000000], [1000000, 0.000001]]) {
        const position = mapping.hybridToPosition(-20, pair[0], pair[1]);
        const db = mapping.hybridToDb(0.5, pair[0], pair[1]);
        assert(Number.isFinite(position) && position >= 0 && position <= 1);
        assert(Number.isFinite(db) && db >= -100 && db <= 0);
    }
    assertClose(mapping.toPosition(-20, 'curve', 0.5, 1.5, 0.25, 2), Math.pow(10, -0.5));
    assertClose(mapping.toPosition(-20, 'virtualWidth', 0.5, 1.5, 0.25, 2), 0.15);
    assertClose(mapping.toPosition(-20, 'hybrid', 0.5, 1.5, 0.25, 0.5),
        Math.pow(10, -0.25) * 0.5);
    assertClose(mapping.toDb(0.1, 'curve', 0.5, 1.5, 0.25, 2), -40);
    assertClose(mapping.toDb(0.1, 'virtualWidth', 0.5, 1.5, 0.25, 2),
        20 * Math.log10(0.1 / 1.5));
    assertClose(mapping.toDb(0.5, 'hybrid', 0.5, 1.5, 0.25, 2),
        20 * Math.log10(0.5 / 2) / 0.25);
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
    return { settings: context.FusionUI.Settings, properties, context };
}

{
    const oldOrder = 'index,title,length,filesize,channels,bitdepth,samplerate,bitrate,codec,filename,album,artist';
    const result = settingsContext({
        'jsplitterFusion.column.order': oldOrder,
        'jsplitterFusion.column.title': 333,
        'jsplitterFusion.column.visible.artist': false
    });
    const settings = result.settings;
    assert.strictEqual(result.properties.get('jsplitterFusion.column.order'),
        oldOrder.replace('index,title', 'index,tracknumber,totaltracks,title'));
    assert.strictEqual(settings.columns[1], 333);
    assert.strictEqual(settings.columnVisible[2], false);
    assert.strictEqual(settings.columnVisible[12], true);
    assert.strictEqual(settings.columnVisible[13], true);
    const reordered = [0, 2, 12, 3, 5, 6, 7, 8, 9, 10, 11, 4, 1, 13];
    assert.strictEqual(settings.setColumnOrder(reordered), true);
    settings.setColumnVisible(1, false);
    settings.setColumnVisible(12, false);
    settings.setColumn(13, 85);
    const reloaded = settingsContext(Object.fromEntries(result.properties)).settings;
    assert.deepStrictEqual(Array.from(reloaded.columnOrder), reordered);
    assert.strictEqual(reloaded.columnVisible[1], false);
    assert.strictEqual(reloaded.columnVisible[12], false);
    assert.strictEqual(reloaded.columns[13], 85);
    for (const badIndex of [0, -1, 14, 1.5, NaN, undefined, '2']) {
        const invalid = reordered.slice();
        invalid[1] = badIndex;
        assert.strictEqual(settings.setColumnOrder(invalid), false);
        assert.deepStrictEqual(Array.from(settings.columnOrder), reordered);
    }
    const movedIndex = reordered.slice();
    [movedIndex[0], movedIndex[1]] = [movedIndex[1], movedIndex[0]];
    assert.strictEqual(settings.setColumnOrder(movedIndex), false);
    for (const invalid of [
        oldOrder.replace('title,length', 'length,title'),
        oldOrder.replace('artist', 'tracknumber'),
        oldOrder.replace('artist', 'unknown'),
        oldOrder.replace('artist', 'album'),
        result.properties.get('jsplitterFusion.column.order').replace('totaltracks', 'artist')
    ]) {
        const reset = settingsContext({ 'jsplitterFusion.column.order': invalid }).settings;
        assert.deepStrictEqual(Array.from(reset.columnOrder),
            [0, 12, 13, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 4]);
    }
}

{
    const result = settingsContext({
        'jsplitterFusion.column.order': 'index,title,length,artist,album'
    });
    assert.deepStrictEqual(Array.from(result.settings.columnOrder),
        [0, 12, 13, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 4]);
    assert.strictEqual(result.properties.get('jsplitterFusion.column.order'),
        'index,tracknumber,totaltracks,title,artist,album,filename,codec,bitrate,samplerate,bitdepth,channels,filesize,length');
    assert.strictEqual(result.settings.columnVisible[5], false);
    assert.strictEqual(result.settings.columnVisible[4], true);
    assert.deepStrictEqual(Array.from(result.settings.columnVisible.slice(6, 12)),
        [false, false, false, false, false, false]);
}

{
    const result = settingsContext({
        'jsplitterFusion.column.order': 'index,title,artist,album,filename,length'
    });
    assert.deepStrictEqual(Array.from(result.settings.columnOrder),
        [0, 12, 13, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 4]);
    assert.strictEqual(result.properties.get('jsplitterFusion.column.order'),
        'index,tracknumber,totaltracks,title,artist,album,filename,codec,bitrate,samplerate,bitdepth,channels,filesize,length');
}

{
    const result = settingsContext({
        'jsplitterFusion.column.order':
            'index,title,artist,album,filename,codec,bitrate,samplerate,bitdepth,channels,codec,length'
    });
    assert.deepStrictEqual(Array.from(result.settings.columnOrder),
        [0, 12, 13, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 4]);
    assert.strictEqual(result.properties.get('jsplitterFusion.column.order'),
        'index,tracknumber,totaltracks,title,artist,album,filename,codec,bitrate,samplerate,bitdepth,channels,filesize,length');
}

{
    const result = settingsContext();
    assert.deepStrictEqual(Array.from(result.settings.columnOrder),
        [0, 12, 13, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 4]);
    assert.strictEqual(result.settings.columnDefinitions.length, 14);
    assert.strictEqual(result.settings.nowPlayingFormat,
        '$if2(%title%,$if2(%filename_ext%,no title))');
    assert.strictEqual(result.settings.volumeMode, 'curve');
    assert.strictEqual(result.settings.volumeCurveK, 0.5);
    assert.strictEqual(result.settings.volumeVirtualWidthK, 1);
    assert.strictEqual(result.settings.volumeHybridCurveK, 0.5);
    assert.strictEqual(result.settings.volumeHybridVirtualWidthK, 1);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.mode'), 'curve');
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.curveK'), 0.5);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.virtualWidthK'), 1);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.hybridCurveK'), 0.5);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.hybridVirtualWidthK'), 1);
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
    const result = settingsContext({
        'jsplitterFusion.volume.mode': 'virtualWidth',
        'jsplitterFusion.volume.curveK': '0,75',
        'jsplitterFusion.volume.virtualWidthK': '1,5',
        'jsplitterFusion.volume.hybridCurveK': '0,25',
        'jsplitterFusion.volume.hybridVirtualWidthK': '2,5',
        'jsplitterFusion.volume.mapping': 'legacy'
    });
    assert.strictEqual(result.settings.volumeMode, 'virtualWidth');
    assert.strictEqual(result.settings.volumeCurveK, 0.75);
    assert.strictEqual(result.settings.volumeVirtualWidthK, 1.5);
    assert.strictEqual(result.settings.volumeHybridCurveK, 0.25);
    assert.strictEqual(result.settings.volumeHybridVirtualWidthK, 2.5);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.mapping'), 'legacy');
    assert.strictEqual(result.settings.setVolumeMode('curve'), 'curve');
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.mode'), 'curve');
    assert.strictEqual(result.settings.setVolumeCurveK('2').value, 2);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.curveK'), 2);
    assert.strictEqual(result.settings.setVolumeCurveK('invalid').ok, false);
    assert.strictEqual(result.settings.volumeCurveK, 2);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.curveK'), 2);
    assert.strictEqual(result.settings.resetVolumeCurveK(), 0.5);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.curveK'), 0.5);
    assert.strictEqual(result.settings.setVolumeVirtualWidthK('2,5').value, 2.5);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.virtualWidthK'), 2.5);
    assert.strictEqual(result.settings.setVolumeVirtualWidthK(20).value, 20);
    assert.strictEqual(result.settings.volumeVirtualWidthK, 20);
    assert.strictEqual(result.settings.resetVolumeVirtualWidthK(), 1);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.virtualWidthK'), 1);
    assert.strictEqual(result.settings.setVolumeMode('hybrid'), 'hybrid');
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.mode'), 'hybrid');
    assert.strictEqual(result.settings.setVolumeHybridCurveK('0,125').value, 0.125);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.hybridCurveK'), 0.125);
    assert.strictEqual(result.settings.setVolumeHybridCurveK(Infinity).ok, false);
    assert.strictEqual(result.settings.volumeHybridCurveK, 0.125);
    assert.strictEqual(result.settings.resetVolumeHybridCurveK(), 0.5);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.hybridCurveK'), 0.5);
    assert.strictEqual(result.settings.setVolumeHybridVirtualWidthK('3,5').value, 3.5);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.hybridVirtualWidthK'), 3.5);
    assert.strictEqual(result.settings.setVolumeHybridVirtualWidthK(-1).ok, false);
    assert.strictEqual(result.settings.volumeHybridVirtualWidthK, 3.5);
    assert.strictEqual(result.settings.resetVolumeHybridVirtualWidthK(), 1);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.hybridVirtualWidthK'), 1);
}

{
    const result = settingsContext({
        'jsplitterFusion.volume.mode': 'invalid',
        'jsplitterFusion.volume.curveK': 0,
        'jsplitterFusion.volume.virtualWidthK': 0,
        'jsplitterFusion.volume.hybridCurveK': 0,
        'jsplitterFusion.volume.hybridVirtualWidthK': Infinity
    });
    assert.strictEqual(result.settings.volumeMode, 'curve');
    assert.strictEqual(result.settings.volumeCurveK, 0.5);
    assert.strictEqual(result.settings.volumeVirtualWidthK, 1);
    assert.strictEqual(result.settings.volumeHybridCurveK, 0.5);
    assert.strictEqual(result.settings.volumeHybridVirtualWidthK, 1);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.mode'), 'curve');
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.curveK'), 0.5);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.virtualWidthK'), 1);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.hybridCurveK'), 0.5);
    assert.strictEqual(result.properties.get('jsplitterFusion.volume.hybridVirtualWidthK'), 1);
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
    const metadata = {
        '[%codec_long%]': ['FLAC', 'AAC', '', '', ''],
        '[%bitrate%]': ['1000', '256', '', '', ''],
        '[%samplerate%]': ['44100', '48000', '', '', ''],
        '[%bitspersample%]': ['', '24', '', '', ''],
        '[%decoded_bitspersample%]': ['16', '32', '', '', ''],
        '[%channels%]': ['stereo', 'stereo', '', '', ''],
        '[%filesize_natural%]': ['1 MB', '2 MB', '', '', '']
    };
    const context = {
        FusionUI: {},
        fb: {
            TitleFormat: expression => ({
                EvalWithMetadbs: () => expression.indexOf('$info(CUE_SOURCE_PATH)') >= 0 ?
                    directories : (metadata[expression] || ['', '', '', '', ''])
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
    assert.strictEqual(model.meta[0].codec, 'FLAC');
    assert.strictEqual(model.meta[0].bitrate, '1000 kbps');
    assert.strictEqual(model.meta[0].samplerate, '44100 Hz');
    assert.strictEqual(model.meta[0].bitdepth, '16 bit');
    assert.strictEqual(model.meta[0].channels, 'stereo');
    assert.strictEqual(model.meta[0].filesize, '1 MB');
    assert.strictEqual(model.meta[1].bitdepth, '24 bit');
    assert.strictEqual(model.meta[2].bitrate, 'No data');
    const groups = model.rows.filter(row => row.type === 'group');
    assert.deepStrictEqual(Array.from(groups, group =>
        [group.directory, group.firstItem, group.itemCount]), [
        ['A', 0, 2],
        ['B', 2, 1],
        ['A', 3, 2]
    ]);
    for (const [raw, expected] of [
        ['01', '1'], ['04', '4'], ['100', '100'], ['000', '0'], ['0', '0'],
        ['', ''], [null, ''], [undefined, ''], ['   ', ''], [' 004 ', '4'],
        ['A3', 'A3'], ['01/04', '01/04'], ['-1', '-1'], ['1.5', '1.5'],
        ['000123456789012345678901', '123456789012345678901']
    ]) {
        metadata['[%tracknumber%]'] = [raw];
        metadata['[%totaltracks%]'] = [raw];
        model.reloadItems();
        assert.strictEqual(model.meta[0].tracknumber, expected);
        assert.strictEqual(model.meta[0].totaltracks, expected);
        assert.strictEqual(model.meta[1].tracknumber, '');
        assert.strictEqual(model.meta[1].totaltracks, '');
    }
    metadata['[%tracknumber%]'] = ['01'];
    metadata['[%totaltracks%]'] = ['04'];
    model.reloadItems();
    assert.strictEqual(model.meta[0].tracknumber, '1');
    assert.strictEqual(model.meta[0].totaltracks, '4'); // Five items do not imply five album tracks.
    context.plman.GetPlaylistItems = () => ({ Count: 0 });
    model.reloadItems();
    assert.strictEqual(model.meta.length, 0);
    context.plman.PlaylistCount = 0;
    model.reloadItems();
    assert.strictEqual(model.handles, null);
}

{
    const { settings, context } = settingsContext();
    const menuEntries = [];
    let menuResult = 0;
    let released = 0;
    const graphics = { CalcTextWidth: text => String(text).length * 8 };
    Object.assign(context, {
        MF_STRING: 0, MF_GRAYED: 1,
        utils: { IsKeyPressed: () => false },
        gdi: { CreateImage: () => ({
            GetGraphics: () => graphics,
            ReleaseGraphics: () => { ++released; }
        }) }
    });
    Object.assign(context.window, {
        Repaint: () => {}, RepaintRect: () => {},
        CreatePopupMenu: () => ({
            AppendMenuItem: (flags, id, label) => menuEntries.push({ flags, id, label }),
            AppendMenuSeparator: () => {}, CheckMenuItem: () => {},
            TrackPopupMenu: () => menuResult
        })
    });
    Object.assign(context.FusionUI.Theme, {
        metrics: { header: 24, row: 24, scrollbar: 14, padding: 6 }, fonts: { normal: {} }
    });
    run('core/utils.js', context);
    run('views/scrollbar.js', context);
    run('views/playlist-view.js', context);
    const model = {
        active: -1, rows: [{ type: 'item', itemIndex: 0 }],
        meta: [{ title: 'Song', tracknumber: '1', totaltracks: '4' },
            { tracknumber: '', totaltracks: '' }]
    };
    const view = new context.FusionUI.PlaylistView(model);
    const rect = { x: 0, y: 0, w: 1800, h: 200 };
    view.layout(rect);
    assert.deepStrictEqual(Array.from(view.visibleColumns, column => column.name),
        ['#', '№', 'Total', 'Title', 'Artist', 'Album', 'Length']);
    assert.strictEqual(view.columnValue(0, 3), '4');
    assert.strictEqual(view.columnValue(12, 0), '1');
    assert.strictEqual(view.columnValue(13, 0), '4');
    assert.strictEqual(view.columnValue(12, 1), '');
    assert.strictEqual(view.columnValue(13, 1), '');
    assert.strictEqual(view.columnValue(2, 0), 'No data');
    assert.strictEqual(view.columnCentered(12), true);
    assert.strictEqual(view.columnCentered(13), true);

    function dragBefore(source, target) {
        const from = view.visibleColumns.find(column => column.index === source);
        const to = view.visibleColumns.find(column => column.index === target);
        const x = from.x + from.width / 2;
        const dropX = to.x + 5;
        assert.strictEqual(view.down(x, 12), true);
        assert.strictEqual(view.headerDownColumn, source);
        view.move(dropX, 12);
        assert.strictEqual(view.headerDropBefore, target);
        view.up(dropX, 12);
        assert.strictEqual(view.headerDownColumn, -1);
    }
    dragBefore(12, 2); // Across Title.
    assert(settings.columnOrder.indexOf(12) > settings.columnOrder.indexOf(1));
    dragBefore(12, 13); // Back to the default slot.
    assert.deepStrictEqual(Array.from(settings.columnOrder.slice(0, 4)), [0, 12, 13, 1]);
    dragBefore(1, 12);
    assert.deepStrictEqual(Array.from(settings.columnOrder.slice(0, 4)), [0, 1, 12, 13]);
    view.down(20, 12);
    assert.strictEqual(view.headerDownColumn, -1);
    view.headerDownColumn = 0;
    assert.strictEqual(view.commitHeaderDrop(), false);
    view.resetHeaderDrag();

    menuResult = 101; // Title can be hidden from the actual header menu.
    view.headerContext(20, 12);
    assert.strictEqual(menuEntries.find(entry => entry.id === 101).flags, context.MF_STRING);
    assert.strictEqual(settings.columnVisible[1], false);
    settings.setColumnVisible(0, false);
    view.layout(rect);
    dragBefore(13, 12);
    assert.strictEqual(view.visibleColumns[0].index, 13);
    assert.strictEqual(settings.columnOrder[0], 0);

    const total = view.visibleColumns[0];
    const boundary = total.x + total.width;
    view.down(boundary, 12);
    view.move(boundary + 30, 12);
    view.up(boundary + 30, 12);
    assert.strictEqual(settings.columns[13], 94);
    view.autoFitColumns([12, 13]);
    assert(settings.columns[13] >= graphics.CalcTextWidth('Total') + 12);
    assert.strictEqual(released, 1);
    view.layout({ x: 0, y: 0, w: 160, h: 200 });
    assert.strictEqual(view.showHorizontal, true);
    view.horizontalScrollbar.setValue(48);
    assert.strictEqual(view.visibleColumns[0].x, -48);

    for (let i = 0; i < settings.columnDefinitions.length; ++i) settings.setColumnVisible(i, false);
    view.layout(rect);
    assert.strictEqual(view.visibleColumns.length, 0);
    assert.strictEqual(view.contentWidth, 0);
    assert.strictEqual(view.horizontalOffset, 0);
    assert.strictEqual(view.showHorizontal, false);
    assert.strictEqual(view.headerColumnAt(20, 12), -1);
    menuResult = 112; // The blank header still exposes the menu to restore a column.
    view.headerContext(20, 12);
    assert.strictEqual(view.visibleColumns.length, 1);
    assert.strictEqual(view.visibleColumns[0].index, 12);
    view.down(20, 12);
    view.move(60, 12);
    assert.strictEqual(view.headerDropMarkerX, rect.x);
    view.up(60, 12);
    assert.strictEqual(settings.columnOrder[0], 0);
    settings.setColumnVisible(0, true);
    view.layout(rect);
    view.headerDownColumn = 12;
    view.updateHeaderDrop(100, 12);
    assert.strictEqual(view.headerDropMarkerX, settings.columns[0]);
    view.updateHeaderDrop(-1, 12);
    assert.strictEqual(view.headerDropMarkerX, null);
    view.resetHeaderDrag();
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
    let muteCount = 0;
    let volumeUpCount = 0;
    let volumeDownCount = 0;
    const mainMenuCommands = [];
    const menuItems = [];
    const checkedItems = [];
    const repaints = [];
    const messages = [];
    let separatorCount = 0;
    let popupResult = 2;
    let inputValue = '0,75';
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
                volumeMode: 'curve',
                volumeCurveK: 0.5,
                volumeVirtualWidthK: 1,
                volumeHybridCurveK: 0.5,
                volumeHybridVirtualWidthK: 1,
                resetNowPlayingFormat: () => { resetCount += 1; },
                setVolumeMode(value) {
                    this.volumeMode = context.FusionUI.VolumeMapping.normalizeMode(value);
                    return this.volumeMode;
                },
                setVolumeCurveK(value) {
                    const validation = context.FusionUI.VolumeMapping.validateK(value);
                    if (validation.ok) this.volumeCurveK = validation.value;
                    return validation;
                },
                resetVolumeCurveK() { this.volumeCurveK = 0.5; return this.volumeCurveK; },
                setVolumeVirtualWidthK(value) {
                    const validation = context.FusionUI.VolumeMapping.validateK(value);
                    if (validation.ok) this.volumeVirtualWidthK = validation.value;
                    return validation;
                },
                resetVolumeVirtualWidthK() {
                    this.volumeVirtualWidthK = 1;
                    return this.volumeVirtualWidthK;
                },
                setVolumeHybridCurveK(value) {
                    const validation = context.FusionUI.VolumeMapping.validateK(value);
                    if (validation.ok) this.volumeHybridCurveK = validation.value;
                    return validation;
                },
                resetVolumeHybridCurveK() {
                    this.volumeHybridCurveK = 0.5;
                    return this.volumeHybridCurveK;
                },
                setVolumeHybridVirtualWidthK(value) {
                    const validation = context.FusionUI.VolumeMapping.validateK(value);
                    if (validation.ok) this.volumeHybridVirtualWidthK = validation.value;
                    return validation;
                },
                resetVolumeHybridVirtualWidthK() {
                    this.volumeHybridVirtualWidthK = 1;
                    return this.volumeHybridVirtualWidthK;
                }
            }
        },
        fusionAssetPath: name => name,
        gdi: { Image: () => ({}) },
        fb: {
            IsPlaying: false,
            IsPaused: false,
            Volume: -20,
            RunMainMenuCommand: command => { mainMenuCommands.push(command); },
            VolumeMute: () => { muteCount += 1; },
            VolumeUp: () => { volumeUpCount += 1; },
            VolumeDown: () => { volumeDownCount += 1; }
        },
        plman: { PlaybackOrder: 0 },
        window: {
            CreatePopupMenu: () => ({
                AppendMenuItem: (_flags, id, label) => menuItems.push({ id, label }),
                CheckMenuRadioItem: (first, last, selected) => checkedItems.push({ first, last, selected }),
                AppendMenuSeparator: () => { separatorCount += 1; },
                TrackPopupMenu: () => popupResult
            }),
            RepaintRect: (...args) => repaints.push(args)
        },
        utils: {
            InputBox: () => inputValue,
            MessageBox: (message, title) => messages.push({ message, title })
        },
        MessageBoxButtons: { Ok: 0 },
        MessageBoxIcon: { Error: 0, Information: 1 },
        MF_STRING: 0
    };
    run('core/volume-mapping.js', context);
    run('views/transport-controls.js', context);
    const controls = new context.FusionUI.TransportControls({
        count: () => 0,
        nowPlayingSummary: () => 'Track'
    });
    controls.layout({ x: 0, y: 0, w: 800, h: 40 });
    assert.strictEqual(controls.volumeRect.w, 120);
    assert.strictEqual(controls.volumeRect.x + controls.volumeRect.w, 769);
    assert.strictEqual(795 - (controls.volumeRect.x + controls.volumeRect.w), 26);
    assert.strictEqual(controls.volumeLabelRect.x + controls.volumeLabelRect.w + 4,
        controls.volumeRect.x);
    assert(controls.volumeMenuRect.x >= controls.muteRect.x + controls.muteRect.w + 4);
    assert(controls.statusRect.x + controls.statusRect.w <= controls.muteRect.x);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(controls, 'orderRect'), false);

    controls.layout({ x: 0, y: 0, w: 320, h: 40 });
    assert.strictEqual(controls.volumeRect.w, 96);
    assert(controls.buttonRects[controls.buttonRects.length - 1].x +
        controls.buttonRects[controls.buttonRects.length - 1].w <= controls.muteRect.x);
    assert(controls.volumeRect.x + controls.volumeRect.w <= 320);

    controls.layout({ x: 0, y: 0, w: 5, h: 40 });
    assert(controls.buttonRects[controls.buttonRects.length - 1].x +
        controls.buttonRects[controls.buttonRects.length - 1].w <= controls.muteRect.x);
    assert(controls.volumeRect.x + controls.volumeRect.w <= 5);

    controls.layout({ x: 0, y: 0, w: 800, h: 40 });
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
    assert.strictEqual(controls.iconId('mute'), 'volumeUp');
    assert.strictEqual(controls.volumeText(), '-20.00 dB');
    context.fb.Volume = -100;
    assert.strictEqual(controls.iconId('mute'), 'volumeOff');
    assert.strictEqual(controls.volumeText(), '−∞ dB');
    context.fb.Volume = -20;
    controls.invoke('mute');
    assert.strictEqual(muteCount, 1);

    assert.strictEqual(controls.context(controls.statusRect.x + 1, 10), true);
    assert.strictEqual(resetCount, 1);
    menuItems.length = 0;
    popupResult = 10;
    const volumeBeforeMenu = context.fb.Volume;
    const positionBeforeMenu = controls.volumePosition();
    assert.strictEqual(controls.context(controls.volumeMenuRect.x + 1, 10), true);
    assert.strictEqual(context.FusionUI.Settings.volumeCurveK, 0.75);
    assert.strictEqual(context.fb.Volume, volumeBeforeMenu);
    assert.notStrictEqual(controls.volumePosition(), positionBeforeMenu);
    assert.deepStrictEqual(menuItems.map(item => item.label),
        ['曲线系数模式', '虚拟宽度模式', '混合模式', '曲线系数 k…（当前 0.5）', '重置为 0.5', '打开说明']);
    assert.deepStrictEqual(checkedItems, [{ first: 1, last: 3, selected: 1 }]);
    assert.strictEqual(separatorCount, 2);

    menuItems.length = 0;
    popupResult = 2;
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeMode, 'virtualWidth');
    assert.strictEqual(context.fb.Volume, volumeBeforeMenu);

    menuItems.length = 0;
    popupResult = 10;
    inputValue = '1,5';
    const virtualPositionBeforeMenu = controls.volumePosition();
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeVirtualWidthK, 1.5);
    assert.strictEqual(context.fb.Volume, volumeBeforeMenu);
    assert.notStrictEqual(controls.volumePosition(), virtualPositionBeforeMenu);
    assert.deepStrictEqual(menuItems.map(item => item.label),
        ['曲线系数模式', '虚拟宽度模式', '混合模式', '虚拟宽度倍率 k…（当前 1）', '重置为 1', '打开说明']);
    assert.deepStrictEqual(checkedItems[checkedItems.length - 1], { first: 1, last: 3, selected: 2 });

    menuItems.length = 0;
    popupResult = 11;
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeVirtualWidthK, 1);

    menuItems.length = 0;
    popupResult = 10;
    inputValue = '0';
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeVirtualWidthK, 1);
    assert.strictEqual(messages.length, 1);

    popupResult = 100;
    const repaintCountBeforeHelp = repaints.length;
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(messages.length, 2);
    assert.strictEqual(messages[1].title, '音量映射说明');
    assert(messages[1].message.includes('k 越低'));
    assert(messages[1].message.includes('k 越高'));
    assert(messages[1].message.includes('混合模式'));
    assert(messages[1].message.includes('position = 10^'));
    assert.strictEqual(repaints.length, repaintCountBeforeHelp);

    popupResult = 1;
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeMode, 'curve');
    popupResult = 11;
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeCurveK, 0.5);

    popupResult = 3;
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeMode, 'hybrid');
    assert.strictEqual(context.fb.Volume, volumeBeforeMenu);

    menuItems.length = 0;
    popupResult = 10;
    inputValue = '0,25';
    const hybridPositionBeforeMenu = controls.volumePosition();
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeHybridCurveK, 0.25);
    assert.strictEqual(context.fb.Volume, volumeBeforeMenu);
    assert.notStrictEqual(controls.volumePosition(), hybridPositionBeforeMenu);
    assert.deepStrictEqual(menuItems.map(item => item.label), [
        '曲线系数模式', '虚拟宽度模式', '混合模式',
        '混合曲线系数 k…（当前 0.5）', '重置为 0.5',
        '混合虚拟宽度倍率 k…（当前 1）', '重置为 1', '打开说明'
    ]);
    assert.deepStrictEqual(checkedItems[checkedItems.length - 1], { first: 1, last: 3, selected: 3 });

    popupResult = 12;
    inputValue = '1,5';
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeHybridVirtualWidthK, 1.5);
    popupResult = 11;
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeHybridCurveK, 0.5);
    popupResult = 13;
    controls.context(controls.volumeMenuRect.x + 1, 10);
    assert.strictEqual(context.FusionUI.Settings.volumeHybridVirtualWidthK, 1);

    controls.volumeRect = { x: 600, y: 17, w: 101, h: 6 };
    controls.volumeControlRect = { x: 500, y: 0, w: 295, h: 40 };
    controls.volumeMenuRect = { x: 530, y: 0, w: 265, h: 40 };
    assert.strictEqual(context.FusionUI.Settings.volumeMode, 'hybrid');
    controls.setVolumeFromX(610);
    assertClose(context.fb.Volume, -40);
    context.FusionUI.Settings.volumeHybridCurveK = 0.5;
    context.FusionUI.Settings.volumeHybridVirtualWidthK = 1.5;
    context.fb.Volume = -20;
    assertClose(controls.volumePosition(), Math.pow(10, -0.5) * 1.5);
    controls.setVolumeFromX(600);
    assert.strictEqual(context.fb.Volume, -100);
    controls.setVolumeFromX(699);
    assertClose(context.fb.Volume, 20 * Math.log10(0.99 / 1.5) / 0.5);
    controls.setVolumeFromX(700);
    assert.strictEqual(context.fb.Volume, 0);

    context.FusionUI.Settings.volumeMode = 'virtualWidth';
    context.FusionUI.Settings.volumeVirtualWidthK = 1.5;
    context.fb.Volume = -20;
    assertClose(controls.volumePosition(), 0.15);
    context.fb.Volume = -100;
    assert.strictEqual(controls.volumePosition(), 0);
    context.fb.Volume = 0;
    assert.strictEqual(controls.volumePosition(), 1);
    controls.setVolumeFromX(600);
    assert.strictEqual(context.fb.Volume, -100);
    controls.setVolumeFromX(699);
    assertClose(context.fb.Volume, 20 * Math.log10(0.99 / 1.5));
    controls.setVolumeFromX(700);
    assert.strictEqual(context.fb.Volume, 0);
    context.FusionUI.Settings.volumeVirtualWidthK = 0.1;
    controls.setVolumeFromX(650);
    assert.strictEqual(context.fb.Volume, 0);

    context.FusionUI.Settings.volumeVirtualWidthK = 1.5;
    assert.strictEqual(controls.down(596, 20), true);
    assert.strictEqual(context.fb.Volume, -100);
    assert.strictEqual(controls.up(596, 20), true);
    assert.strictEqual(controls.down(650, 20), true);
    assert.strictEqual(controls.volumeDragging, true);
    assert.strictEqual(controls.move(660, 20), true);
    assert.strictEqual(controls.up(670, 20), true);
    assert.strictEqual(controls.volumeDragging, false);
    assertClose(context.fb.Volume, 20 * Math.log10(0.7 / 1.5));
    controls.volumeRect = { x: 600, y: 17, w: 2, h: 6 };
    controls.setVolumeFromX(600);
    assert.strictEqual(context.fb.Volume, -100);
    controls.setVolumeFromX(601);
    assert.strictEqual(context.fb.Volume, 0);
    assert.strictEqual(controls.wheel(650, 10, 1), true);
    assert.strictEqual(controls.wheel(650, 10, -1), true);
    assert.strictEqual(volumeUpCount, 1);
    assert.strictEqual(volumeDownCount, 1);
    assert(repaints.length > 0);
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
                s: value => value * 2,
                metrics: { transportRow: 80, seekRow: 72 },
                palette: { base: 0, text: 1, highlight: 2, border: 3 },
                darkPalette: { remaining: 4 },
                fonts: { normal: {} }
            },
            TransportControls: function () { this.layout = () => {}; }
        },
        fb: { IsPlaying: false, IsPaused: false, PlaybackLength: 8, PlaybackTime: 0 },
        window: { Repaint: () => {}, RepaintRect: () => {} },
        DT_LEFT: 0, DT_RIGHT: 0, DT_VCENTER: 0, DT_SINGLELINE: 0, DT_NOPREFIX: 0
    };
    run('core/utils.js', context);
    run('views/bottom-bar.js', context);
    const bar = new context.FusionUI.BottomBar({});
    bar.layout({ x: 0, y: 0, w: 1000, h: 200 });
    assert.strictEqual(bar.elapsedTextRect.x - bar.elapsedRect.x, 38);
    assert.strictEqual((bar.remainingRect.x + bar.remainingRect.w) -
        (bar.remainingTextRect.x + bar.remainingTextRect.w), 38);
    bar.layout({ x: 0, y: 0, w: 200, h: 200 });
    assert(bar.elapsedTextRect.w > 0);
    assert(bar.remainingTextRect.w > 0);
    bar.layout({ x: 0, y: 0, w: 1000, h: 200 });
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
    const textRects = [];
    const context = {
        FusionUI: {
            Theme: {
                s: value => value,
                palette: { base: 0, text: 1, border: 2 },
                fonts: { small: {} }
            },
            Util: {
                formatSelectionDuration: seconds => `${seconds}s`,
                drawText: (_gr, _text, _font, _colour, rect) => textRects.push(rect)
            },
            TransportControls: function () {}
        },
        DT_LEFT: 0, DT_CENTER: 0, DT_RIGHT: 0, DT_VCENTER: 0, DT_SINGLELINE: 0,
        DT_END_ELLIPSIS: 0, DT_NOPREFIX: 0,
        fb: {}
    };
    run('views/bottom-bar.js', context);
    const model = {
        count: () => 10,
        playlistDuration: () => 120,
        displayContext: () => ({ count: 1 }),
        detailsForContext: () => ({
            length: '1:00', codec: 'FLAC', bitrate: '1000 kbps',
            samplerate: '44100 Hz', bitdepth: '16 bit', channels: 'stereo'
        })
    };
    const bar = new context.FusionUI.BottomBar(model);
    bar.summaryRect = { x: 0, y: 0, w: 1000, h: 24 };
    bar.drawSummary({ FillSolidRect: () => {}, DrawLine: () => {} });
    assert.strictEqual(textRects.length, 3);
    assert.strictEqual(textRects[2].x + textRects[2].w, 1000);
}

const playlistSource = fs.readFileSync(path.join(sourceRoot, 'views/playlist-view.js'), 'utf8');
assert(playlistSource.includes('columnDefinitions'));
assert(playlistSource.includes('definition.key'));

const columnSettingsSource = fs.readFileSync(path.join(sourceRoot, 'core/settings.js'), 'utf8');
for (const name of ['Filename', 'Codec', 'Bitrate', 'Sample rate', 'Bit depth', 'Channels', 'File size']) {
    assert(columnSettingsSource.includes(`name: '${name}'`));
}
for (const id of ['codec', 'bitrate', 'samplerate', 'bitdepth', 'channels', 'filesize']) {
    const definition = columnSettingsSource.match(new RegExp("\\{ id: '" + id + "'[^\\n]+"));
    assert(definition && definition[0].includes('visible: false'));
}

const mainSource = fs.readFileSync(path.join(sourceRoot, 'main.js'), 'utf8');
assert(mainSource.includes('include(relativePath);'));
assert(!mainSource.includes('include(fusionRoot + relativePath);'));
assert(mainSource.indexOf("fusionInclude('core\\\\volume-mapping.js');") <
    mainSource.indexOf("fusionInclude('core\\\\settings.js');"));
assert(mainSource.includes('bottom.transport.volumeControlRect'));

const transportSource = fs.readFileSync(path.join(sourceRoot, 'views/transport-controls.js'), 'utf8');
assert(!transportSource.includes('ORDER_NAMES'));
assert(!transportSource.includes('orderRect'));
assert(!transportSource.includes('showOrderMenu'));
assert(!transportSource.includes('VOLUME_MAPPING_MENU'));
assert(!transportSource.includes('setVolumeMapping'));
assert(transportSource.includes('CheckMenuRadioItem'));
assert(transportSource.includes('setVolumeMode'));
assert(transportSource.includes('setVolumeVirtualWidthK'));
assert(transportSource.includes('fb.VolumeMute()'));

const settingsSource = fs.readFileSync(path.join(sourceRoot, 'core/settings.js'), 'utf8');
assert(!settingsSource.includes("GetProperty(prefix + 'volume.mapping'"));
assert(settingsSource.includes("GetProperty(prefix + 'volume.mode'"));
assert(settingsSource.includes("readVolumeK('volume.curveK'"));
assert(settingsSource.includes("'volume.virtualWidthK'"));
assert(settingsSource.includes("'volume.hybridCurveK'"));
assert(settingsSource.includes("'volume.hybridVirtualWidthK'"));

const volumeMappingSource = fs.readFileSync(path.join(sourceRoot, 'core/volume-mapping.js'), 'utf8');
assert(!volumeMappingSource.includes('dbLinear'));
assert(!volumeMappingSource.includes('legacy'));

const bottomSource = fs.readFileSync(path.join(sourceRoot, 'views/bottom-bar.js'), 'utf8');
assert(!bottomSource.includes('volumeControlRect'));
assert(!bottomSource.includes('volumeDragging'));

const iconData = fs.readFileSync(path.join(sourceRoot, 'assets/transport-icons.png'));
assert.strictEqual(iconData.readUInt32BE(16), 960);
assert.strictEqual(iconData.readUInt32BE(20), 96);

require('./output-info-tests.js');
console.log('JSplitter Fusion tests passed');
