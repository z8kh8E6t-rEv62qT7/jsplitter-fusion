(function (ns) {
    'use strict';

    var MIN_DB = -100;
    var MAX_DB = 0;
    var MIN_K = 0.1;
    var MAX_K = 10;
    var DEFAULT_K = 0.5;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function finiteNumber(value, fallback) {
        value = Number(value);
        return isFinite(value) ? value : fallback;
    }

    function parseK(value) {
        if (typeof value === 'string') {
            value = value.trim();
            if (!value) return NaN;
            value = value.replace(/,/g, '.');
        }
        return Number(value);
    }

    function validateK(value) {
        var parsed = parseK(value);
        if (!isFinite(parsed)) {
            return { ok: false, error: '\u8bf7\u8f93\u5165\u6709\u6548\u6570\u5b57\u3002' };
        }
        if (parsed < MIN_K || parsed > MAX_K) {
            return { ok: false, error: '\u6570\u503c\u5fc5\u987b\u5728 0.10 \u5230 10.00 \u4e4b\u95f4\u3002' };
        }
        return { ok: true, value: parsed };
    }

    function normalizeK(value) {
        var validation = validateK(value);
        return validation.ok ? validation.value : DEFAULT_K;
    }

    function formatK(value) {
        return String(Number(normalizeK(value).toFixed(4)));
    }

    function toPosition(db, k) {
        db = clamp(finiteNumber(db, MIN_DB), MIN_DB, MAX_DB);
        k = normalizeK(k);
        return clamp(Math.pow(10, db * k / 20), 0, 1);
    }

    function toDb(position, k) {
        position = clamp(finiteNumber(position, 0), 0, 1);
        if (position <= 0) return MIN_DB;
        k = normalizeK(k);
        return clamp(20 * Math.log(position) / Math.LN10 / k, MIN_DB, MAX_DB);
    }

    ns.VolumeMapping = {
        defaultK: DEFAULT_K,
        minK: MIN_K,
        maxK: MAX_K,
        minDb: MIN_DB,
        maxDb: MAX_DB,
        validateK: validateK,
        normalizeK: normalizeK,
        formatK: formatK,
        toPosition: toPosition,
        toDb: toDb
    };
})(FusionUI);
