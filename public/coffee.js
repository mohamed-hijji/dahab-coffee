(() => {
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const story = document.querySelector(".story");
  const stage = story.querySelector(".stage");
  const canvas = stage.querySelector("canvas");
  const number = stage.querySelector(".shot-number");
  const chapters = [...story.querySelectorAll(".chapter")];
  const mobile = matchMedia("(pointer: coarse)").matches || Math.min(innerWidth, innerHeight) <= 650;
  const copies = chapters.map(chapter => chapter.querySelector(".chapter-copy"));
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
  if (!gl) return;
  const maxRenderSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);

  const vertex = [
    "attribute vec3 aPoint; attribute vec3 aNormal; attribute vec2 aUv;",
    "uniform vec3 uObject, uTurn, uShift, uCamera; uniform float uScale, uAspect; uniform mediump float uMaterial;",
    "varying vec3 vPoint, vNormal; varying vec2 vUv;",
    "vec3 turn(vec3 p, vec3 r) {",
    "  float cx=cos(r.x), sx=sin(r.x), cy=cos(r.y), sy=sin(r.y), cz=cos(r.z), sz=sin(r.z);",
    "  p=vec3(p.x*cy+p.z*sy,p.y,p.z*cy-p.x*sy);",
    "  p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);",
    "  return vec3(p.x*cz-p.y*sz,p.x*sz+p.y*cz,p.z);",
    "}",
    "void main(){",
    "  vec3 point=aPoint; if(uMaterial==2.0) point.xz*=mix(0.91,1.0,clamp((uObject.y-0.26)/0.305,0.0,1.0)); vPoint=turn(turn(point,uTurn)+uObject,uCamera)*uScale+uShift;",
    "  vNormal=normalize(turn(turn(aNormal,uTurn),uCamera)); vUv=aUv;",
    "  float d=5.8-vPoint.z;",
    "  gl_Position=vec4(vPoint.x*3.15/uAspect,vPoint.y*3.15,1.006*d-0.40,d);",
    "}"
  ].join("\n");

  const fragment = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec3 uColor; uniform mediump float uMaterial; uniform float uFlow, uArtProgress; uniform sampler2D uLabel, uArt;",
    "varying vec3 vPoint, vNormal; varying vec2 vUv;",
    "float noise(vec2 p){",
    "  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);",
    "  vec4 n=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1,1),vec2(127.1,311.7))))*4375.3);",
    "  return mix(mix(n.x,n.y,f.x),mix(n.z,n.w,f.x),f.y);",
    "}",
    "void main(){",
    "  vec3 n=normalize(vNormal), view=normalize(vec3(0,0,5.8)-vPoint);",
    "  vec3 key=normalize(vec3(-0.8,0.85,1.15)), edge=normalize(vec3(0.95,0.45,-0.35));",
    "  vec3 fill=normalize(vec3(0.7,0.1,0.9));",
    "  float diffuse=max(dot(n,key),0.0), rim=max(dot(n,edge),0.0);",
    "  float reflection=pow(max(dot(n,normalize(key+view)),0.0),46.0);",
    "  float softbox=pow(max(dot(n,normalize(vec3(-0.95,0.2,1.4)+view)),0.0),13.0);",
    "  float facing=pow(1.0-abs(dot(n,view)),3.0);",
    "  vec3 base=uColor; float gloss=0.48;",
    "  if (uMaterial == 1.0){",
    "    float paper=0.5;",
    "    base *= 0.975+paper*0.05;",
    "    vec4 label=texture2D(uLabel,vUv); base=mix(base,label.rgb,label.a); gloss=0.24;",
    "  }",
    "  if (uMaterial == 2.0){",
    "    vec2 p=(vUv-0.5)*2.0; float r=length(p), angle=atan(p.y,p.x);",
    "    float crema=noise(p*5.0)*0.65+noise(p*17.0)*0.25+noise(p*48.0)*0.10;",
    "    base=mix(vec3(0.35,0.14,0.046),vec3(0.78,0.46,0.19),crema);",
    "    vec2 drift=vec2(noise(p*8.0+vec2(1.8,0.0))-0.5,noise(p*9.0+vec2(0.0,3.7))-0.5);",
    "    vec2 milkUv=vUv+drift*0.015;",
    "    float milk=texture2D(uArt,milkUv).a*0.40;",
    "    milk+=texture2D(uArt,milkUv+vec2(0.006,0.0)).a*0.15;",
    "    milk+=texture2D(uArt,milkUv-vec2(0.006,0.0)).a*0.15;",
    "    milk+=texture2D(uArt,milkUv+vec2(0.0,0.006)).a*0.15;",
    "    milk+=texture2D(uArt,milkUv-vec2(0.0,0.006)).a*0.15;",
    "    float front=890.0-uArtProgress*810.0;",
    "    milk*=uArtProgress*smoothstep(front-135.0,front+135.0,vUv.y*1024.0);",
    "    float wisps=noise(p*19.0+drift*2.0);",
    "    float foamGrain=noise(p*110.0);",
    "    float edgeBlend=mix(0.66+wisps*0.19,0.88,smoothstep(0.25,0.80,milk));",
    "    vec3 steamedMilk=mix(vec3(0.78,0.64,0.43),vec3(0.97,0.91,0.76),0.54+wisps*0.31+foamGrain*0.06);",
    "    base=mix(base,steamedMilk,milk*edgeBlend);",
    "    base=mix(base,vec3(0.48,0.25,0.085),smoothstep(0.88,0.99,r)); gloss=0.34;",
    "  }",
    "  if (uMaterial == 3.0){",
    "    base *= 0.8+0.2*sin(vUv.y*34.0-uFlow*3.5); gloss=0.55;",
    "  }",
    "  float bounce=max(dot(n,fill),0.0);",
    "  vec3 color=base*(0.35+diffuse*0.82+bounce*0.16+rim*0.22);",
    "  if(uMaterial==1.0) color=base*(0.44+diffuse*0.68+bounce*0.13+rim*0.17);",
    "  color+=vec3(1.0,0.93,0.80)*(reflection*gloss+softbox*gloss*0.52);",
    "  color+=vec3(1.0,0.73,0.36)*facing*rim*0.32;",
    "  gl_FragColor=vec4(color,1.0);",
    "}"
  ].join("\n");

  function shader(type, source) {
    const handle = gl.createShader(type);
    gl.shaderSource(handle, source);
    gl.compileShader(handle);
    if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(handle));
    return handle;
  }

  const program = gl.createProgram();
  try {
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.warn("ScÃ¨ne Dahab", error);
    return;
  }
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);

  const uniform = Object.fromEntries(
    ["Object", "Turn", "Shift", "Camera", "Scale", "Aspect", "Color", "Material", "Flow", "Label", "Art", "ArtProgress"]
      .map((name) => [name, gl.getUniformLocation(program, "u" + name)])
  );
  const attributes = ["aPoint", "aNormal", "aUv"].map((name, index) => ({
    index: gl.getAttribLocation(program, name), size: index === 2 ? 2 : 3, offset: index * 12
  }));
  attributes.forEach(({ index }) => gl.enableVertexAttribArray(index));

  const label = document.createElement("canvas");
  label.width = 4096;
  label.height = 1024;
  const ink = label.getContext("2d");
  const logo = new Image();

  function drawLabel() {
    ink.setTransform(1, 0, 0, 1, 0, 0);
    ink.clearRect(0, 0, label.width, label.height);
    ink.scale(2, 2);
    ink.imageSmoothingEnabled = true;
    ink.imageSmoothingQuality = "high";
    for (let index = 0; index < 34; index++) {
      const row = Math.floor(index / 17);
      const x = (index % 17) * 120 + (row ? 56 : 5);
      const y = 429 + row * 79 + Math.sin(index * 1.9) * 13;
      ink.save();
      ink.translate(x, y);
      ink.rotate(Math.sin(index * 2.1) * 0.65 + 0.23);
      ink.fillStyle = index % 3 === 0 ? "#b28c53" : "#927143";
      ink.beginPath();
      ink.ellipse(0, 0, 28, 47, 0, 0, Math.PI * 2);
      ink.fill();
      ink.beginPath();
      ink.moveTo(1, -43);
      ink.bezierCurveTo(-16, -18, 17, 12, -3, 43);
      ink.strokeStyle = "#f3e7cd";
      ink.lineWidth = 5;
      ink.stroke();
      ink.restore();
    }
    if (logo.complete && logo.naturalWidth) ink.drawImage(logo, 785, 136, 478, 240);
  }
  drawLabel();

  gl.activeTexture(gl.TEXTURE0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  function uploadLabel() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, label);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  uploadLabel();
  const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
  if (anisotropy) {
    gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
  logo.addEventListener("load", () => {
    if (contextLost) return;
    drawLabel();
    uploadLabel();
    schedule();
  });
  logo.src = "assets/dahab-logo.png";
  gl.uniform1i(uniform.Label, 0);

  const artwork = document.createElement("canvas");
  artwork.width = 1024;
  artwork.height = 1024;
  const milkInk = artwork.getContext("2d");
  const artTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, artTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(uniform.Art, 1);
  // Upload the artwork once; its reveal runs on the GPU while scrolling.
  function paintArt() {
    milkInk.setTransform(1, 0, 0, 1, 0, 0);
    milkInk.clearRect(0, 0, 1024, 1024);
    milkInk.setTransform(-1, 0, 0, -1, 1024, 1024);
    const heart = new Path2D();
    heart.moveTo(512, 800);
    heart.bezierCurveTo(460, 744, 236, 587, 239, 406);
    heart.bezierCurveTo(242, 245, 421, 224, 512, 355);
    heart.bezierCurveTo(603, 224, 782, 245, 785, 406);
    heart.bezierCurveTo(788, 587, 564, 744, 512, 800);
    const milk = milkInk.createRadialGradient(477, 415, 15, 512, 525, 365);
    milk.addColorStop(0, "#fff4db");
    milk.addColorStop(0.72, "#f7e7c5");
    milk.addColorStop(1, "#d8b983");
    milkInk.globalAlpha = 0.87;
    milkInk.fillStyle = milk;
    milkInk.shadowColor = "#ebd4a8";
    milkInk.shadowBlur = 17;
    milkInk.fill(heart);
    milkInk.shadowBlur = 0;

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, artTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artwork);
    gl.activeTexture(gl.TEXTURE0);
  }
  paintArt();

  const zero = [0, 0, 0];
  const circle = Math.PI * 2;
  const cupSegments = mobile ? 128 : 256;
  function mesh(data, color, material = 0) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, size: data.length / 8, color, material };
  }

  function lathe(profile, color, material = 0, disk = false) {
    const data = [];
    const tangents = profile.slice(1).map(([radius, height], index) => {
      const dr = radius - profile[index][0];
      const dy = height - profile[index][1];
      const length = Math.hypot(dr, dy);
      return [dy / length, -dr / length];
    });
    function normalAt(ring, row) {
      const [x, y] = tangents[ring];
      const neighbor = tangents[row === ring ? ring - 1 : ring + 1];
      if (!neighbor || x * neighbor[0] + y * neighbor[1] < 0.57) return [x, y];
      const nx = x + neighbor[0];
      const ny = y + neighbor[1];
      const length = Math.hypot(nx, ny);
      return [nx / length, ny / length];
    }
    for (let ring = 0; ring < profile.length - 1; ring++) {
      const normals = [normalAt(ring, ring), normalAt(ring, ring + 1)];
      function point(row, slice) {
        const [radius, y] = profile[row];
        const u = slice / cupSegments;
        const angle = (u - 0.5) * circle;
        const sine = Math.sin(angle);
        const cosine = Math.cos(angle);
        const x = radius * sine;
        const z = radius * cosine;
        const uv = disk ? [0.5 + x / 1.24, 0.5 + z / 1.24] : [u, (y + 0.92) / 1.57];
        const [radial, vertical] = normals[row - ring];
        return [x, y, z, radial * sine, vertical, radial * cosine, ...uv];
      }
      for (let slice = 0; slice < cupSegments; slice++) {
        const a = point(ring, slice);
        const b = point(ring, slice + 1);
        const c = point(ring + 1, slice + 1);
        const d = point(ring + 1, slice);
        data.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
    return mesh(data, color, material);
  }

  const cup = lathe([[0,-0.92],[0.42,-0.92],[0.438,-0.913],[0.449,-0.9],[0.455,-0.875],[0.46,-0.82],[0.645,0.57],[0.653,0.615]], [0.86,0.78,0.64], 1);
  const rim = lathe([[0.645,0.565],[0.661,0.577],[0.672,0.593],[0.673,0.617],[0.665,0.633],[0.650,0.643],[0.633,0.643],[0.620,0.635],[0.613,0.622],[0.612,0.56]], [0.60,0.43,0.27]);
  const inside = lathe([[0.619,0.618],[0.545,0.17],[0.428,-0.84],[0,-0.84]], [0.46,0.31,0.17]);
  const liquid = lathe([[0.609,0],[0.595,0.007],[0,0.007]], [0.5,0.25,0.08], 2, true);
  const lid = lathe([[0,-0.08],[0.65,-0.08],[0.68,-0.064],[0.685,-0.018],[0.668,0.005],[0.67,0.026],[0.626,0.05],[0.591,0.05],[0.567,0.138],[0.527,0.162],[0.49,0.165],[0.46,0.139],[0,0.139]], [0.23,0.13,0.066]);
  const drop = lathe([[0,-0.086],[0.022,-0.08],[0.035,-0.061],[0.039,-0.035],[0.035,-0.005],[0.027,0.033],[0.015,0.074],[0.006,0.108],[0,0.135]], [0.28,0.095,0.027], 3);

  function pourMesh() {
    const data = [];
    const segments = mobile ? 24 : 48;
    function point(row, column) {
      const t = row / segments;
      const angle = column / segments * circle;
      const radius = (0.042 + t * 0.021) * (0.98 + Math.sin(t * 28) * 0.02);
      const x = 0.95 * t * t + 0.14 * t;
      return [x + Math.cos(angle) * radius, t * 2.5, Math.sin(angle) * radius,
        Math.cos(angle), -t * 0.6 * Math.cos(angle), Math.sin(angle), column / segments, t];
    }
    for (let row = 0; row < segments; row++) {
      for (let column = 0; column < segments; column++) {
        const a = point(row,column), b = point(row,column+1);
        const c = point(row+1,column+1), d = point(row+1,column);
        data.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
    return mesh(data, [0.24,0.08,0.027], 3);
  }
  const pour = pourMesh();

  function draw(object, position = zero, rotation = zero) {
    gl.bindBuffer(gl.ARRAY_BUFFER, object.buffer);
    for (const { index, size, offset } of attributes) gl.vertexAttribPointer(index, size, gl.FLOAT, false, 32, offset);
    gl.uniform3fv(uniform.Object, position);
    gl.uniform3fv(uniform.Turn, rotation);
    gl.uniform3fv(uniform.Color, object.color);
    gl.uniform1f(uniform.Material, object.material);
    gl.drawArrays(gl.TRIANGLES, 0, object.size);
  }

  const clamp = (value) => Math.max(0, Math.min(1, value));
  const mix = (a, b, t) => a + (b - a) * t;
  function ease(t) {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  }

  let frame = 0;
  let contextLost = false;
  function update() {
    frame = 0;
    if (preference.matches) return;
    const bounds = story.getBoundingClientRect();
    const viewport = stage.clientHeight;
    if (bounds.top > viewport || bounds.bottom < 0 || !viewport) return;
    const p = clamp(-bounds.top / Math.max(1, bounds.height - viewport));
    const reveal = ease(p / 0.47);
    const zoom = ease((p - 0.48) / 0.51);
    const night = ease((p - 0.19) / 0.33);
    const fill = mix(0.26, 0.565, ease((p - 0.29) / 0.42));
    const chapterBounds = chapters.map(chapter => chapter.getBoundingClientRect());
    stage.style.setProperty("--night", night);
    stage.style.setProperty("--word-opacity", 1 - ease(p / 0.65));
    stage.style.setProperty("--progress", p);
    stage.style.setProperty("--footer-offset", 22 + Math.max(0, bounds.top) + "px");
    stage.style.setProperty("--scene-ink", night > 0.47 ? "#f0d7ae" : "#351e0d");
    number.textContent = p < 0.24 ? "01" : p < 0.73 ? "02" : "03";
    for (const [index, chapter] of chapters.entries()) {
      const box = chapterBounds[index];
      const travel = (box.top + box.height / 2 - viewport / 2) / viewport;
      const copy = copies[index];
      copy.style.setProperty("--copy-y", Math.max(-36, Math.min(36, travel * 64)) + "px");
      const distance = index === 0 ? Math.max(0, -travel - 0.15) : Math.max(0, Math.abs(travel) - 0.23);
      copy.style.setProperty("--copy-opacity", String(1 - 0.86 * clamp(distance * 2.5)));
    }

    const width = stage.clientWidth;
    const aspect = width / viewport;
    const narrow = width <= 650 || aspect < 0.95;
    const ratio = Math.min(mobile ? Math.min(devicePixelRatio || 1, 1.75) : Math.max(devicePixelRatio || 1, 2), 3, Math.sqrt((mobile ? 1600000 : 8300000) / (width * viewport)), maxRenderSize / Math.max(width, viewport));
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(viewport * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      gl.viewport(0, 0, pixelWidth, pixelHeight);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(uniform.Aspect, aspect);
    gl.uniform1f(uniform.Flow, p * 16);
    const artProgress = ease((p - 0.16) / 0.49);
    gl.uniform1f(uniform.ArtProgress, artProgress);
    const size = narrow ? mix(0.82, 1.52, zoom) : mix(1.20 + reveal * 0.12, 2.54, zoom);
    const camera = [mix(0.19 + reveal * 0.08, 1.39, zoom), mix(-0.09 + reveal * 0.46, 0.73, zoom), mix(-0.17 + reveal * 0.35, -0.13, zoom)];
    const x = narrow ? mix(0.23, 0.03, reveal) : mix(0.45 * aspect, 0.65 * aspect, zoom);
    const entryY = narrow ? mix(0.76, 0.45, reveal) : mix(0.12, -0.15, reveal);
    const y = mix(entryY, narrow ? 0.53 : -0.13, zoom);
    gl.uniform1f(uniform.Scale, size);
    gl.uniform3fv(uniform.Camera, camera);
    gl.uniform3fv(uniform.Shift, [x, y, 0]);
    draw(cup);
    draw(rim);
    draw(inside);
    draw(liquid, [0, fill, 0]);
    if (zoom < 0.89) {
      draw(lid, [-0.08 - reveal * 0.79 - zoom * 1.8, 0.73 + reveal * 0.69 + zoom * 0.75, -0.13 - reveal * 0.12],
        [0.02 + reveal * 0.32, 0, reveal * 0.32]);
    }
    if (p > 0.14 && p < 0.81) {
      const enter = ease((p - 0.14) / 0.19);
      const retract = ease((p - 0.65) / 0.16);
      draw(pour, [0, fill + (1 - enter) * 2.4 + retract * 2.5, 0]);
      for (let i = 0; i < 2; i++) {
        const t = (i / 2 + p * 3.2) % 1;
        const distance = t;
        const side = i % 2 === 0 ? 1 : -1;
        const offset = side * (0.40 + distance * 0.45);
        const height = fill + 0.04 + 1.65 * t - 2.15 * t * t;
        const depth = 0.07 + distance * (0.08 + i * 0.015);
        const tilt = Math.atan2(side * 0.45, -(1.65 - 4.30 * t));
        draw(drop, [offset, height, depth], [0.08, 0, tilt]);
      }
    }
  }

  function schedule() {
    if (!frame && !preference.matches && !contextLost) frame = requestAnimationFrame(update);
  }
  function synchronize() {
    story.classList.toggle("has-scene", !preference.matches && !contextLost);
    schedule();
  }
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  preference.addEventListener("change", synchronize);
  canvas.addEventListener("webglcontextlost", () => { contextLost = true; synchronize(); });
  synchronize();
})();
