'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const execute = (file, context) => vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context);

// File-mode scripts may be decoded using the system code page. Keep runtime
// literals ASCII with Unicode escapes; the assertions below verify Chinese values.
for (const file of ['core/output-info.js', 'views/right-pane.js']) {
    const bytes = fs.readFileSync(path.join(root, file));
    assert(bytes.every(byte => byte < 128), `${file} must be safe for code-page decoding`);
}

function fixture(scale = 1) {
    const values = {
        output_device: 'WASAPI Device', output_samplerate: '44100', output_channels: 2,
        output_channel_mask: 'stereo', output_bitdepth: '16', output_volume: '-inf',
        output_buffer_length: '1000 ms', output_dsps: 'Resampler; Equalizer', output_dsp_preset: 'Music',
        output_rg_source: 'Track', output_rg_mode: 'Apply gain', output_rg_gain: '-5 dB',
        output_rg_peak: '0', output_rg_peak_db: '-6.02'
    };
    const queries = [];
    const timers = new Map();
    const paints = [];
    const draws = [];
    const clips = [];
    let id = 0;
    const context = {
        FusionUI: {
            Theme: {
                s: n => n * scale,
                metrics: { header: 24 * scale, padding: 8 * scale },
                fonts: { normal: {}, bold: {} },
                palette: { base: 1, button: 2, text: 3, disabledText: 4 }
            }
        },
        DT_LEFT: 0, DT_VCENTER: 4, DT_SINGLELINE: 32, DT_END_ELLIPSIS: 32768,
        DT_NOPREFIX: 2048, DT_CENTER: 1,
        fb: {
            IsPlaying: true, IsPaused: false,
            TitleFormat(expression) {
                const field = expression.slice(2, -2);
                if (values[field] === 'compile-error') throw new Error('Compile error');
                return {
                    Eval(force) {
                        queries.push({ field, force });
                        if (values[field] instanceof Error) throw values[field];
                        return values[field];
                    },
                    EvalWithMetadb() { throw new Error('Must not use selection context'); }
                };
            }
        },
        window: {
            IsVisible: true,
            SetInterval(fn, delay) { assert.strictEqual(delay, 1000); timers.set(++id, fn); return id; },
            ClearInterval(timer) { timers.delete(timer); },
            RepaintRect: (...args) => paints.push(args)
        },
        console: { log() {} }
    };
    execute('core/utils.js', context);
    execute('core/output-info.js', context);
    execute('views/right-pane.js', context);
    const graphics = {
        CalcTextHeight: () => 18 * scale,
        EstimateLineWrap(text, font, width) {
            assert(width > 0);
            const count = Math.max(1, Math.floor(width / (8 * scale)));
            const wrapped = [];
            for (let start = 0; start < text.length; start += count) {
                const line = text.slice(start, start + count);
                wrapped.push(line, line.length * 8 * scale);
            }
            return wrapped;
        },
        FillSolidRect() {}, DrawLine() {}, DrawRect() {},
        PushClip: (...args) => clips.push(args), PopClip: () => clips.push('pop'),
        GdiDrawText: (...args) => draws.push(args)
    };
    return { context, values, queries, timers, paints, draws, clips, graphics };
}

{
    const f = fixture();
    const model = new f.context.FusionUI.OutputInfoModel();
    assert(model.refresh());
    assert.strictEqual(f.queries.length, 14);
    assert.strictEqual(new Set(f.queries.map(q => q.field)).size, 14);
    assert(f.queries.every(q => q.force === undefined));
    const byLabel = () => Object.fromEntries(model.rows.filter(r => r.kind === 'field').map(r => [r.label, r.value]));
    assert.deepStrictEqual(byLabel(), {
        '输出设备': 'WASAPI Device', '输出采样率': '44100 Hz', '声道数': '2', '声道布局': 'stereo',
        '输出位深': '16 bit', '播放音量': '-inf dB', '缓冲长度': '1000 ms',
        '活动 DSP': 'Resampler; Equalizer', 'DSP 链预设': 'Music', '来源模式': 'Track',
        '处理模式': 'Apply gain', '有效增益': '-5 dB', '有效峰值': '0', '有效峰值（dBFS）': '-6.02 dBFS'
    });
    assert.strictEqual(model.refresh(), false);
    f.values.output_device = '';
    f.values.output_bitdepth = new Error('No output');
    f.values.output_channels = 0;
    f.values.output_dsps = '?';
    f.values.output_dsp_preset = '%output_dsp_preset%';
    f.context.fb.IsPlaying = false;
    f.queries.length = 0;
    assert(model.refresh());
    assert(f.queries.every(q => q.force === true));
    assert.strictEqual(byLabel()['输出设备'], 'No data');
    assert.strictEqual(byLabel()['输出位深'], 'No data');
    assert.strictEqual(byLabel()['声道数'], '0');
    assert.strictEqual(byLabel()['活动 DSP'], 'No data');
    assert.strictEqual(byLabel()['DSP 链预设'], 'No data');
    f.context.fb.IsPaused = true;
    f.queries.length = 0;
    model.refresh();
    assert(f.queries.every(q => q.force === undefined));
    for (const key of Object.keys(f.values)) f.values[key] = 'compile-error';
    const missing = new f.context.FusionUI.OutputInfoModel();
    missing.refresh();
    assert(missing.rows.filter(r => r.kind === 'field').every(r => r.value === 'No data'));
    f.values.output_device = 'Recovered device';
    assert(missing.refresh());
    assert.strictEqual(missing.rows.find(r => r.label === '输出设备').value, 'Recovered device');
}

