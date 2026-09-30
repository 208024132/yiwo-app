/* ============================================================
   以我APP · 轻量 Canvas 图表（折线 / 柱状 / 环形）
   用法：Charts.line(el, labels, values, {color}) 等，自动适配 DPR
   ============================================================ */
window.Charts = (() => {
  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(rect.width, 140);
    const h = canvas.dataset.h ? Number(canvas.dataset.h) : 180;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function line(canvas, labels, values, opts = {}) {
    const { ctx, w, h } = setup(canvas);
    const color = opts.color || cssVar("--primary");
    ctx.clearRect(0, 0, w, h);
    if (!values.length) return;
    const padL = 6, padR = 6, padT = 14, padB = 22;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const n = values.length;
    const px = i => padL + (w - padL - padR) * (n === 1 ? 0.5 : i / (n - 1));
    const py = v => padT + (h - padT - padB) * (1 - (v - min) / range);

    // 面积渐变
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, color + "33");
    grad.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.moveTo(px(0), py(values[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(px(i), py(values[i]));
    ctx.lineTo(px(n - 1), h - padB);
    ctx.lineTo(px(0), h - padB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 折线
    ctx.beginPath();
    ctx.moveTo(px(0), py(values[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(px(i), py(values[i]));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // 端点
    const last = { x: px(n - 1), y: py(values[n - 1]) };
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // 横轴标签（最多 7 个）
    const textColor = cssVar("--text-3") || "#999";
    ctx.fillStyle = textColor;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    const step = Math.ceil(n / 6);
    for (let i = 0; i < n; i += step) {
      ctx.fillText(String(labels[i]), px(i), h - 6);
    }
    if ((n - 1) % step !== 0) ctx.fillText(String(labels[n - 1]), px(n - 1), h - 6);
  }

  function bars(canvas, labels, values, opts = {}) {
    const { ctx, w, h } = setup(canvas);
    const color = opts.color || cssVar("--primary");
    ctx.clearRect(0, 0, w, h);
    if (!values.length) return;
    const padT = 14, padB = 22;
    const max = Math.max(...values, 1);
    const n = values.length;
    const slot = (w - 10) / n;
    const bw = Math.min(slot * 0.62, 34);
    values.forEach((v, i) => {
      const bh = (h - padT - padB) * (v / max);
      const x = 5 + slot * i + (slot - bw) / 2;
      const y = h - padB - bh;
      const r = Math.min(bw / 2, 7);
      ctx.beginPath();
      ctx.roundRect(x, y, bw, Math.max(bh, v > 0 ? 4 : 0), [r, r, Math.min(r, 2), Math.min(r, 2)]);
      ctx.fillStyle = i === n - 1 ? color : color + (opts.dimOthers === false ? "" : "59");
      ctx.fill();
    });
    const textColor = cssVar("--text-3") || "#999";
    ctx.fillStyle = textColor;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    values.forEach((v, i) => {
      ctx.fillText(String(labels[i]), 5 + slot * i + slot / 2, h - 6);
    });
  }

  function donut(canvas, items, opts = {}) {
    const { ctx, w, h } = setup(canvas);
    ctx.clearRect(0, 0, w, h);
    if (!items.length) return;
    const total = items.reduce((s, it) => s + it.value, 0) || 1;
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) / 2 - 10;
    const r = R * 0.62;
    let angle = -Math.PI / 2;
    items.forEach(it => {
      const sweep = (it.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, angle, angle + sweep);
      ctx.arc(cx, cy, r, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = it.color;
      ctx.fill();
      angle += sweep;
    });
    ctx.fillStyle = cssVar("--text") || "#333";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(total), cx, cy + 2);
    ctx.fillStyle = cssVar("--text-3") || "#999";
    ctx.font = "11px sans-serif";
    ctx.fillText(opts.centerLabel || "总计", cx, cy + 20);
  }

  return { line, bars, donut };
})();