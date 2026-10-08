// src/rules.js —— 规则：五连判定等纯函数，不持有状态、不碰 DOM。

var Rules = {
  // checkWin(board, x, y, player) -> int
  // 以刚落的 (x,y) 为中心，四方向双向延伸计连子，>=5 返回 player，否则 0
  checkWin: function (board, x, y, player) {
    var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var dx = dirs[i][0], dy = dirs[i][1];
      var count = 1;
      // 正方向
      var nx = x + dx, ny = y + dy;
      while (this.inBounds(board, nx, ny) && board[nx][ny] === player) {
        count++;
        nx += dx;
        ny += dy;
      }
      // 反方向
      nx = x - dx;
      ny = y - dy;
      while (this.inBounds(board, nx, ny) && board[nx][ny] === player) {
        count++;
        nx -= dx;
        ny -= dy;
      }
      if (count >= 5) {
        return player;
      }
    }
    return 0;
  },

  // isFull(board) -> bool  棋盘满判和棋
  isFull: function (board) {
    for (var x = 0; x < board.length; x++) {
      for (var y = 0; y < board[0].length; y++) {
        if (board[x][y] === 0) {
          return false;
        }
      }
    }
    return true;
  },

  // inBounds(board, x, y) -> bool  坐标合法性
  inBounds: function (board, x, y) {
    return x >= 0 && x < board.length && y >= 0 && y < board[0].length;
  },

  // isLegal(board, x, y) -> bool  可落子（界内且空位）
  isLegal: function (board, x, y) {
    return this.inBounds(board, x, y) && board[x][y] === 0;
  }
};