for (const scale of [1, 2]) {
    const f = fixture(scale);
    let selectionReads = 0;
    let key = 'one';
    const model = {
        displayContext() { ++selectionReads; return { key, count: 1 }; },
        detailsForContext() { return { title: 'Selected title' }; }
    };
    const view = new f.context.FusionUI.RightPaneView(model, { image: null });
    view.layout({ x: 10, y: 0, w: 320 * scale, h: 600 * scale });
    const artworkBefore = JSON.stringify(view.artRect);
    assert.strictEqual(view.activeTab, 'item');
    assert.strictEqual(f.timers.size, 0);
    view.drawDetails(f.graphics);
    view.detailScroll = 42;
    const tab = view.tabRects()[1];
    view.down(tab.x + 1, tab.y + 1);
    assert.strictEqual(view.activeTab, 'playback');
    assert.strictEqual(f.timers.size, 1);
    const tick = Array.from(f.timers.values())[0];
    const paintCount = f.paints.length;
    tick();
    assert.strictEqual(f.paints.length, paintCount);
    f.values.output_samplerate = '96000';
    tick();
    assert.strictEqual(f.paints.length, paintCount + 1);
    f.context.window.IsVisible = false;
    const hiddenQueries = f.queries.length;
    tick();
    assert.strictEqual(f.queries.length, hiddenQueries);
    f.context.window.IsVisible = true;
    tick();
    assert(f.queries.length > hiddenQueries);
    const reads = selectionReads;
    view.drawDetails(f.graphics);
    assert.strictEqual(selectionReads, reads);
    assert.strictEqual(JSON.stringify(view.artRect), artworkBefore);
    view.wheel(tab.x + 1, tab.y + tab.h + 1, -1);
    assert.strictEqual(view.playbackScroll, 42 * scale);
    assert.strictEqual(view.detailScroll, 42);
    view.selectTab('item');
    assert.strictEqual(f.timers.size, 0);
    assert.strictEqual(view.detailScroll, 42);
    view.selectTab('playback');
    assert.strictEqual(view.playbackScroll, 42 * scale);
    view.selectTab('playback');
    assert.strictEqual(f.timers.size, 1);
    key = 'two';
    view.selectTab('item');
    view.drawDetails(f.graphics);
    assert.strictEqual(view.detailScroll, 0);

    view.selectTab('playback');
    f.values.output_device = 'Very long output device name '.repeat(20);
    f.values.output_dsps = 'Resampler\nEqualizer\r\nLimiter';
    view.refreshOutput();
    const body = { x: 0, y: 0, w: 220 * scale, h: 100 * scale };
    const narrow = view.playbackLayout(f.graphics, body);
    const wide = view.playbackLayout(f.graphics, { ...body, w: 440 * scale });
    assert(narrow.height > wide.height);
    assert(narrow.lines.some(line => line.text.includes('Limiter')));
    for (let i = 1; i < narrow.lines.length; ++i) {
        assert(narrow.lines[i].y >= narrow.lines[i - 1].y + narrow.lines[i - 1].h);
    }
    view.playbackScroll = 1e6;
    f.draws.length = 0;
    f.clips.length = 0;
    view.drawDetails(f.graphics);
    assert(view.playbackScroll < 1e6);
    assert.strictEqual(f.clips.length, 2);
    assert.strictEqual(f.clips[0][1], view.detailRect.y + f.context.FusionUI.Theme.metrics.header);
    assert.strictEqual(f.clips[1], 'pop');
    assert.deepStrictEqual(f.draws.slice(-2).map(d => d[0]), ['Item details', 'Playback details']);
    view.layout({ x: 0, y: 0, w: 1, h: 1 });
    assert.strictEqual(f.timers.size, 0);
    view.layout({ x: 0, y: 0, w: 320 * scale, h: 600 * scale });
    assert.strictEqual(f.timers.size, 1);
    view.output.refresh = () => { throw new Error('Unexpected polling failure'); };
    assert.doesNotThrow(() => Array.from(f.timers.values())[0]());
    view.dispose();
    assert.strictEqual(f.timers.size, 0);
    assert.doesNotThrow(() => view.dispose());
    const reopened = new f.context.FusionUI.RightPaneView(model, {});
    assert.strictEqual(reopened.activeTab, 'item');
}

// Execute the actual entrypoint with a minimal app to verify callback wiring.
{
    let refreshes = 0;
    let disposals = 0;
    const context = {
        fb: { ComponentPath: '', ProfilePath: '' }, console,
        window: { DefineScript() {}, Repaint() {}, RepaintRect() {}, Width: 1, Height: 1 },
        include(name) {
            if (name === 'views\\app.js') context.FusionUI.FusionApp = function () {
                this.layout = () => {};
                this.displayChanged = () => {};
                this.selectionChanged = () => {};
                this.bottom = { transport: { volumeControlRect: null } };
                this.right = { refreshOutput: () => ++refreshes, dispose: () => ++disposals };
            };
        }
    };
    execute('main.js', context);
    for (const name of ['on_playback_new_track', 'on_playback_dynamic_info_track', 'on_playback_dynamic_info',
        'on_playback_starting', 'on_playback_pause', 'on_playback_stop', 'on_volume_change']) {
        const before = refreshes;
        context[name]();
        assert.strictEqual(refreshes, before + 1, name);
    }
    const beforeSelection = refreshes;
    context.on_playlist_items_selection_change();
    assert.strictEqual(refreshes, beforeSelection);
    context.on_script_unload();
    assert.strictEqual(disposals, 1);
}

console.log('Output info and details tabs tests passed');
