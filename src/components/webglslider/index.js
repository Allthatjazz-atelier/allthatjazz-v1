"use client";

import { useEffect, useRef } from "react";

const WebGlCarousel = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    
    
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Vertex Shader con deformación lateral MÁS DRAMÁTICA
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      
      uniform vec2 u_resolution;
      uniform float u_slideWidth;
      uniform float u_slideHeight;
      uniform vec2 u_offset;
      uniform float u_stretch;
      uniform float u_isLeft; // 1.0 para izquierdo, 0.0 para derecho
      
      varying vec2 v_texCoord;
      
      void main() {
        vec2 pos = a_position;
        
        // Normalizar posición X dentro del slide (-1 a 1)
        float normalizedX = (a_position.x / u_slideWidth) * 2.0;
        
        if (u_isLeft > 0.5) {
          // Slider izquierdo: el estiramiento va de máximo (izquierda) a mínimo (derecha)
          // Convertir de [-1, 1] a [1, 0] para que -1 sea máximo y 1 sea mínimo
          float stretchFactor = pow((1.0 - normalizedX) * 0.5, 1.2);
          
          // Desplazamiento horizontal con gradiente suave
          pos.x -= stretchFactor * u_stretch * 180.0;
          
          // Curvatura Y con el mismo gradiente
          float normalizedY = (a_position.y / u_slideHeight);
          float curvature = (1.0 - normalizedY * normalizedY) * stretchFactor;
          pos.y += curvature * u_stretch * 30.0;
          
        } else {
          // Slider derecho: el estiramiento va de mínimo (izquierda) a máximo (derecha)
          // Convertir de [-1, 1] a [0, 1] para que -1 sea mínimo y 1 sea máximo
          float stretchFactor = pow((1.0 + normalizedX) * 0.5, 1.2);
          
          // Desplazamiento horizontal con gradiente suave
          pos.x += stretchFactor * u_stretch * 180.0;
          
          // Curvatura Y con el mismo gradiente
          float normalizedY = (a_position.y / u_slideHeight);
          float curvature = (1.0 - normalizedY * normalizedY) * stretchFactor;
          pos.y += curvature * u_stretch * 30.0;
        }
        
        // Aplicar offset y convertir a clip space
        pos += u_offset;
        vec2 clipSpace = ((pos / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
        
        gl_Position = vec4(clipSpace, 0, 1);
        v_texCoord = a_texCoord;
        
      }
    `;
    

    // Fragment Shader
    const fragmentShaderSource = `
      precision mediump float;
      
      uniform sampler2D u_texture;
      uniform float u_hasTexture;
      
      varying vec2 v_texCoord;
      
      void main() {
        if (u_hasTexture > 0.5) {
          gl_FragColor = texture2D(u_texture, v_texCoord);
        } else {
          gl_FragColor = vec4(0.9, 0.9, 0.9, 1.0);
        }
      }
    `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Configuración
    const slideWidth = window.innerWidth * 0.5;
    const slideHeight = slideWidth * 1.25;
    const gap = 0; // Sin gap vertical entre imágenes
    const slideCount = 7; // Más slides para mejor continuidad
    const leftImageRange = [1, 7];
    const rightImageRange = [8, 14];

    const leftImagesCount = leftImageRange[1] - leftImageRange[0] + 1; // 7
    const rightImagesCount = rightImageRange[1] - rightImageRange[0] + 1; // 7


    const settings = {
      wheelSensitivity: 0.5,
      touchSensitivity: 0.5,
      smoothing: 0.08,
      slideLerp: 0.1,
      stretchLerp: 0.15,
      maxStretch: 2.0,
      stretchDecay: 0.90,
    };

    let currentPosition = 0;
    let targetPosition = 0;
    let currentStretch = 0;
    let targetStretch = 0;
    let isScrolling = false;
    let autoScrollSpeed = 0;
    let touchStartY = 0;
    let touchLastY = 0;

    // Crear geometría de un slide (rectángulo)
    function createSlideGeometry(width, height, segments = 32) {
      const positions = [];
      const texCoords = [];
      const indices = [];

      for (let y = 0; y <= segments; y++) {
        for (let x = 0; x <= segments; x++) {
          const xPos = (x / segments - 0.5) * width;
          const yPos = (y / segments - 0.5) * height;
          positions.push(xPos, yPos);
          texCoords.push(x / segments, y / segments);
        }
      }

      for (let y = 0; y < segments; y++) {
        for (let x = 0; x < segments; x++) {
          const i0 = y * (segments + 1) + x;
          const i1 = i0 + 1;
          const i2 = i0 + (segments + 1);
          const i3 = i2 + 1;
          indices.push(i0, i1, i2, i1, i3, i2);
        }
      }

      return { positions, texCoords, indices };
    }

    const geometry = createSlideGeometry(slideWidth, slideHeight);

    // Buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.texCoords), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);

    // Locations
    const positionLoc = gl.getAttribLocation(program, "a_position");
    const texCoordLoc = gl.getAttribLocation(program, "a_texCoord");
    const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
    const slideWidthLoc = gl.getUniformLocation(program, "u_slideWidth");
    const slideHeightLoc = gl.getUniformLocation(program, "u_slideHeight");
    const offsetLoc = gl.getUniformLocation(program, "u_offset");
    const stretchLoc = gl.getUniformLocation(program, "u_stretch");
    const isLeftLoc = gl.getUniformLocation(program, "u_isLeft");
    const textureLoc = gl.getUniformLocation(program, "u_texture");
    const hasTextureLoc = gl.getUniformLocation(program, "u_hasTexture");

    // Cargar imágenes
    const leftSlides = [];
    const rightSlides = [];

    // Orden aleatorio para slider derecho
    // Índices SOLO para el slider derecho (8 → 14)
    const shuffledRightIndices = Array.from(
      { length: rightImagesCount },
      (_, i) => rightImageRange[0] + i
    );

    


    function loadTexture(url) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 200, 200, 255]));

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      };
      image.src = url;

      return texture;
    }

    for (let i = 0; i < slideCount; i++) {
      const leftImg =
        leftImageRange[0] + (i % leftImagesCount);
    
      const rightImg =
        shuffledRightIndices[i % rightImagesCount];
    
      leftSlides.push({
        texture: loadTexture(`/story/story${leftImg}.png`),
        y: i * slideHeight,
        currentY: i * slideHeight,
      });
    
      rightSlides.push({
        texture: loadTexture(`/story/story${rightImg}.png`),
        y: i * slideHeight,
        currentY: i * slideHeight,
      });
    }
    

    // Event handlers
    const handleWheel = (e) => {
      e.preventDefault();
      targetPosition += e.deltaY * settings.wheelSensitivity;
      targetStretch = settings.maxStretch;
      isScrolling = true;
      autoScrollSpeed = Math.min(Math.abs(e.deltaY) * 0.002, 2) * Math.sign(e.deltaY);

      clearTimeout(window.scrollTimeout);
      window.scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 150);
    };

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
      touchLastY = touchStartY;
      isScrolling = false;
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const deltaY = touchY - touchLastY;
      touchLastY = touchY;

      targetPosition -= deltaY * settings.touchSensitivity;
      targetStretch = settings.maxStretch;
      isScrolling = true;
    };

    const handleTouchEnd = () => {
      const velocity = (touchLastY - touchStartY) * 0.3;
      if (Math.abs(velocity) > 10) {
        autoScrollSpeed = velocity * 0.05;
        targetStretch = settings.maxStretch;
        isScrolling = true;
        setTimeout(() => {
          isScrolling = false;
        }, 800);
      }
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("resize", handleResize);

    function drawSlide(texture, x, y, isLeft, stretch) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(textureLoc, 0);
      gl.uniform1f(hasTextureLoc, 1.0);
      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(slideWidthLoc, slideWidth);
      gl.uniform1f(slideHeightLoc, slideHeight);
      gl.uniform2f(offsetLoc, x, y);
      gl.uniform1f(stretchLoc, stretch);
      gl.uniform1f(isLeftLoc, isLeft ? 1.0 : 0.0);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.enableVertexAttribArray(texCoordLoc);
      gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
    }

    function animate() {
      requestAnimationFrame(animate);

      if (isScrolling) {
        targetPosition += autoScrollSpeed;
        autoScrollSpeed *= 0.95;
        if (Math.abs(autoScrollSpeed) < 0.01) autoScrollSpeed = 0;
      }

      if (!isScrolling) {
        targetStretch *= settings.stretchDecay;
      }

      currentPosition += (targetPosition - currentPosition) * settings.smoothing;
      currentStretch += (targetStretch - currentStretch) * settings.stretchLerp;

      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const totalHeight = slideCount * slideHeight; // Sin gap
      const centerY = canvas.height / 2;

      // Slider izquierdo (va hacia abajo)
      leftSlides.forEach((slide, i) => {
        let baseY = centerY + (i * slideHeight - currentPosition);
      
        const wrapThreshold = totalHeight / 2;
        while (baseY < centerY - wrapThreshold) baseY += totalHeight;
        while (baseY > centerY + wrapThreshold) baseY -= totalHeight;
      
        const delta = baseY - slide.currentY;
        if (Math.abs(delta) > slideHeight * 1.5) {
          slide.currentY = baseY;
        } else {
          slide.currentY += delta * settings.slideLerp;
        }
      
        const x = canvas.width / 2 - slideWidth / 2;
        drawSlide(slide.texture, x, slide.currentY, true, currentStretch);
      });
      

      // Slider derecho (va hacia arriba - dirección opuesta)
      const asymmetryOffset = slideHeight * 0.6; // 40% de desplazamiento hacia arriba
      rightSlides.forEach((slide, i) => {
        let baseY = centerY + (i * slideHeight + currentPosition) - asymmetryOffset;
      
        const wrapThreshold = totalHeight / 2;
        while (baseY < centerY - wrapThreshold) baseY += totalHeight;
        while (baseY > centerY + wrapThreshold) baseY -= totalHeight;
      
        const delta = baseY - slide.currentY;
        if (Math.abs(delta) > slideHeight * 1.5) {
          slide.currentY = baseY;
        } else {
          slide.currentY += delta * settings.slideLerp;
        }
      
        const x = canvas.width / 2 + slideWidth / 2;
        drawSlide(slide.texture, x, slide.currentY, false, currentStretch);
      });
      
    }

    animate();

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("resize", handleResize);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
      }}
    />
  );
};

export default WebGlCarousel;