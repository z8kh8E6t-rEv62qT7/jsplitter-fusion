# Transport icon asset

`transport-icons.png` is a transparent sprite rendered from the local mpv
configuration's `MaterialIconsRound-Regular.otf` font. The cells, from left to
right, are:

1. `stop` (`U+E047`)
2. `play_arrow` (`U+E037`)
3. `pause` (`U+E034`)
4. `arrow_back_ios` (`U+E5E0`)
5. `arrow_forward_ios` (`U+E5E1`)
6. `shuffle` (`U+E043`)
7. `folder` (`U+E2C7`)
8. `repeat_one` (`U+E041`)

Each cell is 96 x 96 pixels. The runtime loads this single image and selects a
cell by source rectangle; it does not require the font to be installed.
