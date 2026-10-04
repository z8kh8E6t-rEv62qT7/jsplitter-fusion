(function (ns) {
    'use strict';

    var prefix = 'jsplitterFusion.';
    var columnDefinitions = [
        { id: 'index', name: '#', key: '', width: 42, minWidth: 28, visible: true, centered: true },
        { id: 'title', name: 'Title', key: 'title', width: 260, minWidth: 64, visible: true, centered: false },
        { id: 'artist', name: 'Artist', key: 'artist', width: 150, minWidth: 64, visible: true, centered: false },
        { id: 'album', name: 'Album', key: 'album', width: 190, minWidth: 64, visible: true, centered: false },
        { id: 'length', name: 'Length', key: 'length', width: 70, minWidth: 44, visible: true, centered: true },
        { id: 'filename', name: 'Filename', key: 'filename', width: 160, minWidth: 64, visible: false, centered: false },
        { id: 'codec', name: 'Codec', key: 'codec', width: 120, minWidth: 64, visible: false, centered: false },
        { id: 'bitrate', name: 'Bitrate', key: 'bitrate', width: 100, minWidth: 64, visible: false, centered: false },
        { id: 'samplerate', name: 'Sample rate', key: 'samplerate', width: 110, minWidth: 64, visible: false, centered: false },
        { id: 'bitdepth', name: 'Bit depth', key: 'bitdepth', width: 90, minWidth: 64, visible: false, centered: false },
        { id: 'channels', name: 'Channels', key: 'channels', width: 90, minWidth: 64, visible: false, centered: false },
        { id: 'filesize', name: 'File size', key: 'filesize', width: 110, minWidth: 64, visible: false, centered: false },
        { id: 'tracknumber', name: '\u2116', key: 'tracknumber', width: 42, minWidth: 28, visible: true, centered: true },
        { id: 'totaltracks', name: 'Total', key: 'totaltracks', width: 64, minWidth: 48, visible: true, centered: true }
    ];
    var columnIds = columnDefinitions.map(function (column) { return column.id; });
    var defaultColumnOrder = [0, 12, 13, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 4];
    var defaultNowPlayingFormat = '$if2(%title%,$if2(%filename_ext%,no title))';

    function number(name, fallback, min, max) {
        var value = Number(window.GetProperty(prefix + name, fallback));
        if (!isFinite(value)) value = fallback;
        return ns.Util.clamp(value, min, max);
    }

    function set(name, value) {
        window.SetProperty(prefix + name, value);
    }

    function saveColumnOrder(order) {
        var ids = [];
        for (var i = 0; i < order.length; ++i) ids.push(columnIds[order[i]]);
        set('column.order', ids.join(','));
    }

    function resetColumnOrder() {
        var order = defaultColumnOrder.slice(0);
        saveColumnOrder(order);
        return order;
    }

    function boolean(name, fallback) {
        var value = window.GetProperty(prefix + name, fallback);
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        value = String(value).toLowerCase();
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        return fallback;
    }

    function validateNowPlayingFormat(value, handle) {
        var format = String(value == null ? '' : value);
        if (!format.trim()) return { ok: false, error: 'The format cannot be empty.' };
        try {
            var compiled = fb.TitleFormat(format);
            var preview = handle ? String(compiled.EvalWithMetadb(handle) || '') : '';
            return { ok: true, format: format, preview: preview };
        } catch (error) {
            return {
                ok: false,
                error: error && error.message ? String(error.message) : String(error)
            };
        }
    }

    function readNowPlayingFormat() {
        var value = window.GetProperty(prefix + 'nowPlaying.format', defaultNowPlayingFormat);
        var validation = validateNowPlayingFormat(value, null);
        if (validation.ok) return validation.format;
        set('nowPlaying.format', defaultNowPlayingFormat);
        return defaultNowPlayingFormat;
    }

    function readVolumeMode() {
        var value = window.GetProperty(prefix + 'volume.mode', '');
        var normalized = ns.VolumeMapping.normalizeMode(value);
        if (String(value) !== normalized) set('volume.mode', normalized);
        return normalized;
    }

    function readVolumeK(name, fallback) {
        var value = window.GetProperty(prefix + name, '');
        var validation = ns.VolumeMapping.validateK(value);
        if (validation.ok) return validation.value;
        set(name, fallback);
        return fallback;
    }

    function readColumnOrder() {
        var raw = String(window.GetProperty(prefix + 'column.order', ''));
        var parts = raw.split(',');
        var legacy = parts.length === 12;
        if (!legacy && parts.length !== columnIds.length) return resetColumnOrder();
        var seen = {};
        var order = [];
        for (var i = 0; i < parts.length; ++i) {
            var id = parts[i].trim();
            var index = columnIds.indexOf(id);
            if (index < 0 || seen[id] || (legacy && index >= 12)) return resetColumnOrder();
            seen[id] = true;
            order.push(index);
        }
        if (legacy) {
            // The previous schema required index and title in the first two positions.
            if (order[0] !== 0 || order[1] !== 1) return resetColumnOrder();
            order.splice(1, 0, 12, 13);
        }
        if (!validColumnOrder(order)) return resetColumnOrder();
        if (legacy) saveColumnOrder(order);
        return order;
    }

    function validColumnOrder(order) {
        if (!order || order.length !== columnIds.length || order[0] !== 0) return false;
        var seen = {};
        for (var i = 0; i < order.length; ++i) {
            var index = order[i];
            if (typeof index !== 'number' || index % 1 !== 0 ||
                    index < 0 || index >= columnIds.length || seen[index]) return false;
            seen[index] = true;
        }
        return true;
    }

    var columnWidths = [];
    var columnVisible = [];
    for (var columnIndex = 0; columnIndex < columnDefinitions.length; ++columnIndex) {
        var definition = columnDefinitions[columnIndex];
        columnWidths.push(number('column.' + definition.id, ns.Theme.s(definition.width),
            ns.Theme.s(definition.minWidth), ns.Theme.s(10000)));
        columnVisible.push(boolean('column.visible.' + definition.id, definition.visible));
    }

    ns.Settings = {
        leftWidth: number('leftWidth', ns.Theme.s(220), ns.Theme.s(150), ns.Theme.s(480)),
        rightWidth: number('rightWidth', ns.Theme.s(320), ns.Theme.s(220), ns.Theme.s(640)),
        defaultNowPlayingFormat: defaultNowPlayingFormat,
        nowPlayingFormat: readNowPlayingFormat(),
        volumeMode: readVolumeMode(),
        volumeCurveK: readVolumeK('volume.curveK', ns.VolumeMapping.defaultCurveK),
        volumeVirtualWidthK: readVolumeK('volume.virtualWidthK', ns.VolumeMapping.defaultVirtualWidthK),
        volumeHybridCurveK: readVolumeK('volume.hybridCurveK', ns.VolumeMapping.defaultHybridCurveK),
        volumeHybridVirtualWidthK: readVolumeK('volume.hybridVirtualWidthK',
            ns.VolumeMapping.defaultHybridVirtualWidthK),
        columnDefinitions: columnDefinitions,
        columnOrder: readColumnOrder(),
        columns: columnWidths,
        columnVisible: columnVisible,
        setLeftWidth: function (value) { this.leftWidth = value; set('leftWidth', value); },
        setRightWidth: function (value) { this.rightWidth = value; set('rightWidth', value); },
        validateNowPlayingFormat: validateNowPlayingFormat,
        setNowPlayingFormat: function (value, handle) {
            var validation = validateNowPlayingFormat(value, handle);
            if (!validation.ok) return validation;
            this.nowPlayingFormat = validation.format;
            set('nowPlaying.format', validation.format);
            return validation;
        },
        resetNowPlayingFormat: function () {
            this.nowPlayingFormat = defaultNowPlayingFormat;
            set('nowPlaying.format', defaultNowPlayingFormat);
        },
        setVolumeMode: function (value) {
            this.volumeMode = ns.VolumeMapping.normalizeMode(value);
            set('volume.mode', this.volumeMode);
            return this.volumeMode;
        },
        setVolumeCurveK: function (value) {
            var validation = ns.VolumeMapping.validateK(value);
            if (!validation.ok) return validation;
            this.volumeCurveK = validation.value;
            set('volume.curveK', this.volumeCurveK);
            return validation;
        },
        resetVolumeCurveK: function () {
            this.volumeCurveK = ns.VolumeMapping.defaultCurveK;
            set('volume.curveK', this.volumeCurveK);
            return this.volumeCurveK;
        },
        setVolumeVirtualWidthK: function (value) {
            var validation = ns.VolumeMapping.validateK(value);
            if (!validation.ok) return validation;
            this.volumeVirtualWidthK = validation.value;
            set('volume.virtualWidthK', this.volumeVirtualWidthK);
            return validation;
        },
        resetVolumeVirtualWidthK: function () {
            this.volumeVirtualWidthK = ns.VolumeMapping.defaultVirtualWidthK;
            set('volume.virtualWidthK', this.volumeVirtualWidthK);
            return this.volumeVirtualWidthK;
        },
        setVolumeHybridCurveK: function (value) {
            var validation = ns.VolumeMapping.validateK(value);
            if (!validation.ok) return validation;
            this.volumeHybridCurveK = validation.value;
            set('volume.hybridCurveK', this.volumeHybridCurveK);
            return validation;
        },
        resetVolumeHybridCurveK: function () {
            this.volumeHybridCurveK = ns.VolumeMapping.defaultHybridCurveK;
            set('volume.hybridCurveK', this.volumeHybridCurveK);
            return this.volumeHybridCurveK;
        },
        setVolumeHybridVirtualWidthK: function (value) {
            var validation = ns.VolumeMapping.validateK(value);
            if (!validation.ok) return validation;
            this.volumeHybridVirtualWidthK = validation.value;
            set('volume.hybridVirtualWidthK', this.volumeHybridVirtualWidthK);
            return validation;
        },
        resetVolumeHybridVirtualWidthK: function () {
            this.volumeHybridVirtualWidthK = ns.VolumeMapping.defaultHybridVirtualWidthK;
            set('volume.hybridVirtualWidthK', this.volumeHybridVirtualWidthK);
            return this.volumeHybridVirtualWidthK;
        },
        setColumn: function (index, value) {
            this.columns[index] = value;
            set('column.' + columnIds[index], value);
        },
        setColumnVisible: function (index, value) {
            this.columnVisible[index] = !!value;
            set('column.visible.' + columnIds[index], this.columnVisible[index]);
        },
        setColumnOrder: function (order) {
            if (!validColumnOrder(order)) return false;
            this.columnOrder = order.slice(0);
            saveColumnOrder(order);
            return true;
        },
        scrollKey: function (playlistIndex) {
            var id;
            try { id = plman.GetGUID(playlistIndex); } catch (_) { id = String(playlistIndex); }
            return prefix + 'scroll.' + String(id || playlistIndex);
        },
        getScroll: function (playlistIndex) {
            return Math.max(0, Number(window.GetProperty(this.scrollKey(playlistIndex), 0)) || 0);
        },
        setScroll: function (playlistIndex, value) {
            window.SetProperty(this.scrollKey(playlistIndex), Math.max(0, Math.floor(value)));
        },
        hscrollKey: function (playlistIndex) {
            var id;
            try { id = plman.GetGUID(playlistIndex); } catch (_) { id = String(playlistIndex); }
            return prefix + 'hscroll.' + String(id || playlistIndex);
        },
        getHScroll: function (playlistIndex) {
            return Math.max(0, Number(window.GetProperty(this.hscrollKey(playlistIndex), 0)) || 0);
        },
        setHScroll: function (playlistIndex, value) {
            window.SetProperty(this.hscrollKey(playlistIndex), Math.max(0, Math.floor(value)));
        }
    };
})(FusionUI);
