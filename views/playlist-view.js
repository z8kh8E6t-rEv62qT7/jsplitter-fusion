(function (ns) {
    'use strict';

    function PlaylistView(model) {
        this.model = model;
        this.rect = null;
        this.contentRect = null;
        this.viewportWidth = 0;
        this.bodyHeight = 0;
        this.showVertical = false;
        this.showHorizontal = false;
        this.first = model.active >= 0 ? ns.Settings.getScroll(model.active) : 0;
        this.horizontalOffset = model.active >= 0 ? ns.Settings.getHScroll(model.active) : 0;
        this.visible = 1;
        this.columns = [];
        this.visibleColumns = [];
        this.columnEdges = [];
        this.contentWidth = 0;
        this.resizeColumn = -1;
        this.resizeStartX = 0;
        this.resizeStartWidth = 0;
        this.headerDownColumn = -1;
        this.headerDownPoint = null;
        this.draggingHeader = false;
        this.headerDropBefore = -1;
        this.headerDropMarkerX = null;
        this.downItem = -1;
        this.downPoint = null;
        this.downWasSelected = false;
        this.draggingItems = false;
        this.dropItem = -1;
        var self = this;
        this.scrollbar = new ns.Scrollbar(
            function () { return self.first; },
            function (value) {
                self.first = value;
                if (self.model.active >= 0) ns.Settings.setScroll(self.model.active, value);
            },
            'vertical',
            3
        );
        this.horizontalScrollbar = new ns.Scrollbar(
            function () { return self.horizontalOffset; },
            function (value) {
                self.horizontalOffset = value;
                if (self.model.active >= 0) ns.Settings.setHScroll(self.model.active, value);
                self.computeColumns();
            },
            'horizontal',
            function () { return ns.Theme.s(48); }
        );
    }

    PlaylistView.prototype.minimumWidth = function (index) {
        var definition = ns.Settings.columnDefinitions[index];
        return ns.Theme.s(definition ? definition.minWidth : 64);
    };

    PlaylistView.prototype.reloadScroll = function () {
        this.first = this.model.active >= 0 ? ns.Settings.getScroll(this.model.active) : 0;
        this.horizontalOffset = this.model.active >= 0 ? ns.Settings.getHScroll(this.model.active) : 0;
    };

    PlaylistView.prototype.computeColumns = function () {
        this.columns = ns.Settings.columns.slice(0);
        this.visibleColumns = [];
        this.columnEdges = [];
        this.contentWidth = 0;
        var baseX = this.rect ? this.rect.x - this.horizontalOffset : -this.horizontalOffset;
        for (var orderIndex = 0; orderIndex < ns.Settings.columnOrder.length; ++orderIndex) {
            var i = ns.Settings.columnOrder[orderIndex];
            if (!ns.Settings.columnVisible[i]) continue;
            var width = Math.max(this.minimumWidth(i), this.columns[i]);
            var column = {
                index: i,
                name: ns.Settings.columnDefinitions[i].name,
                x: baseX + this.contentWidth,
                width: width
            };
            this.visibleColumns.push(column);
            this.contentWidth += width;
            this.columnEdges.push({ index: i, x: baseX + this.contentWidth });
        }
    };

    PlaylistView.prototype.layout = function (rect) {
        this.rect = rect;
        var m = ns.Theme.metrics;
        this.computeColumns();

        var showVertical = false;
        var showHorizontal = false;
        var viewportWidth = rect.w;
        var bodyHeight = Math.max(0, rect.h - m.header);
        var visibleRows = 1;
        for (var pass = 0; pass < 4; ++pass) {
            viewportWidth = Math.max(0, rect.w - (showVertical ? m.scrollbar : 0));
            bodyHeight = Math.max(0, rect.h - m.header - (showHorizontal ? m.scrollbar : 0));
            visibleRows = Math.max(1, Math.floor(bodyHeight / m.row));
            var nextVertical = this.model.rows.length > visibleRows;
            var nextHorizontal = this.contentWidth > viewportWidth;
            if (nextVertical === showVertical && nextHorizontal === showHorizontal) break;
            showVertical = nextVertical;
            showHorizontal = nextHorizontal;
        }

        this.showVertical = showVertical;
        this.showHorizontal = showHorizontal;
        this.viewportWidth = Math.max(0, rect.w - (showVertical ? m.scrollbar : 0));
        this.bodyHeight = Math.max(0, rect.h - m.header - (showHorizontal ? m.scrollbar : 0));
        this.visible = Math.max(1, Math.floor(this.bodyHeight / m.row));
        this.first = ns.Util.clamp(this.first, 0, Math.max(0, this.model.rows.length - this.visible));
        this.horizontalOffset = ns.Util.clamp(this.horizontalOffset, 0, Math.max(0, this.contentWidth - this.viewportWidth));
        if (this.model.active >= 0) {
            ns.Settings.setScroll(this.model.active, this.first);
            ns.Settings.setHScroll(this.model.active, this.horizontalOffset);
        }

        this.contentRect = {
            x: rect.x,
            y: rect.y + m.header,
            w: this.viewportWidth,
            h: this.bodyHeight
        };
        this.scrollbar.configure({
            x: rect.x + this.viewportWidth,
            y: rect.y + m.header,
            w: showVertical ? m.scrollbar : 0,
            h: this.bodyHeight
        }, this.model.rows.length, this.visible);
        this.horizontalScrollbar.configure({
            x: rect.x,
            y: rect.y + m.header + this.bodyHeight,
            w: this.viewportWidth,
            h: showHorizontal ? m.scrollbar : 0
        }, this.contentWidth, this.viewportWidth);
        this.computeColumns();
    };

    PlaylistView.prototype.columnValue = function (columnIndex, itemIndex) {
        var meta = this.model.meta[itemIndex] || {};
        if (columnIndex === 0) return String(itemIndex + 1);
        var definition = ns.Settings.columnDefinitions[columnIndex];
        return definition && meta[definition.key] ? meta[definition.key] : 'No data';
    };

    PlaylistView.prototype.columnCentered = function (columnIndex) {
        var definition = ns.Settings.columnDefinitions[columnIndex];
        return !!(definition && definition.centered);
    };

    PlaylistView.prototype.drawHeader = function (gr) {
        var p = ns.Theme.palette;
        var m = ns.Theme.metrics;
        var f = ns.Theme.fonts;
        gr.FillSolidRect(this.rect.x, this.rect.y, this.viewportWidth, m.header, p.button);
        for (var i = 0; i < this.visibleColumns.length; ++i) {
            var column = this.visibleColumns[i];
            if (column.x + column.width <= this.rect.x || column.x >= this.rect.x + this.viewportWidth) continue;
            var cell = { x: column.x, y: this.rect.y, w: column.width, h: m.header };
            ns.Util.drawRaised(gr, cell);
            var align = this.columnCentered(column.index) ? DT_CENTER : DT_LEFT;
            ns.Util.drawText(gr, column.name, f.normal, p.text,
                { x: cell.x + m.padding, y: cell.y, w: Math.max(0, cell.w - m.padding * 2), h: cell.h },
                align | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
        }
        gr.DrawLine(this.rect.x, this.rect.y + m.header - 1,
            this.rect.x + this.viewportWidth, this.rect.y + m.header - 1, 1, p.border);
        if (this.draggingHeader && this.headerDropMarkerX != null) {
            var markerWidth = ns.Theme.s(2);
            var markerX = ns.Util.clamp(this.headerDropMarkerX - Math.floor(markerWidth / 2),
                this.rect.x, this.rect.x + Math.max(0, this.viewportWidth - markerWidth));
            gr.FillSolidRect(markerX, this.rect.y, markerWidth, m.header, p.highlight);
        }
    };

    PlaylistView.prototype.drawRows = function (gr) {
        var p = ns.Theme.palette;
        var m = ns.Theme.metrics;
        var f = ns.Theme.fonts;
        var playingIndex = -1;
        try {
            var location = plman.GetPlayingItemLocation();
            if (location.IsValid && location.PlaylistIndex === this.model.active) playingIndex = location.PlaylistItemIndex;
        } catch (_) {}

        for (var row = 0; row < this.visible; ++row) {
            var visualIndex = this.first + row;
            if (visualIndex >= this.model.rows.length) break;
            var data = this.model.rows[visualIndex];
            var y = this.contentRect.y + row * m.row;
            if (data.type === 'group') {
                gr.FillSolidRect(this.contentRect.x, y, this.contentRect.w, m.row, p.window);
                gr.DrawLine(this.contentRect.x, y, this.contentRect.x + this.contentRect.w, y, 1, p.lightBorder);
                gr.DrawLine(this.contentRect.x, y + m.row - 1,
                    this.contentRect.x + this.contentRect.w, y + m.row - 1, 1, p.border);
                ns.Util.drawText(gr, data.directory, f.bold, p.text,
                    { x: this.contentRect.x + m.padding, y: y,
                        w: Math.max(0, this.contentRect.w - m.padding * 2), h: m.row });
                continue;
            }

            var itemIndex = data.itemIndex;
            var selected = this.model.isSelected(itemIndex);
            var focused = itemIndex === this.model.focusIndex();
            var playing = itemIndex === playingIndex;
            var fill = selected ? p.highlight : (itemIndex % 2 ? p.alternateBase : p.base);
            var textColour = selected ? p.highlightText : (playing ? p.playing : p.text);
            gr.FillSolidRect(this.contentRect.x, y, this.contentRect.w, m.row, fill);
            if (this.draggingItems && this.dropItem === itemIndex) {
                gr.FillSolidRect(this.contentRect.x, y, this.contentRect.w, ns.Theme.s(2), p.highlight);
            }
            if (playing) {
                gr.FillSolidRect(this.contentRect.x, y, ns.Theme.s(3), m.row,
                    selected ? p.highlightText : p.playing);
            }

            for (var c = 0; c < this.visibleColumns.length; ++c) {
                var column = this.visibleColumns[c];
                if (column.x + column.width <= this.contentRect.x || column.x >= this.contentRect.x + this.contentRect.w) continue;
                var align = this.columnCentered(column.index) ? DT_CENTER : DT_LEFT;
                ns.Util.drawText(gr, this.columnValue(column.index, itemIndex), playing ? f.bold : f.normal, textColour,
                    { x: column.x + m.padding, y: y, w: Math.max(0, column.width - m.padding * 2), h: m.row },
                    align | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX);
                gr.DrawLine(column.x + column.width - 1, y,
                    column.x + column.width - 1, y + m.row, 1, p.grid);
            }
            gr.DrawLine(this.contentRect.x, y + m.row - 1,
                this.contentRect.x + this.contentRect.w, y + m.row - 1, 1, p.grid);
            if (focused && !selected && this.contentRect.w > 3) {
                gr.DrawRect(this.contentRect.x + 1, y + 1, this.contentRect.w - 3, m.row - 3, 1, p.highlight);
            }
        }

        if (!this.model.rows.length) {
            ns.Util.drawText(gr, '\u5f53\u524d\u64ad\u653e\u5217\u8868\u4e3a\u7a7a', f.normal, p.disabledText,
                this.contentRect, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOPREFIX);
        }
    };

    PlaylistView.prototype.draw = function (gr) {
        var p = ns.Theme.palette;
        var m = ns.Theme.metrics;
        if (!this.rect || this.rect.w <= 1 || this.rect.h <= 1) return;
        gr.FillSolidRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h, p.base);
        if (this.viewportWidth > 0) {
            gr.PushClip(this.rect.x, this.rect.y, this.viewportWidth, m.header + this.bodyHeight);
            try {
                this.drawHeader(gr);
                this.drawRows(gr);
            } finally {
                gr.PopClip();
            }
        }
        if (this.showVertical) this.scrollbar.draw(gr);
        if (this.showHorizontal) this.horizontalScrollbar.draw(gr);
        if (this.showVertical && this.showHorizontal) {
            gr.FillSolidRect(this.rect.x + this.viewportWidth, this.rect.y + m.header + this.bodyHeight,
                m.scrollbar, m.scrollbar, p.window);
            gr.DrawRect(this.rect.x + this.viewportWidth, this.rect.y + m.header + this.bodyHeight,
                Math.max(0, m.scrollbar - 1), Math.max(0, m.scrollbar - 1), 1, p.border);
        }
        gr.DrawRect(this.rect.x, this.rect.y, this.rect.w - 1, this.rect.h - 1, 1, p.border);
    };

    PlaylistView.prototype.headerBoundary = function (x, y) {
        if (!this.rect || y < this.rect.y || y >= this.rect.y + ns.Theme.metrics.header ||
                x < this.rect.x || x >= this.rect.x + this.viewportWidth) return -1;
        for (var i = 0; i < this.columnEdges.length; ++i) {
            if (Math.abs(x - this.columnEdges[i].x) <= ns.Theme.s(4)) return this.columnEdges[i].index;
        }
        return -1;
    };

    PlaylistView.prototype.headerColumnAt = function (x, y) {
        if (!this.rect || y < this.rect.y || y >= this.rect.y + ns.Theme.metrics.header ||
                x < this.rect.x || x >= this.rect.x + this.viewportWidth) return -1;
        for (var i = 0; i < this.visibleColumns.length; ++i) {
            var column = this.visibleColumns[i];
            if (x >= column.x && x < column.x + column.width) return column.index;
        }
        return -1;
    };

    PlaylistView.prototype.visualHit = function (x, y) {
        if (!ns.Util.inRect(x, y, this.contentRect)) return null;
        var visualIndex = this.first + Math.floor((y - this.contentRect.y) / ns.Theme.metrics.row);
        if (visualIndex < 0 || visualIndex >= this.model.rows.length) return null;
        return { visualIndex: visualIndex, row: this.model.rows[visualIndex] };
    };

    PlaylistView.prototype.itemHit = function (x, y) {
        var hit = this.visualHit(x, y);
        return hit && hit.row.type === 'item' ? hit.row.itemIndex : -1;
    };

    PlaylistView.prototype.resetHeaderDrag = function () {
        this.headerDownColumn = -1;
        this.headerDownPoint = null;
        this.draggingHeader = false;
        this.headerDropBefore = -1;
        this.headerDropMarkerX = null;
    };

    PlaylistView.prototype.updateHeaderDrop = function (x, y) {
        var m = ns.Theme.metrics;
        if (y < this.rect.y || y >= this.rect.y + m.header ||
                x < this.rect.x || x >= this.rect.x + this.viewportWidth) {
            this.headerDropBefore = -1;
            this.headerDropMarkerX = null;
            return;
        }
        var candidates = [];
        for (var i = 0; i < this.visibleColumns.length; ++i) {
            var column = this.visibleColumns[i];
            if (column.index >= 2 && column.index !== this.headerDownColumn &&
                    column.x + column.width > this.rect.x && column.x < this.rect.x + this.viewportWidth) {
                candidates.push(column);
            }
        }
        for (var c = 0; c < candidates.length; ++c) {
            if (x < candidates[c].x + candidates[c].width / 2) {
                this.headerDropBefore = candidates[c].index;
                this.headerDropMarkerX = candidates[c].x;
                return;
            }
        }
        this.headerDropBefore = -1;
        if (candidates.length) {
            var last = candidates[candidates.length - 1];
            this.headerDropMarkerX = last.x + last.width;
        } else {
            var title = null;
            for (var v = 0; v < this.visibleColumns.length; ++v) {
                if (this.visibleColumns[v].index === 1) title = this.visibleColumns[v];
            }
            this.headerDropMarkerX = title ? title.x + title.width : this.rect.x;
        }
    };

    PlaylistView.prototype.commitHeaderDrop = function () {
        var order = ns.Settings.columnOrder.slice(0);
        var source = order.indexOf(this.headerDownColumn);
        if (source < 2) return false;
        order.splice(source, 1);
        var target = this.headerDropBefore >= 0 ? order.indexOf(this.headerDropBefore) : order.length;
        if (target < 2) target = 2;
        order.splice(target, 0, this.headerDownColumn);
        if (!ns.Settings.setColumnOrder(order)) return false;
        this.layout(this.rect);
        return true;
    };

    PlaylistView.prototype.down = function (x, y) {
        if (this.scrollbar.down(x, y) || this.horizontalScrollbar.down(x, y)) return true;
        var boundary = this.headerBoundary(x, y);
        if (boundary >= 0) {
            this.resizeColumn = boundary;
            this.resizeStartX = x;
            this.resizeStartWidth = ns.Settings.columns[boundary];
            return true;
        }
        var headerColumn = this.headerColumnAt(x, y);
        if (headerColumn >= 0) {
            if (headerColumn >= 2) {
                this.headerDownColumn = headerColumn;
                this.headerDownPoint = { x: x, y: y };
                this.draggingHeader = false;
                this.headerDropBefore = -1;
                this.headerDropMarkerX = null;
            }
            return true;
        }
        var item = this.itemHit(x, y);
        if (item < 0) {
            if (ns.Util.inRect(x, y, this.contentRect) && this.model.active >= 0) {
                plman.ClearPlaylistSelection(this.model.active);
                plman.SetActivePlaylistContext();
                window.Repaint();
                return true;
            }
            return false;
        }
        var ctrl = utils.IsKeyPressed(VK_CONTROL);
        var shift = utils.IsKeyPressed(VK_SHIFT);
        this.downItem = item;
        this.downPoint = { x: x, y: y };
        this.downWasSelected = this.model.isSelected(item);
        if (!this.downWasSelected || ctrl || shift) this.model.select(item, ctrl, shift);
        plman.SetActivePlaylistContext();
        window.Repaint();
        return true;
    };

    PlaylistView.prototype.move = function (x, y) {
        if (this.scrollbar.move(x, y) || this.horizontalScrollbar.move(x, y)) return true;
        if (this.resizeColumn >= 0) {
            var width = Math.max(this.minimumWidth(this.resizeColumn), this.resizeStartWidth + x - this.resizeStartX);
            ns.Settings.setColumn(this.resizeColumn, width);
            this.layout(this.rect);
            window.Repaint();
            return true;
        }
        if (this.headerDownColumn >= 2 && this.headerDownPoint) {
            if (!this.draggingHeader) {
                var headerDistance = Math.abs(x - this.headerDownPoint.x) + Math.abs(y - this.headerDownPoint.y);
                if (headerDistance < ns.Theme.s(7)) return true;
                this.draggingHeader = true;
            }
            this.updateHeaderDrop(x, y);
            window.RepaintRect(this.rect.x, this.rect.y, this.viewportWidth, ns.Theme.metrics.header);
            return true;
        }
        if (this.downItem < 0 || !this.downPoint) return false;
        if (!this.draggingItems) {
            var distance = Math.abs(x - this.downPoint.x) + Math.abs(y - this.downPoint.y);
            if (distance < ns.Theme.s(7)) return true;
            this.draggingItems = true;
        }
        var hit = this.visualHit(x, y);
        if (!hit) this.dropItem = this.model.count();
        else this.dropItem = hit.row.type === 'item' ? hit.row.itemIndex : hit.row.firstItem;
        window.Repaint();
        return true;
    };

    PlaylistView.prototype.up = function (x, y) {
        var scrollHandled = this.scrollbar.up();
        scrollHandled = this.horizontalScrollbar.up() || scrollHandled;
        if (scrollHandled) return true;
        if (this.resizeColumn >= 0) {
            this.resizeColumn = -1;
            return true;
        }
        if (this.headerDownColumn >= 2) {
            var shouldCommit = this.draggingHeader && this.headerDropMarkerX != null &&
                y >= this.rect.y && y < this.rect.y + ns.Theme.metrics.header &&
                x >= this.rect.x && x < this.rect.x + this.viewportWidth;
            if (shouldCommit) this.commitHeaderDrop();
            this.resetHeaderDrag();
            window.Repaint();
            return true;
        }
        if (this.draggingItems && this.model.active >= 0 && this.dropItem >= 0) {
            plman.UndoBackup(this.model.active);
            plman.MovePlaylistSelectionV2(this.model.active, this.dropItem);
        } else if (this.downItem >= 0 && this.downWasSelected &&
                !utils.IsKeyPressed(VK_CONTROL) && !utils.IsKeyPressed(VK_SHIFT)) {
            this.model.select(this.downItem, false, false);
        }
        var handled = this.downItem >= 0;
        this.downItem = -1;
        this.downPoint = null;
        this.draggingItems = false;
        this.dropItem = -1;
        if (handled) window.Repaint();
        return handled;
    };

    PlaylistView.prototype.doubleClick = function (x, y) {
        var item = this.itemHit(x, y);
        if (item < 0 || this.model.active < 0) return false;
        plman.ExecutePlaylistDefaultAction(this.model.active, item);
        return true;
    };

    PlaylistView.prototype.measureColumn = function (index, gr) {
        var m = ns.Theme.metrics;
        var width = gr.CalcTextWidth(ns.Settings.columnDefinitions[index].name,
            ns.Theme.fonts.normal, true) + m.padding * 2;
        for (var row = 0; row < this.visible; ++row) {
            var visualIndex = this.first + row;
            if (visualIndex >= this.model.rows.length) break;
            var data = this.model.rows[visualIndex];
            if (data.type !== 'item') continue;
            width = Math.max(width,
                gr.CalcTextWidth(this.columnValue(index, data.itemIndex), ns.Theme.fonts.normal, true) + m.padding * 2);
        }
        return ns.Util.clamp(Math.ceil(width), this.minimumWidth(index), ns.Theme.s(1200));
    };

    PlaylistView.prototype.autoFitColumns = function (indices) {
        var image = gdi.CreateImage(1, 1);
        var gr = image.GetGraphics();
        try {
            for (var i = 0; i < indices.length; ++i) {
                ns.Settings.setColumn(indices[i], this.measureColumn(indices[i], gr));
            }
        } finally {
            image.ReleaseGraphics(gr);
        }
        this.layout(this.rect);
        window.Repaint();
    };

    PlaylistView.prototype.headerContext = function (x, y) {
        var clicked = this.headerColumnAt(x, y);
        var menu = window.CreatePopupMenu();
        menu.AppendMenuItem(clicked >= 0 ? MF_STRING : MF_GRAYED, 1, '\u81ea\u52a8\u8c03\u6574\u6b64\u5217');
        menu.AppendMenuItem(MF_STRING, 2, '\u81ea\u52a8\u8c03\u6574\u6240\u6709\u5217');
        menu.AppendMenuSeparator();
        var definitions = ns.Settings.columnDefinitions;
        for (var i = 0; i < definitions.length; ++i) {
            var id = 100 + i;
            menu.AppendMenuItem(definitions[i].alwaysVisible ? MF_GRAYED : MF_STRING, id, definitions[i].name);
            menu.CheckMenuItem(id, definitions[i].alwaysVisible || ns.Settings.columnVisible[i]);
        }
        var result = menu.TrackPopupMenu(x, y);
        if (result === 1 && clicked >= 0) {
            this.autoFitColumns([clicked]);
        } else if (result === 2) {
            var visible = [];
            for (var c = 0; c < definitions.length; ++c) {
                if (ns.Settings.columnVisible[c]) visible.push(c);
            }
            this.autoFitColumns(visible);
        } else if (result >= 100 && result < 100 + definitions.length) {
            var index = result - 100;
            if (!definitions[index].alwaysVisible) {
                ns.Settings.setColumnVisible(index, !ns.Settings.columnVisible[index]);
                this.layout(this.rect);
                window.Repaint();
            }
        }
        return true;
    };

    PlaylistView.prototype.context = function (x, y) {
        if (y >= this.rect.y && y < this.rect.y + ns.Theme.metrics.header) return this.headerContext(x, y);
        var hit = this.visualHit(x, y);
        if (hit && hit.row.type === 'group') return this.groupContext(hit.row, x, y);
        var item = hit && hit.row.type === 'item' ? hit.row.itemIndex : -1;
        if (item >= 0 && !this.model.isSelected(item)) this.model.select(item, false, false);
        if (this.model.active < 0) return true;
        var manager = fb.CreateContextMenuManager();
        manager.InitContextPlaylist();
        var menu = window.CreatePopupMenu();
        var selected = this.model.selectedHandles();
        menu.AppendMenuItem(selected && selected.Count ? MF_STRING : MF_GRAYED, 1,
            '\u4ece\u64ad\u653e\u5217\u8868\u4e2d\u5220\u9664');
        menu.AppendMenuItem(MF_STRING, 2, '\u6dfb\u52a0\u6587\u4ef6...');
        menu.AppendMenuSeparator();
        manager.BuildMenu(menu, 100, 10000);
        var result = menu.TrackPopupMenu(x, y);
        if (result === 1) this.removeSelected();
        else if (result === 2) this.addFiles();
        else if (result >= 100) manager.ExecuteByID(result - 100);
        return true;
    };

    PlaylistView.prototype.groupContext = function (group, x, y) {
        var canRemove = this.model.active >= 0 && group && group.itemCount > 0;
        var menu = window.CreatePopupMenu();
        menu.AppendMenuItem(canRemove ? MF_STRING : MF_GRAYED, 1,
            '\u4ece\u64ad\u653e\u5217\u8868\u4e2d\u79fb\u9664\u6b64\u6587\u4ef6\u5939');
        menu.AppendMenuItem(this.model.active >= 0 ? MF_STRING : MF_GRAYED, 2,
            '\u6dfb\u52a0\u6587\u4ef6...');
        var result = menu.TrackPopupMenu(x, y);
        if (result === 1 && canRemove) this.removeGroup(group);
        else if (result === 2) this.addFiles();
        return true;
    };

    PlaylistView.prototype.removeGroup = function (group) {
        if (this.model.active < 0 || !group || group.itemCount <= 0) return false;
        var total = this.model.count();
        var first = Math.floor(group.firstItem);
        var count = Math.floor(group.itemCount);
        if (first < 0 || first >= total || count <= 0 || first + count > total) return false;
        var indices = [];
        for (var i = 0; i < count; ++i) indices.push(first + i);
        plman.UndoBackup(this.model.active);
        plman.ClearPlaylistSelection(this.model.active);
        plman.SetPlaylistSelection(this.model.active, indices, true);
        plman.RemovePlaylistSelection(this.model.active);
        plman.SetActivePlaylistContext();
        return true;
    };

    PlaylistView.prototype.removeSelected = function () {
        if (this.model.active < 0) return false;
        var selected = this.model.selectedHandles();
        if (!selected || !selected.Count) return false;
        plman.UndoBackup(this.model.active);
        plman.RemovePlaylistSelection(this.model.active);
        return true;
    };

    PlaylistView.prototype.addFiles = function () {
        if (this.model.active < 0) return false;
        fb.RunMainMenuCommand('File/Add files...');
        return true;
    };

    PlaylistView.prototype.wheel = function (step) {
        if (utils.IsKeyPressed(VK_SHIFT)) {
            this.horizontalScrollbar.set(this.horizontalOffset - step * ns.Theme.s(48));
        } else {
            this.scrollbar.set(this.first - step * 3);
        }
        return true;
    };

    PlaylistView.prototype.ensureVisible = function (itemIndex) {
        if (itemIndex < 0 || itemIndex >= this.model.itemToVisual.length) return;
        var visual = this.model.itemToVisual[itemIndex];
        if (visual < this.first) this.scrollbar.set(visual);
        else if (visual >= this.first + this.visible) this.scrollbar.set(visual - this.visible + 1);
    };

    PlaylistView.prototype.key = function (vkey) {
        if (this.model.active < 0) return false;
        var ctrl = utils.IsKeyPressed(VK_CONTROL);
        var shift = utils.IsKeyPressed(VK_SHIFT);
        if (ctrl && vkey === 0x41) {
            this.model.selectAll();
            window.Repaint();
            return true;
        }
        if (vkey === VK_DELETE) {
            this.removeSelected();
            return true;
        }
        var focus = this.model.focusIndex();
        if (vkey === VK_RETURN && focus >= 0) {
            plman.ExecutePlaylistDefaultAction(this.model.active, focus);
            return true;
        }
        var target = focus;
        if (vkey === VK_UP) target = Math.max(0, focus - 1);
        else if (vkey === VK_DOWN) target = Math.min(this.model.count() - 1, focus + 1);
        else if (vkey === VK_HOME) target = 0;
        else if (vkey === VK_END) target = this.model.count() - 1;
        // JSplitter's bundled Flags.js omits the Page Up/Page Down aliases.
        else if (vkey === 0x21) target = Math.max(0, focus - this.visible);
        else if (vkey === 0x22) target = Math.min(this.model.count() - 1, focus + this.visible);
        else return false;
        if (target >= 0) {
            this.model.select(target, ctrl, shift);
            this.ensureVisible(target);
        }
        return true;
    };

    PlaylistView.prototype.externalDrag = function (action, x, y, isDrop) {
        if (!ns.Util.inRect(x, y, this.rect) || this.model.active < 0) {
            action.Effect = 0;
            return false;
        }
        var effect = (action.Effect & 1) || (action.Effect & 4);
        action.Effect = effect || 1;
        action.Text = '\u6dfb\u52a0\u5230\u5f53\u524d\u64ad\u653e\u5217\u8868';
        var hit = this.visualHit(x, y);
        var base = this.model.count();
        if (hit) base = hit.row.type === 'item' ? hit.row.itemIndex : hit.row.firstItem;
        this.dropItem = base;
        if (isDrop) {
            plman.UndoBackup(this.model.active);
            action.Playlist = this.model.active;
            action.Base = base;
            action.ToSelect = true;
            this.dropItem = -1;
        }
        window.Repaint();
        return true;
    };

    PlaylistView.prototype.dragLeave = function () {
        this.dropItem = -1;
        window.Repaint();
    };

    ns.PlaylistView = PlaylistView;
})(FusionUI);
