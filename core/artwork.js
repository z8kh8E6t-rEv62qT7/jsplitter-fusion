(function (ns) {
    'use strict';

    function ArtworkController(onChanged) {
        this.image = null;
        this.path = '';
        this.key = '';
        this.loading = false;
        this.onChanged = onChanged;
    }

    ArtworkController.prototype.refresh = async function (handle) {
        var key = ns.Util.handleKey(handle);
        if (key === this.key && (this.image || this.loading)) return;
        this.key = key;
        this.image = null;
        this.path = '';
        this.loading = !!handle;
        this.onChanged();
        if (!handle) {
            this.loading = false;
            return;
        }
        try {
            // Force the requested precedence: embedded front cover first, then
            // foobar2000's configured Front cover search patterns.
            var result = await utils.GetAlbumArtAsyncV2(window.ID, handle, AlbumArtId.front, false, true);
            if ((!result || !result.image) && this.key === key) {
                result = await utils.GetAlbumArtAsyncV2(window.ID, handle, AlbumArtId.front, false, false);
            }
            if (this.key !== key) return;
            this.image = result ? result.image : null;
            this.path = result && result.path ? result.path : '';
        } catch (e) {
            if (this.key === key) {
                this.image = null;
                this.path = '';
            }
        }
        if (this.key === key) {
            this.loading = false;
            this.onChanged();
        }
    };

    ns.ArtworkController = ArtworkController;
})(FusionUI);
