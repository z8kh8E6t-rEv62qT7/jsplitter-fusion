(function (ns) {
    'use strict';

    function colour(r, g, b) {
        return RGB(r, g, b);
    }

    function scale(value) {
        return Math.max(1, Math.round(value * ((window.DPI || 96) / 96)));
    }

    function createFonts() {
        return {
            normal: gdi.Font('Segoe UI', scale(12), 0),
            bold: gdi.Font('Segoe UI Semibold', scale(12), 0),
            small: gdi.Font('Segoe UI', scale(11), 0),
            mono: gdi.Font('Consolas', scale(11), 0)
        };
    }

    ns.Theme = {
        s: scale,
        palette: {
            window: colour(239, 239, 239),
            base: colour(255, 255, 255),
            alternateBase: colour(247, 247, 247),
            button: colour(239, 239, 239),
            buttonHover: colour(229, 241, 251),
            buttonPressed: colour(204, 228, 247),
            text: colour(31, 31, 31),
            disabledText: colour(128, 128, 128),
            border: colour(171, 171, 171),
            darkBorder: colour(112, 112, 112),
            lightBorder: colour(255, 255, 255),
            grid: colour(224, 224, 224),
            highlight: colour(48, 140, 198),
            highlightText: colour(255, 255, 255),
            playing: colour(24, 105, 158),
            error: colour(176, 32, 32)
        },
        darkPalette: {
            background: colour(8, 9, 11),
            remaining: colour(24, 25, 30),
            progress: colour(244, 244, 244),
            text: colour(242, 242, 242),
            muted: colour(154, 154, 154),
            border: colour(52, 52, 58),
            accent: colour(48, 140, 198),
            hover: colour(35, 37, 43)
        },
        metrics: {
            row: scale(24),
            header: scale(24),
            bottom: scale(100),
            transportRow: scale(40),
            seekRow: scale(36),
            summaryRow: scale(24),
            splitter: scale(4),
            scrollbar: scale(14),
            padding: scale(6),
            minCentre: scale(260),
            minLeft: scale(150),
            minRight: scale(220)
        },
        fonts: createFonts(),
        refreshFonts: function () {
            this.fonts = createFonts();
        }
    };
})(FusionUI);
