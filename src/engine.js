// src/engine.js —— 引擎：全局状态、回合流转、布局、每帧 update
// 职责：持有棋盘与游戏状态，驱动回合；不负责绘制与 DOM。

var Engine = (function () {
  var SIZE = 15; // 15x15 棋盘
  var board = [];        // board[y][x]: 0 空 / 1 黑 / 2 白
  var current = 1;       // 当前行棋方
  var winner = 0;        // 0 无 / 1 黑胜 / 2 白胜 / -1 平局
  var history = [];      // 悔棋栈：[{x,y,player}]
  var layout = { ox: 0, oy: 0, cell: 0, n: SIZE, w: 0, h: 0 };
  var lastMove = null;   // 最近落子 {x,y,player,t}
  var winLine = null;    // 胜利五连线段：[[x1,y1],[x2,y2]]（画布像素坐标，UI 高亮用）

  // 对外签名一览：
  // init() -> void                 重置棋盘与状态
  // layout(w, h) -> void           画布尺寸变化时重算棋盘原点/格距
  // update(ts) -> void             每帧逻辑（记录最近落子时间供动画使用）
  // place(x, y) -> bool            在 (x,y) 落子，胜利用 Rules.checkWin 判定
  // undo() -> bool                 悔棋一步（可撤销胜利）
  // reset() -> void                重开
  // getters: getBoard(), getCurrent()/getTurn(), getWinner(), getHistory(),
  //          getLayout() -> {ox,oy,cell,n,w,h}, getWinLine() -> [[x1,y1],[x2,y2]] | null

  function init() {
    board = [];
    for (var y = 0; y < SIZE; y++) {
      var row = [];
      for (var x = 0; x < SIZE; x++) row.push(0);
      board.push(row);
    }
    current = 1;
    winner = 0;
    history = [];
    lastMove = null;
    winLine = null;
  }

  function layoutFn(w, h) {
    layout.w = w;
    layout.h = h;
    layout.n = SIZE;
    // 格距取可用边长的较小区，留出边距，保证棋盘完整居中
    var pad = 24;
    var avail = Math.min(w, h) - pad * 2;
    layout.cell = avail > 0 ? avail / (SIZE - 1) : 10;
    // 居中偏移
    var span = layout.cell * (SIZE - 1);
    layout.ox = (w - span) / 2;
    layout.oy = (h - span) / 2;
  }

  // 把任意胜利线表示归一化为两点线段（棋盘格坐标 -> 画布像素坐标）
  function toSegment(line) {
    if (!line) return null;
    var pts = [];
    if (Array.isArray(line[0]) || (line[0] && typeof line[0] === 'object')) {
      // 形如 [[x1,y1],[x2,y2],...] 或 [{x,y},{x,y},...]
      for (var i = 0; i < line.length; i++) {
        var p = line[i];
        if (Array.isArray(p)) pts.push({ x: p[0], y: p[1] });
        else if (p && typeof p.x === 'number') pts.push({ x: p.x, y: p.y });
      }
    } else if (line.length >= 4 && typeof line[0] === 'number') {
      // 形如 [x1,y1,x2,y2]
      pts.push({ x: line[0], y: line[1] });
      pts.push({ x: line[2], y: line[3] });
    }
    if (pts.length < 2) return null;
    var first = pts[0], lastPt = pts[pts.length - 1];
    // 取该两点间的极值，保证首末为线段端点
    var minX = first.x, maxX = first.x, minY = first.y, maxY = first.y;
    for (var j = 0; j < pts.length; j++) {
      if (pts[j].x < minX) minX = pts[j].x;
      if (pts[j].x > maxX) maxX = pts[j].x;
      if (pts[j].y < minY) minY = pts[j].y;
      if (pts[j].y > maxY) maxY = pts[j].y;
    }
    return [
      [layout.ox + minX * layout.cell, layout.oy + minY * layout.cell],
      [layout.ox + maxX * layout.cell, layout.oy + maxY * layout.cell]
    ];
  }

  function update(ts) {
    // 记录最近落子的时间戳，供 UI 做落子涟漪动画；胜负后不再更新
    if (lastMove && !lastMove.t) lastMove.t = ts;
  }

  function place(x, y) {
    if (winner !== 0) return false;
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return false;
    if (board[y][x] !== 0) return false;
    board[y][x] = current;
    history.push({ x: x, y: y, player: current });
    lastMove = { x: x, y: y, player: current, t: 0 };

    // 判胜：优先使用 Rules.checkWin（同作用域拼接）
    if (typeof Rules !== 'undefined' && Rules && typeof Rules.checkWin === 'function') {
      var line = Rules.checkWin(board, x, y, current);
      if (line) {
        winner = current;
        winLine = toSegment(line);
        return true;
      }
    }

    // 棋盘下满判和
    var full = true;
    for (var yy = 0; yy < SIZE && full; yy++) {
      for (var xx = 0; xx < SIZE; xx++) {
        if (board[yy][xx] === 0) { full = false; break; }
      }
    }
    if (full) { winner = -1; return true; } // -1 表示平局

    current = current === 1 ? 2 : 1;
    return true;
  }

  function undo() {
    if (history.length === 0) return false;
    var step = history.pop();
    board[step.y][step.x] = 0;
    // 胜利/平局后悔棋：一并清除胜负与连线，回合交还给被撤销一方
    winner = 0;
    winLine = null;
    current = step.player;
    lastMove = history.length > 0
      ? {
          x: history[history.length - 1].x,
          y: history[history.length - 1].y,
          player: history[history.length - 1].player,
          t: 1
        }
      : null;
    return true;
  }

  function reset() { init(); }

  function getBoard() { return board; }
  function getCurrent() { return current; }
  function getTurn() { return current; } // getCurrent 的别名
  function getWinner() { return winner; }
  function getHistory() { return history; }
  function getLayout() {
    return {
      ox: layout.ox,
      oy: layout.oy,
      cell: layout.cell,
      n: layout.n,
      w: layout.w,
      h: layout.h
    };
  }
  function getSize() { return SIZE; }
  function getLastMove() { return lastMove; }
  function getWinLine() { return winLine; }

  return {
    init: init,
    layout: layoutFn,
    update: update,
    place: place,
    undo: undo,
    reset: reset,
    getBoard: getBoard,
    getCurrent: getCurrent,
    getTurn: getTurn,
    getWinner: getWinner,
    getHistory: getHistory,
    getLayout: getLayout,
    getSize: getSize,
    getLastMove: getLastMove,
    getWinLine: getWinLine
  };
})();
