import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PaperWindEffect = () => {
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
      1000
    )
    camera.position.set(0, 0, 3)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    )
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)

    /* ---------- IMAGES ---------- */

    const loader = new THREE.TextureLoader()
    const items = []
    const spacing = 2
    let activeItem = null

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

      const geometry = new THREE.PlaneGeometry(2, 1.5, 64, 64)
      const mesh = new THREE.Mesh(geometry, material)

      mesh.position.y = -(i - 1) * spacing
      scene.add(mesh)

      items.push({
        mesh,
        material,
        baseScale: mesh.scale.clone(),
        wave: 0.15,
        isActive: false
      })
    }

    scene.add(new THREE.AmbientLight(0xffffff, 1))

    /* ---------- SCROLL ---------- */

    let scrollY = 0
    const onWheel = (e) => {
      if (activeItem) return
      scrollY += e.deltaY * 0.001
      camera.position.y = -scrollY
    }

    containerRef.current.addEventListener('wheel', onWheel)

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

      items.forEach(item => {
        // animar wave strength
        const targetWave = item.isActive ? 0.0 : 0.15
        item.wave += (targetWave - item.wave) * 0.08
        item.material.uniforms.uWaveStrength.value = item.wave

        // animar escala
        const targetScale = item.isActive ? 1.2 : 1.0
        item.mesh.scale.lerp(
          new THREE.Vector3(
            item.baseScale.x * targetScale,
            item.baseScale.y * targetScale,
            1
          ),
          0.1
        )

        item.material.uniforms.uTime.value = t
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
      containerRef.current.removeEventListener('click', onClick)
      renderer.dispose()
    }
  }, [])

  return <div ref={containerRef} className="w-full h-screen bg-white" />
}

export default PaperWindEffect
