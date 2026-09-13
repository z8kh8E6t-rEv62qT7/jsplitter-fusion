(function (ns) {
    'use strict';

    var FIELDS = [
        { group: '\u8f93\u51fa', id: 'output_device', label: '\u8f93\u51fa\u8bbe\u5907' },
        { group: '\u8f93\u51fa', id: 'output_samplerate', label: '\u8f93\u51fa\u91c7\u6837\u7387', unit: 'Hz' },
        { group: '\u8f93\u51fa', id: 'output_channels', label: '\u58f0\u9053\u6570' },
        { group: '\u8f93\u51fa', id: 'output_channel_mask', label: '\u58f0\u9053\u5e03\u5c40' },
        { group: '\u8f93\u51fa', id: 'output_bitdepth', label: '\u8f93\u51fa\u4f4d\u6df1', unit: 'bit' },
        { group: '\u8f93\u51fa', id: 'output_volume', label: '\u64ad\u653e\u97f3\u91cf', unit: 'dB' },
        { group: '\u8f93\u51fa', id: 'output_buffer_length', label: '\u7f13\u51b2\u957f\u5ea6', unit: 'ms' },
        { group: 'DSP', id: 'output_dsps', label: '\u6d3b\u52a8 DSP' },
        { group: 'DSP', id: 'output_dsp_preset', label: 'DSP \u94fe\u9884\u8bbe' },
        { group: 'ReplayGain', id: 'output_rg_source', label: '\u6765\u6e90\u6a21\u5f0f' },
        { group: 'ReplayGain', id: 'output_rg_mode', label: '\u5904\u7406\u6a21\u5f0f' },
        { group: 'ReplayGain', id: 'output_rg_gain', label: '\u6709\u6548\u589e\u76ca', unit: 'dB' },
        { group: 'ReplayGain', id: 'output_rg_peak', label: '\u6709\u6548\u5cf0\u503c' },
        { group: 'ReplayGain', id: 'output_rg_peak_db', label: '\u6709\u6548\u5cf0\u503c\uff08dBFS\uff09', unit: 'dBFS' }
    ];

    function formatValue(raw, field) {
        var value = raw == null ? '' : String(raw).trim();
        if (!value || value === '?' || value === '%' + field.id + '%') return 'No data';
        // Only raw numeric values (including the component's -inf mute value)
        // need units. Already formatted component strings are preserved verbatim.
        if (field.unit && /^[+\-\u2212]?(?:\d+(?:[.,]\d*)?|[.,]\d+|inf(?:inity)?|\u221e)$/i.test(value)) {
            return value + ' ' + field.unit;
        }
        return value;
    }

    function OutputInfoModel() {
        this.formats = {};
        this.rows = [];
        this.key = '';
    }

    OutputInfoModel.prototype.refresh = function () {
        var rows = [];
        var group = '';
        var active = fb.IsPlaying || fb.IsPaused;
        for (var i = 0; i < FIELDS.length; ++i) {
            var field = FIELDS[i];
            if (group !== field.group) {
                group = field.group;
                rows.push({ kind: 'group', text: group });
            }
            var raw = '';
            try {
                if (!this.formats[field.id]) this.formats[field.id] = fb.TitleFormat('[%' + field.id + '%]');
                raw = active ? this.formats[field.id].Eval() : this.formats[field.id].Eval(true);
            } catch (_) {
                // A missing component or failed field must not retain old output data.
            }
            rows.push({ kind: 'field', label: field.label, value: formatValue(raw, field) });
            if (field.id === 'output_bitdepth') {
                rows.push({ kind: 'note', text: '\u8f93\u51fa\u7ec4\u4ef6\u672a\u62a5\u544a\u4f4d\u6df1\u65f6\uff0c\u6b64\u503c\u53ef\u80fd\u662f\u4f30\u8ba1\u503c\u3002' });
            }
        }
        var key = JSON.stringify(rows);
        var changed = key !== this.key;
        this.rows = rows;
        this.key = key;
        return changed;
    };

    ns.OutputInfoModel = OutputInfoModel;
})(FusionUI);
