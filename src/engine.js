// src/engine.js —— 引擎：全局状态、回合流转、布局、每帧 update
// 职责：持有棋盘与游戏状态，驱动回合；不负责绘制与 DOM。

var Engine = (function () {
  var SIZE = 15; // 15x15 棋盘
  var board = [];        // board[y][x]: 0 空 / 1 黑 / 2 白
  var current = 1;       // 当前行棋方
  var winner = 0;        // 0 无 / 1 黑胜 / 2 白胜
  var history = [];      // 悔棋栈：[{x,y,player}]
  var layout = { ox: 0, oy: 0, cell: 0, w: 0, h: 0 };
  var lastMove = null;   // 最近落子 {x,y,player,t}
  var winLine = null;    // 胜利五连线段（由 UI 高亮，引擎仅记录）

  // 对外签名一览：
  // init() -> void                 重置棋盘与状态
  // layout(w, h) -> void           画布尺寸变化时重算棋盘原点/格距
  // update(ts) -> void             每帧逻辑（记录最近落子时间供动画使用）
  // place(x, y) -> bool            在 (x,y) 落子，胜利用 Rules.checkWin 判定
  // undo() -> bool                 悔棋一步
  // reset() -> void                重开
  // getters: getBoard(), getCurrent(), getWinner(), getHistory(), getLayout()

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
    // 格距取可用边长的较小区，留出边距，保证棋盘完整居中
    var pad = 24;
    var avail = Math.min(w, h) - pad * 2;
    layout.cell = avail > 0 ? avail / (SIZE - 1) : 10;
    // 居中偏移
    var span = layout.cell * (SIZE - 1);
    layout.ox = (w - span) / 2;
    layout.oy = (h - span) / 2;
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
        winLine = line;
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
    winner = 0;
    winLine = null;
    current = step.player;
    lastMove = history.length > 0
      ? { x: history[history.length - 1].x, y: history[history.length - 1].y, player: history[history.length - 1].player, t: 1 }
      : null;
    return true;
  }

  function reset() { init(); }

  function getBoard() { return board; }
  function getCurrent() { return current; }
  function getWinner() { return winner; }
  function getHistory() { return history; }
  function getLayout() { return layout; }
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
    getWinner: getWinner,
    getHistory: getHistory,
    getLayout: getLayout,
    getSize: getSize,
    getLastMove: getLastMove,
    getWinLine: getWinLine
  };
})();
