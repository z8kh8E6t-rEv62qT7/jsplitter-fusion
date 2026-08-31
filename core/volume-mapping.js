(function (ns) {
    'use strict';

    var MIN_DB = -100;
    var MAX_DB = 0;
    var MODE_CURVE = 'curve';
    var MODE_VIRTUAL_WIDTH = 'virtualWidth';
    var DEFAULT_MODE = MODE_CURVE;
    var DEFAULT_CURVE_K = 0.5;
    var DEFAULT_VIRTUAL_WIDTH_K = 1;

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
        if (parsed <= 0) {
            return { ok: false, error: '\u6570\u503c\u5fc5\u987b\u5927\u4e8e 0\u3002' };
        }
        return { ok: true, value: parsed };
    }

    function normalizeK(value, fallback) {
        var validation = validateK(value);
        if (validation.ok) return validation.value;
        var fallbackValidation = validateK(fallback);
        return fallbackValidation.ok ? fallbackValidation.value : DEFAULT_CURVE_K;
    }

    function formatK(value, fallback) {
        return String(Number(normalizeK(value, fallback).toFixed(4)));
    }

    function normalizeMode(value) {
        value = String(value == null ? '' : value);
        return value === MODE_CURVE || value === MODE_VIRTUAL_WIDTH ? value : DEFAULT_MODE;
    }

    function curveToPosition(db, k) {
        db = clamp(finiteNumber(db, MIN_DB), MIN_DB, MAX_DB);
        k = normalizeK(k, DEFAULT_CURVE_K);
        return clamp(Math.pow(10, db * k / 20), 0, 1);
    }

    function curveToDb(position, k) {
        position = clamp(finiteNumber(position, 0), 0, 1);
        if (position <= 0) return MIN_DB;
        k = normalizeK(k, DEFAULT_CURVE_K);
        return clamp(20 * Math.log(position) / Math.LN10 / k, MIN_DB, MAX_DB);
    }

    function virtualWidthToPosition(db, k) {
        db = clamp(finiteNumber(db, MIN_DB), MIN_DB, MAX_DB);
        if (db <= MIN_DB) return 0;
        if (db >= MAX_DB) return 1;
        k = normalizeK(k, DEFAULT_VIRTUAL_WIDTH_K);
        return clamp(Math.pow(10, db / 20) * k, 0, 1);
    }

    function virtualWidthToDb(position, k) {
        position = clamp(finiteNumber(position, 0), 0, 1);
        if (position <= 0) return MIN_DB;
        if (position >= 1) return MAX_DB;
        k = normalizeK(k, DEFAULT_VIRTUAL_WIDTH_K);
        return clamp(20 * Math.log(position / k) / Math.LN10, MIN_DB, MAX_DB);
    }

    function toPosition(db, mode, curveK, virtualWidthK) {
        if (normalizeMode(mode) === MODE_VIRTUAL_WIDTH) {
            return virtualWidthToPosition(db, virtualWidthK);
        }
        return curveToPosition(db, curveK);
    }

    function toDb(position, mode, curveK, virtualWidthK) {
        if (normalizeMode(mode) === MODE_VIRTUAL_WIDTH) {
            return virtualWidthToDb(position, virtualWidthK);
        }
        return curveToDb(position, curveK);
    }

    ns.VolumeMapping = {
        modes: [MODE_CURVE, MODE_VIRTUAL_WIDTH],
        defaultMode: DEFAULT_MODE,
        defaultCurveK: DEFAULT_CURVE_K,
        defaultVirtualWidthK: DEFAULT_VIRTUAL_WIDTH_K,
        minDb: MIN_DB,
        maxDb: MAX_DB,
        validateK: validateK,
        normalizeK: normalizeK,
        formatK: formatK,
        normalizeMode: normalizeMode,
        curveToPosition: curveToPosition,
        curveToDb: curveToDb,
        virtualWidthToPosition: virtualWidthToPosition,
        virtualWidthToDb: virtualWidthToDb,
        toPosition: toPosition,
        toDb: toDb
    };
})(FusionUI);
