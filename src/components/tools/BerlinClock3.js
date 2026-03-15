"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── Shader 1: Fluid gradient ──────────────────────────────────────────────────
const fluidSimFrag = `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform vec4 iMouse;
  uniform int iFrame;
  uniform sampler2D iPreviousFrame;
  uniform float uBrushSize;
  uniform float uBrushStrength;
  uniform float uFluidDecay;
  uniform float uTrailLength;
  uniform float uStopDecay;
  varying vec2 vUv;
  vec2 ur, U;
  float ln(vec2 p, vec2 a, vec2 b) {
    return length(p-a-(b-a)*clamp(dot(p-a,b-a)/dot(b-a,b-a),0.,1.));
  }
  vec4 t(vec2 v, int a, int b) {
    return texture2D(iPreviousFrame, fract((v+vec2(float(a),float(b)))/ur));
  }
  vec4 t(vec2 v) { return texture2D(iPreviousFrame, fract(v/ur)); }
  float area(vec2 a, vec2 b, vec2 c) {
    float A=length(b-c),B=length(c-a),C=length(a-b),s=0.5*(A+B+C);
    return sqrt(s*(s-A)*(s-B)*(s-C));
  }
  void main() {
    U = vUv * iResolution; ur = iResolution.xy;
    if (iFrame < 1) {
      float w=0.5+sin(0.2*U.x)*0.5, q=length(U-0.5*ur);
      gl_FragColor = vec4(0.1*exp(-0.001*q*q),0,0,w);
    } else {
      vec2 v=U,A=v+vec2(1,1),B=v+vec2(1,-1),C=v+vec2(-1,1),D=v+vec2(-1,-1);
      for(int i=0;i<8;i++){v-=t(v).xy;A-=t(A).xy;B-=t(B).xy;C-=t(C).xy;D-=t(D).xy;}
      vec4 me=t(v);
      vec4 n=t(v,0,1),e=t(v,1,0),s=t(v,0,-1),w=t(v,-1,0);
      me=mix(t(v),.25*(n+e+s+w),vec4(0.15,0.15,0.95,0.));
      me.z=me.z-0.01*((area(A,B,C)+area(B,C,D))-4.);
      vec4 pr=vec4(e.z,w.z,n.z,s.z);
      me.xy=me.xy+100.*vec2(pr.x-pr.y,pr.z-pr.w)/ur;
      me.xy*=uFluidDecay; me.z*=uTrailLength;
      if(iMouse.z>0.0){
        vec2 mp=iMouse.xy,mpr=iMouse.zw,mv=mp-mpr;
        float vm=length(mv),q=ln(U,mp,mpr);
        vec2 m=mp-mpr; float l=length(m);
        if(l>0.0) m=min(l,10.0)*m/l;
        float ff=pow(exp(-1e-4/uBrushSize*q*q*q),0.5);
        me.xyw+=0.03*uBrushStrength*ff*vec3(m,10.);
        if(vm<2.0){float di=exp(-length(U-mp)*0.01);me.xy*=mix(1.0,uStopDecay,di);me.z*=mix(1.0,uStopDecay,di);}
      }
      gl_FragColor=clamp(me,-0.4,0.4);
    }
  }
`;

const fluidDisplayFrag = `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform sampler2D iFluid;
  uniform float uDistortionAmount;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  uniform float uColorIntensity;
  uniform float uSoftness;
  varying vec2 vUv;
  void main() {
    vec2 fc=vUv*iResolution;
    vec2 fv=texture2D(iFluid,vUv).xy;
    float mr=min(iResolution.x,iResolution.y);
    vec2 uv=(fc*2.0-iResolution.xy)/mr;
    uv+=fv*(0.5*uDistortionAmount);
    float d=-iTime*0.5,a=0.0;
    for(float i=0.0;i<8.0;++i){a+=cos(i-d-a*uv.x);d+=sin(uv.y*i+a);}
    d+=iTime*0.5;
    float sm=clamp(uSoftness*0.1,0.0,0.9);
    float m1=mix(cos(uv.x*d)*0.5+0.5,0.5,sm);
    float m2=mix(cos(uv.y*a)*0.5+0.5,0.5,sm);
    float m3=mix(sin(d+a)*0.5+0.5,0.5,sm);
    vec3 col=mix(uColor1,uColor2,m1);
    col=mix(col,uColor3,m2);
    col=mix(col,uColor4,m3*0.4);
    gl_FragColor=vec4(col*uColorIntensity,0.65);
  }
`;

