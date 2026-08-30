(function (ns) {
    'use strict';

    var MIN_DB = -100;
    var MAX_DB = 0;
    var DEFAULT_ID = 'amplitude';
    var IDS = ['amplitude', 'dbLinear', 'legacy'];

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function finiteNumber(value, fallback) {
        value = Number(value);
        return isFinite(value) ? value : fallback;
    }

    function isValid(id) {
        return IDS.indexOf(String(id)) >= 0;
    }

    function normalize(id) {
        id = String(id == null ? '' : id);
        return isValid(id) ? id : DEFAULT_ID;
    }

    function toPosition(db, mapping) {
        db = clamp(finiteNumber(db, MIN_DB), MIN_DB, MAX_DB);
        mapping = normalize(mapping);
        if (mapping === 'dbLinear') return (db - MIN_DB) / (MAX_DB - MIN_DB);
        if (mapping === 'legacy') return Math.pow(2, db / 10);
        return Math.pow(10, db / 20);
    }

    function toDb(position, mapping) {
        position = clamp(finiteNumber(position, 0), 0, 1);
        if (position <= 0) return MIN_DB;
        mapping = normalize(mapping);
        var db;
        if (mapping === 'dbLinear') db = MIN_DB + position * (MAX_DB - MIN_DB);
        else if (mapping === 'legacy') db = 10 * Math.log(position) / Math.LN2;
        else db = 20 * Math.log(position) / Math.LN10;
        return clamp(db, MIN_DB, MAX_DB);
    }

    ns.VolumeMapping = {
        ids: IDS.slice(0),
        defaultId: DEFAULT_ID,
        minDb: MIN_DB,
        maxDb: MAX_DB,
        isValid: isValid,
        normalize: normalize,
        toPosition: toPosition,
        toDb: toDb
    };
})(FusionUI);
