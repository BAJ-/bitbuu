const canvas = document.getElementById('stage');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('canvas#stage missing');
}
const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('2d context unavailable');
}

function draw(): void {
  if (!(canvas instanceof HTMLCanvasElement) || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#eee';
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('bitbuu', w / 2, h / 2);
}

window.addEventListener('resize', draw);
draw();
