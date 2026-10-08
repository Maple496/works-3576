// src/main.js —— 入口：创建画布、装配 Engine/Rules/UI，Work.register 容器合同
// 职责：唯一在此注册容器；mount 建 canvas 挂入 ctx.stage；destroy 停 RAF、解绑监听、清 DOM。
// 纪律：RAF/监听句柄保存在 Work.register 闭包可见变量上，destroy 逐一取消，保证零残留。
(function () {
  var gt = typeof globalThis !== 'undefined' ? globalThis : window;

  // 显式取全局 Work，兼容桥接 register，避免 load 阶段抛错
  var host;
  if (typeof Work === 'object' && Work !== null && typeof Work.register === 'function') {
    host = Work;
  } else {
    host = gt.Work = (typeof gt.Work === 'object' && gt.Work !== null) ? gt.Work : {};
    if (typeof host.register !== 'function') {
      if (typeof gt.register === 'function') {
        host.register = function (def) { gt.register(def); };
      } else {
        host.register = function (def) { host.__definition = def; };
      }
    }
  }

  // —— Work.register 闭包级句柄（destroy 可见可清）——
  var raf = 0;
  var canvas = null;
  var ctx2d = null; // 画布 2D 上下文
  var onResize = null;
  var boundPointerDown = null;
  var boundPointerMove = null;
  var boundKeyDown = null;
  var boundOnBounds = null;
  var started = false;

  var cursor = { col: 7, row: 7 };

  var KEYMAP = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    ArrowUp: [0, -1], ArrowDown: [0, 1],
    KeyA: [-1, 0], KeyD: [1, 0],
    KeyW: [0, -1], KeyS: [0, 1]
  };

  function clampCursor() {
    var n = Engine.getSize();
    if (n <= 0) { n = 15; }
    if (cursor.col < 0) cursor.col = 0;
    if (cursor.row < 0) cursor.row = 0;
    if (cursor.col > n - 1) cursor.col = n - 1;
    if (cursor.row > n - 1) cursor.row = n - 1;
  }

  function markStarted() {
    if (started) return;
    started = true;
    if (typeof UI.markStarted === 'function') UI.markStarted();
  }

  function applySize(w, h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    Engine.layout(w, h);
  }

  function cellFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    return UI.pickCell(x, y); // {x, y} 格子坐标或 null
  }

  function onPointerDown(e) {
    e.preventDefault();
    markStarted();
    var cell = cellFromEvent(e);
    if (cell) {
      cursor.col = cell.x;
      cursor.row = cell.y;
      Engine.place(cell.x, cell.y);
    }
  }

  function onPointerMove(e) {
    // 悬停高亮为可选增强；触屏以 pointerdown 为准
    if (!e || e.pointerType === 'touch') return;
    var cell = cellFromEvent(e);
    if (cell) {
      cursor.col = cell.x;
      cursor.row = cell.y;
    }
  }

  function onKeyDown(e) {
    var d = KEYMAP[e.code];
    if (d) {
      e.preventDefault();
      cursor.col += d[0];
      cursor.row += d[1];
      clampCursor();
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      e.preventDefault();
      markStarted();
      clampCursor();
      Engine.place(cursor.col, cursor.row);
    } else if (e.code === 'KeyZ' || e.code === 'Backspace') {
      // 悔棋快捷键（触屏端由 UI 提供按钮）
      e.preventDefault();
      if (typeof Engine.undo === 'function') Engine.undo();
    } else if (e.code === 'KeyR') {
      // 重开快捷键
      e.preventDefault();
      if (typeof Engine.reset === 'function') Engine.reset();
    }
  }

  function loop(ts) {
    if (typeof Engine.update === 'function') Engine.update(ts);
    if (typeof Rules !== 'undefined' && typeof Rules.tick === 'function') Rules.tick();
    UI.render(ctx2d, canvas.width, canvas.height);
    raf = requestAnimationFrame(loop);
  }

  host.register({
    mount: function (ctx) {
      started = false;
      cursor.col = 7;
      cursor.row = 7;

      canvas = document.createElement('canvas');
      ctx2d = canvas.getContext('2d');
      // 画布尺寸合同：ctx.bounds 字段为 w/h
      applySize(ctx.bounds.w, ctx.bounds.h);
      canvas.style.touchAction = 'none';
      ctx.stage.appendChild(canvas);

      Engine.init();
      if (typeof Rules !== 'undefined' && typeof Rules.init === 'function') Rules.init();
      UI.init(ctx.stage);

      // onBounds：注册即补发一次，跟随容器自适应
      boundOnBounds = function (b) {
        applySize(b.w, b.h);
        if (typeof UI.relayout === 'function') UI.relayout(b.w, b.h);
      };
      ctx.onBounds(boundOnBounds);

      // 双输入：触屏 pointerdown + 键盘方向/确认
      boundPointerDown = onPointerDown;
      boundPointerMove = onPointerMove;
      boundKeyDown = onKeyDown;
      canvas.addEventListener('pointerdown', boundPointerDown);
      canvas.addEventListener('pointermove', boundPointerMove);
      window.addEventListener('keydown', boundKeyDown);

      raf = requestAnimationFrame(loop);
    },

    destroy: function () {
      // 1) 停 RAF（句柄在闭包级，destroy 可达）
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      // 2) 解绑监听
      if (boundPointerDown && canvas) canvas.removeEventListener('pointerdown', boundPointerDown);
      if (boundPointerMove && canvas) canvas.removeEventListener('pointermove', boundPointerMove);
      if (boundKeyDown) window.removeEventListener('keydown', boundKeyDown);
      boundPointerDown = null;
      boundPointerMove = null;
      boundKeyDown = null;
      boundOnBounds = null;
      // 3) 清 UI 覆盖层（内部解绑 UI 自身 window 监听）
      if (typeof UI.destroy === 'function') UI.destroy();
      // 4) 清 DOM（canvas）
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx2d = null;
      started = false;
    }
  });
})();