// ── Shader 2: Water ripple — overlay con screen blend ────────────────────────
// Simula ondas de presión, las muestra como luz iridiscente sobre la página
const rippleSimFrag = `
  uniform sampler2D textureA;
  uniform vec2 mouse;
  uniform vec2 resolution;
  uniform float time;
  uniform int frame;
  varying vec2 vUv;
  const float delta = 1.4;
  void main() {
    vec2 uv=vUv;
    if(frame==0){gl_FragColor=vec4(0.0);return;}
    vec4 data=texture2D(textureA,uv);
    float pressure=data.x, pVel=data.y;
    vec2 ts=1.0/resolution;
    float pr=texture2D(textureA,uv+vec2(ts.x,0)).x;
    float pl=texture2D(textureA,uv+vec2(-ts.x,0)).x;
    float pu=texture2D(textureA,uv+vec2(0,ts.y)).x;
    float pd=texture2D(textureA,uv+vec2(0,-ts.y)).x;
    if(uv.x<=ts.x) pl=pr;
    if(uv.x>=1.0-ts.x) pr=pl;
    if(uv.y<=ts.y) pd=pu;
    if(uv.y>=1.0-ts.y) pu=pd;
    pVel+=delta*(-2.0*pressure+pr+pl)/4.0;
    pVel+=delta*(-2.0*pressure+pu+pd)/4.0;
    pressure+=delta*pVel;
    pVel-=0.005*delta*pressure;
    pVel*=1.0-0.002*delta;
    pressure*=0.999;
    vec2 muv=mouse/resolution;
    if(mouse.x>0.0){
      float dist=distance(uv,muv);
      if(dist<=0.025) pressure+=2.5*(1.0-dist/0.025);
    }
    gl_FragColor=vec4(pressure,pVel,(pr-pl)/2.0,(pu-pd)/2.0);
  }
`;

// Ripple display: ondas como luz especular iridiscente — screen blend sobre la página
const rippleDisplayFrag = `
  uniform sampler2D textureA;
  uniform float iTime;
  varying vec2 vUv;
  void main() {
    vec4 data = texture2D(textureA, vUv);
    float pressure = data.x;
    vec2 grad = data.zw;
    // Normal del agua
    vec3 normal = normalize(vec3(-grad.x * 3.0, 0.4, -grad.y * 3.0));
    vec3 light   = normalize(vec3(0.3, 1.0, 0.5));
    float spec   = pow(max(0.0, dot(normal, light)), 55.0);
    // Color iridiscente basado en la dirección del gradiente
    float hue    = atan(grad.y, grad.x) / 6.2832 + 0.5 + iTime * 0.05;
    vec3 col1    = vec3(0.0, 0.85, 1.0);   // cian
    vec3 col2    = vec3(0.9, 0.2, 0.8);    // magenta
    vec3 col3    = vec3(0.95, 0.97, 1.0);  // blanco frío
    float t1     = fract(hue);
    float t2     = fract(hue + 0.33);
    vec3 iridesc = mix(col1, col2, t1) * 0.5 + mix(col2, col3, t2) * 0.5;
    // Intensidad basada en la presión y el especular
    float intensity = abs(pressure) * 2.5 + spec * 2.0;
    vec3 finalCol   = iridesc * intensity;
    gl_FragColor    = vec4(finalCol, min(intensity * 0.9, 0.95));
  }
`;

