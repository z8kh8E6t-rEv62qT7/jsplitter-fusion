(function (ns) {
    'use strict';

    var MISSING = 'No data';
    var NOT_APPLICABLE = 'N/A';

    function PlaylistModel() {
        this.tf = {
            directory: fb.TitleFormat('$if($info(CUE_SOURCE_PATH),$directory($info(CUE_SOURCE_PATH)),$if2(%directoryname%,\u672a\u77e5\u76ee\u5f55))'),
            title: fb.TitleFormat('$if2(%title%,%filename%)'),
            artist: fb.TitleFormat('[%artist%]'),
            album: fb.TitleFormat('[%album%]'),
            length: fb.TitleFormat('[%length%]'),
            detailTitle: fb.TitleFormat('[%title%]'),
            detailArtist: fb.TitleFormat('[%artist%]'),
            detailAlbumArtist: fb.TitleFormat('[%album artist%]'),
            detailAlbum: fb.TitleFormat('[%album%]'),
            year: fb.TitleFormat('[$year(%date%)]'),
            tracknumber: fb.TitleFormat('[%tracknumber%]'),
            totaltracks: fb.TitleFormat('[%totaltracks%]'),
            discnumber: fb.TitleFormat('[%discnumber%]'),
            totaldiscs: fb.TitleFormat('[%totaldiscs%]'),
            genre: fb.TitleFormat('[%genre%]'),
            composer: fb.TitleFormat('[%composer%]'),
            comment: fb.TitleFormat('[%comment%]'),
            codec: fb.TitleFormat('[%codec_long%]'),
            bitrate: fb.TitleFormat('[%bitrate%]'),
            samplerate: fb.TitleFormat('[%samplerate%]'),
            storedBitdepth: fb.TitleFormat('[%bitspersample%]'),
            decodedBitdepth: fb.TitleFormat('[%decoded_bitspersample%]'),
            channels: fb.TitleFormat('[%channels%]'),
            filesize: fb.TitleFormat('[%filesize_natural%]'),
            replaygainTrackGain: fb.TitleFormat('[%replaygain_track_gain%]'),
            replaygainTrackPeak: fb.TitleFormat('[%replaygain_track_peak%]'),
            replaygainAlbumGain: fb.TitleFormat('[%replaygain_album_gain%]'),
            replaygainAlbumPeak: fb.TitleFormat('[%replaygain_album_peak%]'),
            filename: fb.TitleFormat('[%filename_ext%]'),
            detailDirectory: fb.TitleFormat('[$if($info(CUE_SOURCE_PATH),$directory($info(CUE_SOURCE_PATH)),%directoryname%)]'),
            path: fb.TitleFormat('[%path%]'),
            modified: fb.TitleFormat('[%last_modified%]')
        };
        this.nowPlayingFormat = '';
        this.nowPlayingTf = null;
        this.playlists = [];
        this.active = -1;
        this.handles = null;
        this.meta = [];
        this.rows = [];
        this.itemToVisual = [];
        this.anchor = -1;
        this.displayDetailsKey = '';
        this.displayDetailsValue = null;
        this.reloadPlaylists();
        this.reloadItems();
    }

    PlaylistModel.prototype.reloadPlaylists = function () {
        this.playlists = [];
        for (var i = 0; i < plman.PlaylistCount; ++i) {
            this.playlists.push({ index: i, name: plman.GetPlaylistName(i) || '\u65b0\u5efa\u64ad\u653e\u5217\u8868' });
        }
    };

    PlaylistModel.prototype.reloadItems = function () {
        this.invalidateDisplayDetails();
        this.active = plman.PlaylistCount ? plman.ActivePlaylist : -1;
        this.rows = [];
        this.meta = [];
        this.itemToVisual = [];
        if (this.active < 0) {
            this.handles = null;
            return;
        }
        this.handles = plman.GetPlaylistItems(this.active);
        var count = this.handles.Count;
        var directories = count ? this.tf.directory.EvalWithMetadbs(this.handles) : [];
        var titles = count ? this.tf.title.EvalWithMetadbs(this.handles) : [];
        var artists = count ? this.tf.artist.EvalWithMetadbs(this.handles) : [];
        var albums = count ? this.tf.album.EvalWithMetadbs(this.handles) : [];
        var lengths = count ? this.tf.length.EvalWithMetadbs(this.handles) : [];
        var filenames = count ? this.tf.filename.EvalWithMetadbs(this.handles) : [];
        var previousDirectory = null;
        var currentGroup = null;
        for (var i = 0; i < count; ++i) {
            var directory = ns.Util.safeText(directories[i]);
            this.meta.push({
                directory: directory,
                title: ns.Util.safeText(titles[i]),
                artist: ns.Util.safeText(artists[i]),
                album: ns.Util.safeText(albums[i]),
                length: ns.Util.safeText(lengths[i]),
                filename: ns.Util.safeText(filenames[i])
            });
            if (directory !== previousDirectory) {
                currentGroup = { type: 'group', directory: directory, firstItem: i, itemCount: 0 };
                this.rows.push(currentGroup);
                previousDirectory = directory;
            }
            currentGroup.itemCount += 1;
            this.itemToVisual[i] = this.rows.length;
            this.rows.push({ type: 'item', itemIndex: i });
        }
    };

    PlaylistModel.prototype.count = function () {
        return this.active < 0 ? 0 : plman.PlaylistItemCount(this.active);
    };

    PlaylistModel.prototype.playlistDuration = function () {
        if (this.active < 0 || !this.handles) return 0;
        return this.handles.CalcTotalDuration();
    };

    PlaylistModel.prototype.focusIndex = function () {
        return this.active < 0 ? -1 : plman.GetPlaylistFocusItemIndex(this.active);
    };

    PlaylistModel.prototype.isSelected = function (itemIndex) {
        return this.active >= 0 && plman.IsPlaylistItemSelected(this.active, itemIndex);
    };

    PlaylistModel.prototype.select = function (itemIndex, ctrl, shift) {
        if (this.active < 0 || itemIndex < 0 || itemIndex >= this.count()) return;
        if (shift) {
            var start = this.anchor >= 0 ? this.anchor : Math.max(0, this.focusIndex());
            var first = Math.min(start, itemIndex);
            var last = Math.max(start, itemIndex);
            var affected = [];
            for (var i = first; i <= last; ++i) affected.push(i);
            if (!ctrl) plman.ClearPlaylistSelection(this.active);
            plman.SetPlaylistSelection(this.active, affected, true);
        } else if (ctrl) {
            plman.SetPlaylistSelectionSingle(this.active, itemIndex, !this.isSelected(itemIndex));
            this.anchor = itemIndex;
        } else {
            plman.ClearPlaylistSelection(this.active);
            plman.SetPlaylistSelectionSingle(this.active, itemIndex, true);
            this.anchor = itemIndex;
        }
        plman.SetPlaylistFocusItem(this.active, itemIndex);
    };

    PlaylistModel.prototype.selectAll = function () {
        if (this.active < 0 || !this.count()) return;
        var all = [];
        for (var i = 0; i < this.count(); ++i) all.push(i);
        plman.SetPlaylistSelection(this.active, all, true);
    };

    PlaylistModel.prototype.selectedHandles = function () {
        return this.active < 0 ? null : plman.GetPlaylistSelectedItems(this.active);
    };

    PlaylistModel.prototype.invalidateDisplayDetails = function () {
        this.displayDetailsKey = '';
        this.displayDetailsValue = null;
    };

    PlaylistModel.prototype.displayContext = function () {
        var selected = this.selectedHandles();
        if (selected && selected.Count > 0) {
            var keys = [];
            for (var i = 0; i < selected.Count; ++i) keys.push(ns.Util.handleKey(selected[i]));
            return {
                source: 'selection',
                handles: selected,
                count: selected.Count,
                singleHandle: selected.Count === 1 ? selected[0] : null,
                key: 'selection:' + this.active + ':' + keys.join('|')
            };
        }
        var playing = (fb.IsPlaying || fb.IsPaused) ? fb.GetNowPlaying() : null;
        if (playing) {
            return {
                source: 'playback',
                handles: null,
                count: 1,
                singleHandle: playing,
                key: 'playback:' + ns.Util.handleKey(playing)
            };
        }
        return { source: 'empty', handles: null, count: 0, singleHandle: null, key: 'empty' };
    };

    PlaylistModel.prototype.nowPlayingHandle = function () {
        if (!fb.IsPlaying && !fb.IsPaused) return '';
        return fb.GetNowPlaying() || null;
    };

    PlaylistModel.prototype.nowPlayingSummary = function () {
        var handle = this.nowPlayingHandle();
        if (!handle) return '';
        var format = ns.Settings.nowPlayingFormat;
        try {
            if (!this.nowPlayingTf || this.nowPlayingFormat !== format) {
                this.nowPlayingTf = fb.TitleFormat(format);
                this.nowPlayingFormat = format;
            }
            return String(this.nowPlayingTf.EvalWithMetadb(handle) || '').trim();
        } catch (_) {
            return '';
        }
    };

    PlaylistModel.prototype.fileInfoValue = function (handle, name) {
        if (!handle || typeof handle.GetFileInfo !== 'function') return '';
        try {
            var info = handle.GetFileInfo();
            if (!info) return '';
            var index = info.InfoFind(name);
            return index >= 0 ? String(info.InfoValue(index) || '').trim() : '';
        } catch (_) {
            return '';
        }
    };

    PlaylistModel.prototype.details = function (handle) {
        if (!handle) return null;
        var missing = MISSING;
        var evalField = function (tf) { return ns.Util.safeText(ns.Util.eval(tf, handle)); };
        var raw = function (tf) { return String(ns.Util.eval(tf, handle) || '').trim(); };
        var pair = function (currentTf, totalTf) {
            var current = raw(currentTf);
            var total = raw(totalTf);
            if (!current && !total) return missing;
            if (!total) return current || missing;
            return (current || missing) + ' / ' + total;
        };
        var bitrate = raw(this.tf.bitrate);
        var samplerate = raw(this.tf.samplerate);
        var bitdepth = raw(this.tf.storedBitdepth) || this.fileInfoValue(handle, 'bitspersample') ||
            raw(this.tf.decodedBitdepth);
        var rawPath = String(handle.RawPath || handle.Path || '');
        var isRemote = /^(?:https?|mms|rtsp|icy):\/\//i.test(rawPath);
        return {
            title: evalField(this.tf.detailTitle),
            artist: evalField(this.tf.detailArtist),
            albumArtist: evalField(this.tf.detailAlbumArtist),
            album: evalField(this.tf.detailAlbum),
            year: evalField(this.tf.year),
            track: pair(this.tf.tracknumber, this.tf.totaltracks),
            disc: pair(this.tf.discnumber, this.tf.totaldiscs),
            genre: evalField(this.tf.genre),
            composer: evalField(this.tf.composer),
            comment: evalField(this.tf.comment),
            codec: evalField(this.tf.codec),
            bitrate: bitrate ? bitrate + ' kbps' : missing,
            samplerate: samplerate ? samplerate + ' Hz' : missing,
            bitdepth: bitdepth ? bitdepth + ' bit' : missing,
            channels: evalField(this.tf.channels),
            length: ns.Util.safeText(ns.Util.eval(this.tf.length, handle)),
            filesize: evalField(this.tf.filesize),
            replaygainTrackGain: evalField(this.tf.replaygainTrackGain),
            replaygainTrackPeak: evalField(this.tf.replaygainTrackPeak),
            replaygainAlbumGain: evalField(this.tf.replaygainAlbumGain),
            replaygainAlbumPeak: evalField(this.tf.replaygainAlbumPeak),
            filename: isRemote ? missing : evalField(this.tf.filename),
            directory: isRemote ? missing : evalField(this.tf.detailDirectory),
            path: isRemote ? missing : evalField(this.tf.path),
            modified: isRemote ? missing : evalField(this.tf.modified)
        };
    };

    PlaylistModel.prototype.aggregateDetails = function (handles) {
        if (!handles || handles.Count < 2) return null;
        var records = [];
        for (var i = 0; i < handles.Count; ++i) records.push(this.details(handles[i]));

        var missing = MISSING;
        var common = function (field) {
            var value = records[0][field];
            var allMissing = value === missing;
            for (var index = 1; index < records.length; ++index) {
                allMissing = allMissing && records[index][field] === missing;
                if (records[index][field] !== value) return NOT_APPLICABLE;
            }
            return allMissing ? missing : value;
        };
        var allKnown = function (field) {
            for (var index = 0; index < records.length; ++index) {
                if (!records[index][field] || records[index][field] === missing) return false;
            }
            return true;
        };

        var length = records.every(function (record) { return record.length === missing; }) ? missing : NOT_APPLICABLE;
        if (allKnown('length')) {
            try { length = ns.Util.formatSelectionDuration(handles.CalcTotalDuration()); } catch (_) {}
        }
        var filesize = NOT_APPLICABLE;
        if (allKnown('filesize') && allKnown('path')) {
            try { filesize = utils.FormatFileSize(handles.CalcTotalSize()); } catch (_) {}
        }

        return {
            items: handles.Count,
            title: common('title'),
            artist: common('artist'),
            albumArtist: common('albumArtist'),
            album: common('album'),
            year: common('year'),
            track: common('track'),
            disc: common('disc'),
            genre: common('genre'),
            composer: common('composer'),
            comment: common('comment'),
            codec: common('codec'),
            bitrate: common('bitrate'),
            samplerate: common('samplerate'),
            bitdepth: common('bitdepth'),
            channels: common('channels'),
            length: length,
            filesize: filesize,
            replaygainTrackGain: common('replaygainTrackGain'),
            replaygainTrackPeak: common('replaygainTrackPeak'),
            replaygainAlbumGain: common('replaygainAlbumGain'),
            replaygainAlbumPeak: common('replaygainAlbumPeak'),
            filename: common('filename'),
            directory: common('directory'),
            path: common('path'),
            modified: common('modified')
        };
    };

    PlaylistModel.prototype.detailsForContext = function (context) {
        context = context || this.displayContext();
        if (context.key === this.displayDetailsKey) return this.displayDetailsValue;
        var value = null;
        if (context.count === 1) value = this.details(context.singleHandle);
        else if (context.count > 1) value = this.aggregateDetails(context.handles);
        this.displayDetailsKey = context.key;
        this.displayDetailsValue = value;
        return value;
    };

    ns.PlaylistModel = PlaylistModel;
})(FusionUI);
