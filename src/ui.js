// src/ui.js —— 界面：canvas 绘制棋盘/棋子/光标，stage 内挂 absolute 覆盖层按钮。
// 职责：render(g, w, h) 每帧绘制；init/destroy 管理 DOM 与监听。

var UI = (function () {
  var stage = null;
  var hud = null;
  var turnEl = null;
  var overlay = null;  // 首次引导 / 结算浮层
  var btns = [];
  var keyHandler = null;
  var started = false;

  // 键盘光标状态（十字高亮）
  var cur = { x: 7, y: 7 };
  var curInit = false;

  function makeBtn(label, fn) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.pointerEvents = 'auto';
    b.style.padding = '6px 14px';
    b.style.margin = '0 6px';
    b.style.fontSize = '14px';
    b.style.borderRadius = '6px';
    b.style.border = '1px solid #886';
    b.style.background = 'rgba(255,248,230,0.92)';
    b.style.color = '#332';
    b.style.cursor = 'pointer';
    b.addEventListener('click', fn);
    btns.push(b);
    return b;
  }

  function showOverlay(text) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.right = '0';
      overlay.style.bottom = '0';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.background = 'rgba(0,0,0,0.45)';
      overlay.style.color = '#fff';
      overlay.style.fontSize = '22px';
      overlay.style.textAlign = 'center';
      overlay.style.pointerEvents = 'none';
      overlay.style.whiteSpace = 'pre-line';
      hud.appendChild(overlay);
    }
    overlay.textContent = text;
    overlay.style.display = 'flex';
  }

  function hideOverlay() {
    if (overlay) overlay.style.display = 'none';
  }

  // init(stageEl) -> void    创建覆盖层（悔棋/重开按钮、回合提示）
  function init(stageEl) {
    stage = stageEl;
    hud = document.createElement('div');
    hud.style.position = 'absolute';
    hud.style.left = '0';
    hud.style.top = '0';
    hud.style.right = '0';
    hud.style.pointerEvents = 'none';
    stage.appendChild(hud);

    turnEl = document.createElement('div');
    turnEl.style.pointerEvents = 'none';
    turnEl.style.padding = '8px 12px';
    turnEl.style.fontSize = '16px';
    turnEl.style.fontWeight = 'bold';
    turnEl.style.color = '#222';
    turnEl.style.textShadow = '0 0 4px rgba(255,255,255,0.8)';
    turnEl.style.textAlign = 'center';
    hud.appendChild(turnEl);

    var row = document.createElement('div');
    row.style.pointerEvents = 'none';
    row.style.textAlign = 'center';
    row.style.marginTop = '4px';
    row.appendChild(makeBtn('悔棋', function () {
      // 悔棋支持连点：每点一次退一手，并隐藏结算浮层
      Engine.undo();
      if (curInit) {
        var last = Engine.getLastMove && Engine.getLastMove();
        if (last) { cur.x = last.x; cur.y = last.y; }
      }
      hideOverlay();
    }));
    row.appendChild(makeBtn('重开', function () {
      Engine.reset();
      started = false;
      showOverlay('点击 / 触摸开始');
    }));
    hud.appendChild(row);

    // 键盘方向键移动光标，Enter/空格落子
    keyHandler = function (e) {
      var L = Engine.getLayout();
      if (!L) return;
      var k = e.key;
      var dx = 0, dy = 0;
      if (k === 'ArrowLeft') dx = -1;
      else if (k === 'ArrowRight') dx = 1;
      else if (k === 'ArrowUp') dy = -1;
      else if (k === 'ArrowDown') dy = 1;
      else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        UI.markStarted();
        Engine.place(cur.x, cur.y);
        return;
      } else {
        return;
      }
      e.preventDefault();
      curInit = true;
      cur.x = Math.min(L.n - 1, Math.max(0, cur.x + dx));
      cur.y = Math.min(L.n - 1, Math.max(0, cur.y + dy));
    };
    window.addEventListener('keydown', keyHandler);

    showOverlay('点击 / 触摸开始');
  }

  function drawBoard(g, L) {
    var i;
    g.strokeStyle = '#6b4f2a';
    g.lineWidth = 1;
    for (i = 0; i < L.n; i++) {
      g.beginPath();
      g.moveTo(L.ox + i * L.cell, L.oy);
      g.lineTo(L.ox + i * L.cell, L.oy + (L.n - 1) * L.cell);
      g.stroke();
      g.beginPath();
      g.moveTo(L.ox, L.oy + i * L.cell);
      g.lineTo(L.ox + (L.n - 1) * L.cell, L.oy + i * L.cell);
      g.stroke();
    }
    // 星位（15 路标准四星 + 天元）
    var stars = L.n === 15 ? [[3,3],[11,3],[7,7],[3,11],[11,11]]
              : L.n === 13 ? [[3,3],[9,3],[6,6],[3,9],[9,9]]
              : [[3,3],[L.n-4,3],[Math.floor(L.n/2),Math.floor(L.n/2)],[3,L.n-4],[L.n-4,L.n-4]];
    g.fillStyle = '#6b4f2a';
    for (i = 0; i < stars.length; i++) {
      var sx = L.ox + stars[i][0] * L.cell;
      var sy = L.oy + stars[i][1] * L.cell;
      g.beginPath();
      g.arc(sx, sy, Math.max(2, L.cell * 0.12), 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawStones(g, board, L) {
    var x, y;
    var r = L.cell * 0.42;
    for (y = 0; y < L.n; y++) {
      for (x = 0; x < L.n; x++) {
        var v = board[y][x];
        if (!v) continue;
        var cx = L.ox + x * L.cell;
        var cy = L.oy + y * L.cell;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fillStyle = v === 1 ? '#111' : '#f5f5f5';
        g.fill();
        g.lineWidth = 1;
        g.strokeStyle = v === 1 ? '#000' : '#999';
        g.stroke();
      }
    }
  }

  // 键盘光标：十字高亮 + 光标圈
  function drawCursor(g, L) {
    if (!curInit) return;
    var cx = L.ox + cur.x * L.cell;
    var cy = L.oy + cur.y * L.cell;
    g.strokeStyle = 'rgba(255,60,60,0.75)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(L.ox, cy);
    g.lineTo(L.ox + (L.n - 1) * L.cell, cy);
    g.moveTo(cx, L.oy);
    g.lineTo(cx, L.oy + (L.n - 1) * L.cell);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, L.cell * 0.48, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,60,60,0.95)';
    g.lineWidth = 2;
    g.stroke();
  }

  // render(g, w, h) -> void  每帧绘制
  function render(g, w, h) {
    // 背景
    g.fillStyle = '#e8c98a';
    g.fillRect(0, 0, w, h);

    var L = Engine.getLayout();
    if (!L) return;
    if (!curInit) { cur.x = Math.floor(L.n / 2); cur.y = Math.floor(L.n / 2); curInit = true; }

    drawBoard(g, L);
    drawCursor(g, L);

    var board = Engine.getBoard();
    drawStones(g, board, L);

    // 最后一手标记
    var last = Engine.getLastMove && Engine.getLastMove();
    if (last) {
      var lx = L.ox + last.x * L.cell;
      var ly = L.oy + last.y * L.cell;
      g.beginPath();
      g.arc(lx, ly, L.cell * 0.14, 0, Math.PI * 2);
      g.fillStyle = '#e33';
      g.fill();
    }

    // 回合提示
    var winner = Engine.getWinner();
    if (turnEl) {
      var turn = Engine.getTurn();
      if (winner === 1) turnEl.textContent = '黑方胜利！';
      else if (winner === 2) turnEl.textContent = '白方胜利！';
      else turnEl.textContent = turn === 1 ? '轮到黑方' : '轮到白方';
    }

    // 胜利：横线 + 结算浮层
    if (winner) {
      var line = Engine.getWinLine && Engine.getWinLine();
      if (line && line.length >= 2) {
        var a = line[0], b = line[line.length - 1];
        g.beginPath();
        g.moveTo(L.ox + a.x * L.cell, L.oy + a.y * L.cell);
        g.lineTo(L.ox + b.x * L.cell, L.oy + b.y * L.cell);
        g.strokeStyle = winner === 1 ? 'rgba(255,80,80,0.9)' : 'rgba(60,120,255,0.9)';
        g.lineWidth = Math.max(3, L.cell * 0.12);
        g.lineCap = 'round';
        g.stroke();
      }
      showOverlay((winner === 1 ? '黑方' : '白方') + ' 获胜！\n点「悔棋」复盘，或「重开」再来一局');
    }
  }

  // pickCell(px, py) -> {x,y}|null  屏幕坐标 -> 格子坐标
  function pickCell(px, py) {
    var L = Engine.getLayout();
    if (!L) return null;
    var x = Math.round((px - L.ox) / L.cell);
    var y = Math.round((py - L.oy) / L.cell);
    if (x < 0 || y < 0 || x >= L.n || y >= L.n) return null;
    var dx = px - (L.ox + x * L.cell);
    var dy = py - (L.oy + y * L.cell);
    if (dx * dx + dy * dy > L.cell * L.cell * 0.36) return null;
    cur.x = x; cur.y = y; curInit = true;
    return { x: x, y: y };
  }

  function markStarted() {
    if (!started) {
      started = true;
      hideOverlay();
    }
  }

  // destroy() -> void  移除覆盖层与监听
  function destroy() {
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    btns = [];
    if (hud && hud.parentNode) hud.parentNode.removeChild(hud);
    hud = null;
    turnEl = null;
    overlay = null;
    stage = null;
    started = false;
    curInit = false;
  }

  return {
    init: init,
    render: render,
    pickCell: pickCell,
    markStarted: markStarted,
    destroy: destroy
  };
})();
