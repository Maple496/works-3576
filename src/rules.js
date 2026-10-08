// src/rules.js —— 规则：五连判定等纯函数，不持有状态、不碰 DOM。
// 坐标语义统一：board 按 [y][x] 索引（行 y、列 x），所有函数入参均为 (x, y)。

var Rules = {
  // 方向枚举：[dx, dy]，四方向（水平/垂直/两条对角线）
  DIRS: [[1, 0], [0, 1], [1, 1], [1, -1]],

  // checkWin(board, x, y, player) -> Array | 0
  // 以刚落的 (x,y) 为中心，四方向双向延伸计连子；
  // 若某方向连子 >= 5，返回该方向上包含全部连子的坐标数组 [{x,y}, ...]（按连线顺序，供 UI 高亮）；
  // 否则返回 0。
  checkWin: function (board, x, y, player) {
    var dirs = this.DIRS;
    for (var i = 0; i < dirs.length; i++) {
      var dx = dirs[i][0], dy = dirs[i][1];
      var line = [{ x: x, y: y }];

      // 正方向延伸
      var nx = x + dx, ny = y + dy;
      while (this.inBounds(board, nx, ny) && board[ny][nx] === player) {
        line.push({ x: nx, y: ny });
        nx += dx;
        ny += dy;
      }
      // 反方向延伸（头部插入，保持连线顺序）
      nx = x - dx;
      ny = y - dy;
      while (this.inBounds(board, nx, ny) && board[ny][nx] === player) {
        line.unshift({ x: nx, y: ny });
        nx -= dx;
        ny -= dy;
      }

      if (line.length >= 5) {
        return line;
      }
    }
    return 0;
  },

  // isFull(board) -> bool  棋盘满判和棋（board[y][x]）
  isFull: function (board) {
    for (var y = 0; y < board.length; y++) {
      for (var x = 0; x < board[0].length; x++) {
        if (board[y][x] === 0) {
          return false;
        }
      }
    }
    return true;
  },

  // inBounds(board, x, y) -> bool  坐标合法性：行 y 在 [0, board.length)，列 x 在 [0, board[0].length)
  inBounds: function (board, x, y) {
    return y >= 0 && y < board.length && x >= 0 && x < board[0].length;
  },

  // isLegal(board, x, y) -> bool  可落子（界内且空位，board[y][x]）
  isLegal: function (board, x, y) {
    return this.inBounds(board, x, y) && board[y][x] === 0;
  }
};

