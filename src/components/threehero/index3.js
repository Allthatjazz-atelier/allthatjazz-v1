import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PaperWindEffect2 = () => {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    /* ---------- SCENE ---------- */

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      100
    )
    camera.position.set(0, 0, 4)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    )
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    containerRef.current.appendChild(renderer.domElement)

    /* ---------- CONFIG ---------- */

    const BASE_WIDTH = 2
    const BASE_HEIGHT = 1.5
    const spacing = 2

    /* ---------- DATA ---------- */

    const loader = new THREE.TextureLoader()
    const items = []
    let activeItem = null

    /* ---------- SCROLL STATE ---------- */

    let scrollTarget = 0
    let scrollCurrent = 0
    let scrollVelocity = 0

    let depthOffset = 0
    let rotationOffset = 0

    let touchStartY = 0

    /* ---------- IMAGES ---------- */

    for (let i = 1; i <= 19; i++) {
      const texture = loader.load(`/hero/img${i}.png`)

      const material = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          uTexture: { value: texture },
          uTime: { value: 0 },
          uWaveStrength: { value: 0.15 }
        },

        vertexShader: `
          uniform float uTime;
          uniform float uWaveStrength;

          varying vec2 vUv;

          void main() {
            vUv = uv;
            vec3 pos = position;

            pos.z += sin(pos.x * 2.5 + uTime) * uWaveStrength;
            pos.z += sin(pos.y * 1.8 + uTime * 1.3) * uWaveStrength * 0.8;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,

        fragmentShader: `
          uniform sampler2D uTexture;
          varying vec2 vUv;

          void main() {
            gl_FragColor = texture2D(uTexture, vUv);
          }
        `
      })

      const geometry = new THREE.PlaneGeometry(
        BASE_WIDTH,
        BASE_HEIGHT,
        64,
        64
      )

      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.y = -(i - 1) * spacing
      scene.add(mesh)

      const defaultScale = new THREE.Vector3(1, 1, 1)
      const originalScale = new THREE.Vector3(1, 1, 1)

      texture.onUpdate = () => {
        const ratio = texture.image.width / texture.image.height
        if (ratio > 1) {
          originalScale.set(ratio, 1, 1)
        } else {
          originalScale.set(1, 1 / ratio, 1)
        }
      }

      items.push({
        mesh,
        material,
        defaultScale,
        originalScale,
        focus: 0,
        wave: 0.15,
        isActive: false
      })
    }

    scene.add(new THREE.AmbientLight(0xffffff, 1))

    /* ---------- DESKTOP SCROLL ---------- */

    const onWheel = (e) => {
      if (activeItem) return
      scrollTarget += e.deltaY * 0.001
      scrollTarget = Math.max(
        0,
        Math.min(scrollTarget, (items.length - 1) * spacing)
      )
    }

    /* ---------- MOBILE TOUCH ---------- */

    const onTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
    }

    const onTouchMove = (e) => {
      if (activeItem) return
      const delta = touchStartY - e.touches[0].clientY
      scrollTarget += delta * 0.003
      scrollTarget = Math.max(
        0,
        Math.min(scrollTarget, (items.length - 1) * spacing)
      )
      touchStartY = e.touches[0].clientY
    }

    containerRef.current.addEventListener('wheel', onWheel, { passive: true })
    containerRef.current.addEventListener('touchstart', onTouchStart, { passive: true })
    containerRef.current.addEventListener('touchmove', onTouchMove, { passive: true })

    /* ---------- CLICK ---------- */

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onClick = (e) => {
      const rect = containerRef.current.getBoundingClientRect()

      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(items.map(i => i.mesh))
      if (!hits.length) return

      const item = items.find(i => i.mesh === hits[0].object)
      if (activeItem && activeItem !== item) return

      item.isActive = !item.isActive
      activeItem = item.isActive ? item : null
    }

    containerRef.current.addEventListener('click', onClick)

    /* ---------- ANIMATION ---------- */

    const clock = new THREE.Clock()

    const animate = () => {
      requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      /* ---- scroll easing ---- */
      scrollVelocity = scrollTarget - scrollCurrent
      scrollCurrent += scrollVelocity * 0.08
      camera.position.y = -scrollCurrent

      /* ---- elastic depth ---- */
      const depthTarget = THREE.MathUtils.clamp(
        Math.abs(scrollVelocity) * 8,
        0,
        1
      )
      depthOffset += (depthTarget - depthOffset) * 0.12

      /* ---- rotation from velocity ---- */
      const rotationTarget = THREE.MathUtils.clamp(
        scrollVelocity * 4,
        -0.15,
        0.15
      )
      rotationOffset += (rotationTarget - rotationOffset) * 0.1

      items.forEach(item => {
        const target = item.isActive ? 1 : 0
        item.focus += (target - item.focus) * 0.08

        const targetWave = item.isActive ? 0 : 0.15
        item.wave += (targetWave - item.wave) * 0.08
        item.material.uniforms.uWaveStrength.value = item.wave
        item.material.uniforms.uTime.value = t

        /* ---- scale ---- */
        const sx = THREE.MathUtils.lerp(
          item.defaultScale.x,
          item.originalScale.x * 1.15,
          item.focus
        )
        const sy = THREE.MathUtils.lerp(
          item.defaultScale.y,
          item.originalScale.y * 1.15,
          item.focus
        )
        item.mesh.scale.set(sx, sy, 1)

        /* ---- elastic depth ---- */
        item.mesh.position.z =
          item.isActive
            ? 0.4
            : -depthOffset * 0.6

        /* ---- rotation Z (only if not active) ---- */
        item.mesh.rotation.z =
          item.isActive
            ? 0
            : rotationOffset * 0.3
      })

      renderer.render(scene, camera)
    }

    animate()

    /* ---------- RESIZE ---------- */

    const onResize = () => {
      camera.aspect =
        containerRef.current.clientWidth /
        containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      )
    }

    window.addEventListener('resize', onResize)

    /* ---------- CLEANUP ---------- */

    return () => {
      window.removeEventListener('resize', onResize)
      containerRef.current.removeEventListener('wheel', onWheel)
      containerRef.current.removeEventListener('touchstart', onTouchStart)
      containerRef.current.removeEventListener('touchmove', onTouchMove)
      containerRef.current.removeEventListener('click', onClick)
      renderer.dispose()
    }
  }, [])

  return <div ref={containerRef} className="w-full h-screen bg-white" />
}

export default PaperWindEffect2