export default function BerlinClock() {
  const [time, setTime] = useState("");
  const [mode, setMode] = useState(0); // 0=off 1=fluid 2=ripple

  const canvasRef = useRef(null);
  const glRef     = useRef(null);
  const rafRef    = useRef(null);
  const modeRef   = useRef(0);

  // ── Reloj ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const upd = () => setTime(new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date()));
    upd();
    const id = setInterval(upd, 1000);
    return () => clearInterval(id);
  }, []);

  // ── WebGL setup/teardown ───────────────────────────────────────────────────
  useEffect(() => {
    modeRef.current = mode;
    cancelAnimationFrame(rafRef.current);

    // Cleanup anterior
    if (glRef.current) {
      const g = glRef.current;
      try { g.renderer.dispose(); } catch(e) {}
      try { g.rtA?.dispose(); g.rtB?.dispose(); } catch(e) {}
      glRef.current = null;
    }

    if (mode === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = window.innerWidth, h = window.innerHeight;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0, 0);
    } catch(e) {
      console.warn("WebGL init failed", e);
      return;
    }

    // HalfFloatType es más compatible que FloatType
    const texType = renderer.capabilities.isWebGL2
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType;

    const rtOpts = {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: texType,
    };
    const rtA = new THREE.WebGLRenderTarget(w, h, rtOpts);
    const rtB = new THREE.WebGLRenderTarget(w, h, rtOpts);

    const geo = new THREE.PlaneGeometry(2, 2);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const simScene  = new THREE.Scene();
    const dispScene = new THREE.Scene();
    let simMat, dispMat;

    if (mode === 1) {
      simMat = new THREE.ShaderMaterial({
        uniforms: {
          iTime:{value:0}, iResolution:{value:new THREE.Vector2(w,h)},
          iMouse:{value:new THREE.Vector4(0,0,0,0)}, iFrame:{value:0},
          iPreviousFrame:{value:null},
          uBrushSize:{value:0.8}, uBrushStrength:{value:1.2},
          uFluidDecay:{value:0.995}, uTrailLength:{value:0.992}, uStopDecay:{value:0.95},
        },
        vertexShader, fragmentShader: fluidSimFrag,
      });
      dispMat = new THREE.ShaderMaterial({
        uniforms: {
          iTime:{value:0}, iResolution:{value:new THREE.Vector2(w,h)},
          iFluid:{value:null}, uDistortionAmount:{value:1.4},
          uColor1:{value:new THREE.Vector3(0.95,0.97,1.0)},
          uColor2:{value:new THREE.Vector3(0.0,0.85,1.0)},
          uColor3:{value:new THREE.Vector3(0.9,0.3,0.8)},
          uColor4:{value:new THREE.Vector3(0.05,0.1,0.4)},
          uColorIntensity:{value:0.5}, uSoftness:{value:2.5},
        },
        vertexShader, fragmentShader: fluidDisplayFrag,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
    } else {
      // mode 2: ripple
      simMat = new THREE.ShaderMaterial({
        uniforms: {
          textureA:{value:null}, mouse:{value:new THREE.Vector2(-1,-1)},
          resolution:{value:new THREE.Vector2(w,h)},
          time:{value:0}, frame:{value:0},
        },
        vertexShader, fragmentShader: rippleSimFrag,
      });
      dispMat = new THREE.ShaderMaterial({
        uniforms: {
          textureA:{value:null},
          iTime:{value:0},
        },
        vertexShader, fragmentShader: rippleDisplayFrag,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
    }

    simScene.add(new THREE.Mesh(geo, simMat));
    dispScene.add(new THREE.Mesh(geo, dispMat));

    glRef.current = {
      renderer, simMat, dispMat,
      simScene, dispScene, cam,
      rtA, rtB, frame: 0,
      mouse: new THREE.Vector2(-1,-1),
      prevMouse: new THREE.Vector2(-1,-1),
    };

    const onMove = (e) => {
      const g = glRef.current;
      if (!g) return;
      g.prevMouse.copy(g.mouse);
      g.mouse.set(e.clientX, h - e.clientY);
    };
    window.addEventListener("mousemove", onMove);

    const start = performance.now();
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const g = glRef.current;
      if (!g) return;

      const tt    = (performance.now() - start) / 1000;
      const read  = g.frame % 2 === 0 ? g.rtA : g.rtB;
      const write = g.frame % 2 === 0 ? g.rtB : g.rtA;

      try {
        if (modeRef.current === 1) {
          g.simMat.uniforms.iTime.value          = tt;
          g.simMat.uniforms.iFrame.value         = g.frame;
          g.simMat.uniforms.iPreviousFrame.value = read.texture;
          g.simMat.uniforms.iMouse.value.set(
            g.mouse.x, g.mouse.y, g.prevMouse.x, g.prevMouse.y
          );
          g.renderer.setRenderTarget(write);
          g.renderer.render(g.simScene, g.cam);
          g.dispMat.uniforms.iTime.value  = tt;
          g.dispMat.uniforms.iFluid.value = write.texture;
        } else {
          g.simMat.uniforms.frame.value    = g.frame;
          g.simMat.uniforms.time.value     = tt;
          g.simMat.uniforms.textureA.value = read.texture;
          g.simMat.uniforms.mouse.value.copy(g.mouse);
          g.renderer.setRenderTarget(write);
          g.renderer.render(g.simScene, g.cam);
          g.dispMat.uniforms.textureA.value = write.texture;
          g.dispMat.uniforms.iTime.value    = tt;
        }

        g.renderer.setRenderTarget(null);
        g.renderer.render(g.dispScene, g.cam);
      } catch(e) {
        // Si hay error de contexto, para silenciosamente
        cancelAnimationFrame(rafRef.current);
        return;
      }

      g.prevMouse.copy(g.mouse);
      g.frame++;
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      try { renderer.dispose(); rtA.dispose(); rtB.dispose(); } catch(e) {}
    };
  }, [mode]);

  const handleClick = () => setMode(m => (m + 1) % 3);

  return (
    <>
      {/* Ambos modos: screen blend, z bajo — converge con el contenido */}
      <canvas
        ref={canvasRef}
        style={{
          position:      "fixed",
          inset:         0,
          width:         "100%",
          height:        "100%",
          zIndex:        40,
          pointerEvents: "none",
          display:       "block",
          opacity:       mode > 0 ? 1 : 0,
          transition:    "opacity 0.5s ease",
          mixBlendMode:  "screen",
        }}
      />

      <div className="flex items-center gap-1 text-[0.875rem] text-black tabular-nums">
        <span>Berlin, {time}</span>
        <img
          src="/avatar/✦.svg"
          alt="avatar"
          onClick={handleClick}
          className="w-[14px] h-[14px] pointer-events-auto transition-transform duration-700 ease-in-out hover:rotate-[360deg] cursor-pointer"
          style={{
            transformOrigin: "center",
            opacity: mode === 0 ? 0.5 : 1,
            transition: "opacity 0.3s ease",
          }}
        />
      </div>
    </>
  );
}