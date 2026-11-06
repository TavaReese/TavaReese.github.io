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

  let dpr = 1, vw = 0, vh = 0, docH = 0;
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    vw = window.innerWidth; vh = window.innerHeight; docH = document.documentElement.scrollHeight;
    cvs.width = Math.round(vw*dpr); cvs.height = Math.round(vh*dpr);
    gl.viewport(0, 0, cvs.width, cvs.height);
  }
  addEventListener('resize', resize); resize();
  new ResizeObserver(() => { docH = document.documentElement.scrollHeight; }).observe(document.body);

  const rip = new Float32Array(32); let ri = 0;
  let mx = -9999, my = -9999, lastX = 0, lastY = 0, lastRip = 0, energy = 0, target = 0;
  const t0 = performance.now(); const now = () => (performance.now() - t0)/1000;
  if (!still) addEventListener('pointermove', e => {
    const x = e.clientX, y = e.clientY + scrollY;
    const sp = Math.hypot(x - lastX, y - lastY);
    mx = x; my = y; target = Math.min(1, target + sp/35);
    const t = now();
    if (sp > 0 && (Math.hypot(x - rip[((ri+7)%8)*4], y - rip[((ri+7)%8)*4+1]) > 55) && t - lastRip > .07) {
      rip.set([x, y, t, Math.min(1, .35 + sp/40)], ri*4); ri = (ri+1) % 8; lastRip = t;
    }
    lastX = x; lastY = y;
  }, { passive: true });

  function frame(){
    const t = still ? 0 : now();
    target *= .92; energy += (target - energy)*.15;
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uView, vw, vh); gl.uniform1f(uDpr, dpr); gl.uniform1f(uScroll, scrollY);
    gl.uniform1f(uDocH, docH); gl.uniform1f(uTime, t); gl.uniform1f(uEnergy, energy);
    gl.uniform2f(uMouse, mx, my); gl.uniform4fv(uRip, rip); gl.uniform1f(uCol, COL);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!still) requestAnimationFrame(frame);
  }
  if (still) { addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true }); addEventListener('resize', () => requestAnimationFrame(frame)); }
  requestAnimationFrame(frame);
})();

