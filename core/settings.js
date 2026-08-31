(function (ns) {
    'use strict';

    var prefix = 'jsplitterFusion.';
    var columnIds = ['index', 'title', 'artist', 'album', 'length', 'filename'];
    var legacyColumnIds = ['index', 'title', 'artist', 'album', 'length'];
    var defaultColumnOrder = [0, 1, 2, 3, 5, 4];
    var defaultNowPlayingFormat = '$if2(%title%,$if2(%filename_ext%,no title))';

    function number(name, fallback, min, max) {
        var value = Number(window.GetProperty(prefix + name, fallback));
        if (!isFinite(value)) value = fallback;
        return ns.Util.clamp(value, min, max);
    }

    function set(name, value) {
        window.SetProperty(prefix + name, value);
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
        var migrated = false;
        if (parts.length === legacyColumnIds.length) {
            var legacySeen = {};
            for (var legacyIndex = 0; legacyIndex < parts.length; ++legacyIndex) {
                var legacyId = parts[legacyIndex].trim();
                if (legacyColumnIds.indexOf(legacyId) < 0 || legacySeen[legacyId]) return defaultColumnOrder.slice(0);
                legacySeen[legacyId] = true;
                parts[legacyIndex] = legacyId;
            }
            if (parts[0] !== 'index' || parts[1] !== 'title') return defaultColumnOrder.slice(0);
            parts.splice(parts.indexOf('album') + 1, 0, 'filename');
            migrated = true;
        }
        var seen = {};
        if (parts.length !== columnIds.length) return defaultColumnOrder.slice(0);
        var order = [];
        for (var i = 0; i < parts.length; ++i) {
            var id = parts[i].trim();
            var index = columnIds.indexOf(id);
            if (index < 0 || seen[id]) return defaultColumnOrder.slice(0);
            seen[id] = true;
            order.push(index);
        }
        if (!validColumnOrder(order)) return defaultColumnOrder.slice(0);
        if (migrated) set('column.order', parts.join(','));
        return order;
    }

    function validColumnOrder(order) {
        if (!order || order.length !== columnIds.length || order[0] !== 0 || order[1] !== 1) return false;
        var seen = {};
        for (var i = 0; i < order.length; ++i) {
            var index = order[i];
            if (index < 0 || index >= columnIds.length || seen[index]) return false;
            seen[index] = true;
        }
        return true;
    }

    ns.Settings = {
        leftWidth: number('leftWidth', ns.Theme.s(220), ns.Theme.s(150), ns.Theme.s(480)),
        rightWidth: number('rightWidth', ns.Theme.s(320), ns.Theme.s(220), ns.Theme.s(640)),
        defaultNowPlayingFormat: defaultNowPlayingFormat,
        nowPlayingFormat: readNowPlayingFormat(),
        volumeMode: readVolumeMode(),
        volumeCurveK: readVolumeK('volume.curveK', ns.VolumeMapping.defaultCurveK),
        volumeVirtualWidthK: readVolumeK('volume.virtualWidthK', ns.VolumeMapping.defaultVirtualWidthK),
        columnOrder: readColumnOrder(),
        columns: [
            number('column.index', ns.Theme.s(42), ns.Theme.s(28), ns.Theme.s(10000)),
            number('column.title', ns.Theme.s(260), ns.Theme.s(64), ns.Theme.s(10000)),
            number('column.artist', ns.Theme.s(150), ns.Theme.s(64), ns.Theme.s(10000)),
            number('column.album', ns.Theme.s(190), ns.Theme.s(64), ns.Theme.s(10000)),
            number('column.length', ns.Theme.s(70), ns.Theme.s(44), ns.Theme.s(10000)),
            number('column.filename', ns.Theme.s(160), ns.Theme.s(64), ns.Theme.s(10000))
        ],
        columnVisible: [
            boolean('column.visible.index', true),
            true,
            boolean('column.visible.artist', true),
            boolean('column.visible.album', true),
            boolean('column.visible.length', true),
            boolean('column.visible.filename', false)
        ],
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
        setColumn: function (index, value) {
            this.columns[index] = value;
            set('column.' + columnIds[index], value);
        },
        setColumnVisible: function (index, value) {
            if (index === 1) value = true;
            this.columnVisible[index] = !!value;
            set('column.visible.' + columnIds[index], this.columnVisible[index]);
        },
        setColumnOrder: function (order) {
            if (!validColumnOrder(order)) return false;
            this.columnOrder = order.slice(0);
            var ids = [];
            for (var i = 0; i < order.length; ++i) ids.push(columnIds[order[i]]);
            set('column.order', ids.join(','));
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
