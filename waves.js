/* Engraved wave clouds framing the page. Drawn live in WebGL; the lines ripple and bend away from the cursor. */
(() => {
  const me = document.currentScript;
  const COL = parseFloat((me && me.dataset.col) || '370');
  const cvs = document.createElement('canvas'); cvs.id = 'waves'; cvs.setAttribute('aria-hidden', 'true');
  document.body.prepend(cvs);
  const gl = cvs.getContext('webgl', { premultipliedAlpha: false, antialias: false });
  if (!gl) { cvs.remove(); return; }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vs = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
  const fs = `
  precision highp float;
  uniform vec2 uView; uniform float uDpr, uScroll, uDocH, uTime, uEnergy;
  uniform vec2 uMouse; uniform vec4 uRip[8]; uniform float uCol;
  float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p, int oct){ float a=.5, s=0., t=0.;
    for(int i=0;i<6;i++){ if(i>=oct) break; s+=a*noise(p); t+=a; p=p*2.03+vec2(1.7,9.2); a*=.55; } return s/t; }
  float W; float bandH; float sideW;
  float baseFrame(vec2 q){
    float side = sideW > 0. ? max(clamp(1.-q.x/sideW,0.,1.), clamp(1.-(W-q.x)/sideW,0.,1.)) : 0.;
    float band = max(clamp(1.-q.y/bandH,0.,1.), clamp(1.-(uDocH-q.y)/bandH,0.,1.))*.95;
    return max(side, band);
  }
  float frameAt(vec2 q){ return clamp(baseFrame(q) + (fbm(q/480.+17., 3)-.5)*.55, 0., 1.); }
  float hLo(vec2 q){ float d = fbm(q/288., 3); float c = clamp(((d*.9+frameAt(q)*.85)-.82)*4., 0., 1.); return d*.6 + c*.8; }
  void main(){
    W = uView.x; sideW = W < 700. ? 0. : min(.2*W, 290.); bandH = W < 700. ? 230. : 270.;
    vec2 q = vec2(gl_FragCoord.x/uDpr, uView.y - gl_FragCoord.y/uDpr + uScroll);

    // keep the reading column clear
    float halfCol = min(uCol, W*.5 - 8.);
    vec2 dRect = vec2(abs(q.x - W*.5) - halfCol, max(200. - q.y, q.y - (uDocH - 200.)));
    float clearAmt = 1. - smoothstep(-36., 0., max(dRect.x, dRect.y));
    if (clearAmt > .999 && baseFrame(q) <= 0.) { gl_FragColor = vec4(0.); return; }

    // cursor: lines bend away from it, and expanding ripples trail behind it
    vec2 disp = vec2(0.); float dphase = 0.;
    vec2 dm = q - uMouse; float md = length(dm);
    float near = exp(-md*md/(150.*150.)) * uEnergy;
    disp += (md > .5 ? dm/md : vec2(0.)) * near * 44.;
    dphase += near * 4.;
    for (int i=0;i<8;i++){
      vec4 r = uRip[i]; if (r.w <= 0.) continue;
      float age = uTime - r.z; if (age < 0. || age > 2.6) continue;
      vec2 dv = q - r.xy; float d = length(dv);
      float ring = exp(-pow((d - age*230.)/46., 2.)) * exp(-age*1.6) * r.w;
      disp += (d > .5 ? dv/d : vec2(0.)) * ring * 26.;
      dphase += ring * 5.;
    }
    vec2 p = q - disp;

    float dens = fbm(p/288., 6);
    float fr = frameAt(p);
    float cloud = clamp(((dens*.9 + fr*.85) - .82)*4., 0., 1.);
    float alpha = clamp((cloud - .05)/.25, 0., 1.) * (1. - clearAmt);
    if (alpha <= 0.) { gl_FragColor = vec4(0.); return; }

    float e = 7.;
    float gx = (hLo(p+vec2(e,0.)) - hLo(p-vec2(e,0.)))/(2.*e);
    float gy = (hLo(p+vec2(0.,e)) - hLo(p-vec2(0.,e)))/(2.*e);
    float light = clamp(.55 + (-gx*.9 - gy*1.4)*90., 0., 1.);
    float shade = clamp(light*.75 + (1.-cloud)*.35, 0., 1.);

    vec3 gold=vec3(247.,210.,140.)/255., cream=vec3(240.,226.,196.)/255.;
    vec3 slate=vec3(96.,112.,118.)/255., deep=vec3(58.,72.,80.)/255.;
    vec3 col = shade > .55 ? mix(cream, gold, (shade-.55)/.45) : mix(slate, cream, shade/.55);

    float flow = fbm(p/360. + vec2(uTime*.012, uTime*.007) + 5., 4);
    float h = dens*.6 + cloud*.8;
    float phase = p.y*.42 + p.x*.06 + flow*38. + h*55. + dphase - uTime*.35;
    float lines = .5 + .5*sin(phase);
    float dark = 1. - shade;
    float th = .12 + dark*.62;
    float ink = 1. - smoothstep(th - .07, th + .07, lines);
    ink = clamp(ink*.85 + step(hash(floor(q)), dark*.1)*.6, 0., 1.);
    col = mix(col, deep, ink*.78);
    gl_FragColor = vec4(col, alpha);
  }`;
  function sh(type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn(e); cvs.remove(); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const U = n => gl.getUniformLocation(prog, n);
  const uView=U('uView'), uDpr=U('uDpr'), uScroll=U('uScroll'), uDocH=U('uDocH'), uTime=U('uTime'),
        uEnergy=U('uEnergy'), uMouse=U('uMouse'), uRip=U('uRip'), uCol=U('uCol');

  /* ---- Pacing: draw only as often as the eye can tell, and only as sharply as the machine can afford ----
     · Idle (no cursor, no scroll): the slow drift is redrawn ~12×/s instead of 60×/s, which looks the same.
     · Cursor, ripples or scrolling: full frame rate, exactly as before.
     · Slow graphics: the canvas is drawn at a lower resolution; on very slow machines the waves hold still
       and redraw only when you scroll, like the reduced-motion version. */
  const SCALES = [1.5, 1.25, 1, .75, .5].filter(s => s <= Math.max(.5, Math.min(window.devicePixelRatio || 1, 1.5)));
  let si = 0, dpr = SCALES[0], vw = 0, vh = 0, docH = 0;
  function resize(){
    vw = window.innerWidth; vh = window.innerHeight; docH = document.documentElement.scrollHeight;
    cvs.width = Math.round(vw*dpr); cvs.height = Math.round(vh*dpr);
    gl.viewport(0, 0, cvs.width, cvs.height);
  }
  resize();

  const rip = new Float32Array(32); let ri = 0;
  let mx = -9999, my = -9999, lastX = 0, lastY = 0, lastRip = 0, energy = 0, target = 0;
  const t0 = performance.now(); const now = () => (performance.now() - t0)/1000;
  let frozenT = 0, activeUntil = 0;

  function draw(t){
    target *= .92; energy += (target - energy)*.15;
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uView, vw, vh); gl.uniform1f(uDpr, dpr); gl.uniform1f(uScroll, scrollY);
    gl.uniform1f(uDocH, docH); gl.uniform1f(uTime, t); gl.uniform1f(uEnergy, energy);
    gl.uniform2f(uMouse, mx, my); gl.uniform4fv(uRip, rip); gl.uniform1f(uCol, COL);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Measure how long one full-screen draw takes here, at the cheapest resolution, then pick the
  // sharpest resolution that fits in a frame (~12 ms). Reading one pixel waits for the GPU to finish;
  // the cost of that wait alone is measured too and subtracted, so fast machines aren't underestimated.
  const px = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  function timeDraw(){ const a = performance.now(); draw(still ? 0 : now()); sync(); return performance.now() - a; }
  function timeEmpty(){ const a = performance.now(); gl.clear(gl.COLOR_BUFFER_BIT); sync(); return performance.now() - a; }
  function calibrate(){
    dpr = SCALES[SCALES.length - 1]; resize();
    timeDraw();                                  // warm-up (shader compile)
    const ms = Math.max(0, Math.min(timeDraw(), timeDraw()) - Math.min(timeEmpty(), timeEmpty()));
    const perPx = ms / (cvs.width*cvs.height);
    si = SCALES.findIndex(s => perPx * vw*vh*s*s <= 12);
    const slow = si < 0 && ms > 14;              // too slow to animate smoothly even at the lowest resolution
    if (si < 0) si = SCALES.length - 1;
    dpr = SCALES[si]; resize();
    return slow;
  }
  let mode = (calibrate() || still) ? 'still' : 'anim';

  let pending = false;
  const requestDraw = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; draw(frozenT); }); };
  addEventListener('resize', () => { resize(); if (mode === 'still') requestDraw(); });
  new ResizeObserver(() => { docH = document.documentElement.scrollHeight; if (mode === 'still') requestDraw(); }).observe(document.body);
  addEventListener('scroll', () => { if (mode === 'still') requestDraw(); else activeUntil = performance.now() + 300; }, { passive: true });

  if (!still) addEventListener('pointermove', e => {
    if (mode !== 'anim') return;
    const x = e.clientX, y = e.clientY + scrollY;
    const sp = Math.hypot(x - lastX, y - lastY);
    mx = x; my = y; target = Math.min(1, target + sp/35);
    const t = now();
    if (sp > 0 && (Math.hypot(x - rip[((ri+7)%8)*4], y - rip[((ri+7)%8)*4+1]) > 55) && t - lastRip > .07) {
      rip.set([x, y, t, Math.min(1, .35 + sp/40)], ri*4); ri = (ri+1) % 8; lastRip = t;
    }
    lastX = x; lastY = y; activeUntil = performance.now() + 150;
  }, { passive: true });

  function busy(t){
    if (energy > .004 || target > .004 || performance.now() < activeUntil) return true;
    for (let i = 0; i < 8; i++) if (rip[i*4+3] > 0 && t - rip[i*4+2] < 2.6) return true;
    return false;
  }

  // While animating at full speed, watch the real frame rate; if it sags below ~30 fps, step the resolution
  // down, and if it is already at the lowest, let the waves hold still.
  let lastDraw = -1e9, prevFast = 0; const gaps = [];
  function goStill(){ mode = 'still'; cvs.dataset.quality = 'still @' + dpr; frozenT = now(); mx = my = -9999; energy = target = 0; rip.fill(0); requestDraw(); }
  function loop(ts){
    if (mode !== 'anim') return;
    requestAnimationFrame(loop);
    const t = now(), fast = busy(t);
    if (!fast && ts - lastDraw < 83) return;      // idle: ~12 fps
    if (fast && prevFast && ts - prevFast < 250) {
      gaps.push(ts - prevFast);
      if (gaps.length >= 24) {
        const med = gaps.sort((a, b) => a - b)[12]; gaps.length = 0;
        if (med > 34) { if (si < SCALES.length - 1) { dpr = SCALES[++si]; resize(); cvs.dataset.quality = 'anim @' + dpr; } else return goStill(); }
      }
    }
    prevFast = fast ? ts : 0;
    draw(t); lastDraw = ts;
  }
  cvs.dataset.quality = mode + ' @' + dpr;     // handy for checking in dev tools
  if (mode === 'anim') requestAnimationFrame(loop);
  else {
    requestDraw();
    // The first check ran while the page was still loading; if it called this machine slow, look again once things settle.
    if (!still) {
      const recheck = () => setTimeout(() => { if (!calibrate()) { mode = 'anim'; cvs.dataset.quality = 'anim @' + dpr; requestAnimationFrame(loop); } else requestDraw(); }, 2500);
      document.readyState === 'complete' ? recheck() : addEventListener('load', recheck, { once: true });
    }
  }
})();
