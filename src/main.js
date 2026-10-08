// src/main.js —— 入口：创建画布、装配模块、Work.register 容器合同
// 职责：唯一在此注册容器；mount 建 canvas 并挂入 ctx.stage；destroy 停 RAF、解绑监听、清 DOM。

// 修复 load 错误（Work.register is not a function）：
// 不再用 `var Work = Work || {}` 自建空对象覆盖平台注入的全局 Work，
// 而是显式取全局（window/globalThis）上的 Work；若平台以其他形式提供注册函数，
// 也做兼容桥接，保证 mount/destroy 合同一定注册成功。
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : window;

  var host;
  if (typeof Work === 'object' && Work !== null && typeof Work.register === 'function') {
    host = Work; // 平台已注入 Work.register
  } else {
    host = g.Work = (typeof g.Work === 'object' && g.Work !== null) ? g.Work : {};
    if (typeof host.register !== 'function') {
      if (typeof g.register === 'function') {
        // 平台提供顶层 register 时桥接
        host.register = function (def) { g.register(def); };
      } else {
        // 兜底：记录定义，避免 load 阶段抛错
        host.register = function (def) { host.__definition = def; };
      }
    }
  }

  host.register({
    mount: function (ctx) {
      // ctx: 平台容器对象，含 bounds{w,h} / stage / onBounds
      var rafId = 0;
      var running = true;
      var canvas = document.createElement('canvas');
      var g2d = canvas.getContext('2d');

      var boundPointerDown = null;
      var boundPointerMove = null;
      var boundKeyDown = null;

      // 键盘光标（列/行），与触屏并存，满足双输入合同
      var cursor = { col: 7, row: 7 };

      function clampCursor() {
        var n = Engine.getSize();
        if (cursor.col < 0) cursor.col = 0;
        if (cursor.row < 0) cursor.row = 0;
        if (cursor.col > n - 1) cursor.col = n - 1;
        if (cursor.row > n - 1) cursor.row = n - 1;
      }

      function handleBounds(b) {
        canvas.width = b.w;
        canvas.height = b.h;
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        Engine.layout(b.w, b.h);
      }

      function frame(ts) {
        if (!running) return;
        Engine.update(ts);
        UI.render(g2d, canvas.width, canvas.height);
        rafId = requestAnimationFrame(frame);
      }

      function cellFromEvent(e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        return UI.pickCell(x, y); // {x,y} 格子坐标
      }

      function onPointerDown(e) {
        e.preventDefault();
        UI.markStarted();
        var cell = cellFromEvent(e);
        if (cell) {
          cursor.col = cell.x;
          cursor.row = cell.y;
          Engine.place(cell.x, cell.y);
        }
      }

      function onPointerMove() {
        // 悬停高亮可选，当前无 hover 合同，保留触屏 pointerdown 即可
      }

      var KEYMAP = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, -1], ArrowDown: [0, 1],
        KeyA: [-1, 0], KeyD: [1, 0],
        KeyW: [0, -1], KeyS: [0, 1]
      };

      function onKeyDown(e) {
        var d = KEYMAP[e.code];
        if (d) {
          e.preventDefault();
          cursor.col += d[0];
          cursor.row += d[1];
          clampCursor();
        } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
          e.preventDefault();
          UI.markStarted();
          Engine.place(cursor.col, cursor.row);
        }
      }

      function init() {
        canvas.width = ctx.bounds.w;
        canvas.height = ctx.bounds.h;
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.touchAction = 'none';
        ctx.stage.appendChild(canvas);

        Engine.init();
        UI.init(ctx.stage);
        Engine.layout(ctx.bounds.w, ctx.bounds.h);
        ctx.onBounds(handleBounds);

        bindInput();

        rafId = requestAnimationFrame(frame);
      }

      function bindInput() {
        boundPointerDown = onPointerDown;
        boundPointerMove = onPointerMove;
        boundKeyDown = onKeyDown;
        canvas.addEventListener('pointerdown', boundPointerDown);
        canvas.addEventListener('pointermove', boundPointerMove);
        window.addEventListener('keydown', boundKeyDown);
      }

      function unbindInput() {
        if (boundPointerDown) canvas.removeEventListener('pointerdown', boundPointerDown);
        if (boundPointerMove) canvas.removeEventListener('pointermove', boundPointerMove);
        if (boundKeyDown) window.removeEventListener('keydown', boundKeyDown);
        boundPointerDown = null;
        boundPointerMove = null;
        boundKeyDown = null;
      }

      init();

      // 暴露给 destroy 的清理钩子
      var self = this;
      self._destroy = function () {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        unbindInput();
        UI.destroy();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      };
    },

    destroy: function () {
      if (this._destroy) this._destroy();
      this._destroy = null;
    }
  });
})();
