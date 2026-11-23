'use client'

/**
 * Photo Santa — the photoreal Santa portrait (docs/brand/santa/santa-portrait-master.png) brought to life in the
 * browser with a small WebGL shader. No avatar vendor, no cost.
 *
 *   • Jaw: the beard and lower lip below the lip line slide down with the loudness of Santa's voice, revealing a
 *     dark mouth (teeth hint when wide). Santa's moustache hides the upper lip, which makes this read naturally.
 *   • Blink: the upper eyelid skin slides down over each eye for ~130 ms every few seconds.
 *   • Life: slow breathing / sway of the whole frame; listening = a slight lean-in.
 *
 * All geometry is in the image's own pixel coordinates (941 × 1672). Falls back to a still image without WebGL.
 */
import { useEffect, useRef, useState } from 'react'
import { demoLevel, useVoiceLevel } from './useVoiceLevel'
import type { SantaMode } from './StorybookSanta'

export const PHOTO_SANTA = {
  src: '/brands/holidays/art/santa-live.webp',
  fallback: '/brands/holidays/art/santa-live.jpg',
  width: 941,
  height: 1672,
  /** Centre of the lip line (between the lips) and the mouth's half width. */
  mouth: { x: 480, y: 896, halfWidth: 36 },
  /** How far the jaw drops at full loudness, in image pixels. */
  maxDrop: 19,
  eyes: [
    { x: 405, y: 741, rx: 30, ry: 13 },
    { x: 552, y: 741, rx: 30, ry: 13 },
  ],
} as const

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
uniform vec3 u_cam; // scale, dx, dy (in uv)
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, 1.0 - (a_pos.y + 1.0) * 0.5);
  v_uv = (v_uv - 0.5) / u_cam.x + 0.5 - u_cam.yz;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_img;
uniform vec2 u_size;     // image size in px
uniform vec3 u_mouth;    // x, y, halfWidth (px)
uniform float u_drop;    // current jaw drop (px)
uniform vec4 u_eyeL;     // x, y, rx, ry
uniform vec4 u_eyeR;
uniform float u_blink;   // 0 open .. 1 closed

vec4 tex(vec2 px) { return texture2D(u_img, clamp(px / u_size, 0.0, 1.0)); }

// Eyelid: inside the eye ellipse, pixels above the lid line come from the skin just above the eye.
// Returns the source position and a blend weight that fades out towards the ellipse edge (no visible seam).
vec3 lid(vec2 p, vec4 e) {
  vec2 d = (p - e.xy) / e.zw;
  float r = dot(d, d);
  if (r < 1.0 && u_blink > 0.0) {
    float top = e.y - e.w;
    float lidY = top + u_blink * 2.2 * e.w;
    if (p.y < lidY) {
      float w = (1.0 - smoothstep(0.55, 1.0, r)) * smoothstep(0.0, 2.0, lidY - p.y);
      return vec3(p.x, p.y - u_blink * 2.0 * e.w, w);
    }
  }
  return vec3(p, 0.0);
}

void main() {
  vec2 p = v_uv * u_size;
  vec3 l = lid(p, u_eyeL);
  if (l.z <= 0.0) l = lid(p, u_eyeR);
  if (l.z > 0.0) {
    gl_FragColor = mix(tex(p), tex(l.xy), l.z);
    return;
  }

  float dx = (p.x - u_mouth.x);
  float below = p.y - u_mouth.y;
  // Jaw drop: strongest right under the lips, fading out sideways (~3.5 mouth widths) and downwards (~260 px).
  float fx = 1.0 - smoothstep(u_mouth.z * 1.2, u_mouth.z * 3.6, abs(dx));
  float fy = below > 0.0 ? 1.0 - smoothstep(30.0, 260.0, below) : 0.0;
  float d = u_drop * fx * fy;

  // Mouth opening: a lens between the upper lip line and the dropped lower lip.
  float hw = u_mouth.z * (0.9 + 0.12 * (u_drop / 19.0));
  float shape = clamp(1.0 - (dx * dx) / (hw * hw), 0.0, 1.0);
  float openH = u_drop * sqrt(shape);
  if (below > -1.0 && below < openH && shape > 0.0) {
    float k = below / max(openH, 0.001);
    vec3 inside = mix(vec3(0.20, 0.04, 0.05), vec3(0.42, 0.10, 0.12), smoothstep(0.55, 1.0, k));
    // upper teeth hint when the mouth is open wide
    float teeth = step(9.0, u_drop) * (1.0 - smoothstep(0.18, 0.3, k)) * step(abs(dx), hw * 0.6);
    inside = mix(inside, vec3(0.93, 0.9, 0.86), teeth * 0.85);
    // soft edges so it blends into the lips and beard
    float edge = smoothstep(0.0, 1.5, openH - below) * smoothstep(-1.0, 1.0, below) * smoothstep(0.0, 0.12, shape);
    gl_FragColor = mix(tex(vec2(p.x, p.y - d)), vec4(inside, 1.0), edge);
    return;
  }
  gl_FragColor = tex(vec2(p.x, p.y - d));
}`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

export function PhotoSanta({ stream, audioContext, mode, demo = false, className }: {
  stream: MediaStream | null
  audioContext: AudioContext | null
  mode: SantaMode
  demo?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const { level, tone } = useVoiceLevel(stream, audioContext)
  const [fallback, setFallback] = useState(false)
  void tone

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: false })
    if (!gl) {
      setFallback(true)
      return
    }
    const S = PHOTO_SANTA
    let raf = 0
    let disposed = false
    const img = new Image()
    img.decoding = 'async'
    img.src = S.src
    img.onerror = () => setFallback(true)
    img.onload = () => {
      if (disposed) return
      try {
        const prog = gl.createProgram()!
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link')
        gl.useProgram(prog)
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const loc = gl.getAttribLocation(prog, 'a_pos')
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
        const u = (n: string) => gl.getUniformLocation(prog, n)
        gl.uniform2f(u('u_size'), S.width, S.height)
        gl.uniform3f(u('u_mouth'), S.mouth.x, S.mouth.y, S.mouth.halfWidth)
        gl.uniform4f(u('u_eyeL'), S.eyes[0].x, S.eyes[0].y, S.eyes[0].rx, S.eyes[0].ry)
        gl.uniform4f(u('u_eyeR'), S.eyes[1].x, S.eyes[1].y, S.eyes[1].rx, S.eyes[1].ry)
        const uDrop = u('u_drop')
        const uBlink = u('u_blink')
        const uCam = u('u_cam')

        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        let open = 0
        let lean = 0
        let nextBlink = performance.now() + 1800
        let blinkStart = -1
        const t0 = performance.now()
        // Design preview only: let tests trigger a blink on demand.
        if (demo) (window as unknown as { __santaBlink?: () => void }).__santaBlink = () => { blinkStart = performance.now(); nextBlink = blinkStart + 60_000 }
        const frame = (now: number) => {
          if (disposed) return
          const t = (now - t0) / 1000
          const m = modeRef.current
          let target = demo && m === 'speaking' ? demoLevel(t) : level.current
          if (!stream && !demo) target = 0
          open += (target - open) * (target > open ? 0.5 : 0.2)
          gl.uniform1f(uDrop, open * S.maxDrop)
          canvas.dataset.open = open.toFixed(2) // read by tests (lip-sync is alive)

          if (now > nextBlink) {
            blinkStart = now
            nextBlink = now + 2600 + Math.random() * 3400
            if (Math.random() < 0.15) nextBlink = now + 320
          }
          const bt = blinkStart < 0 ? 1 : (now - blinkStart) / 140
          const hold = demo ? (window as unknown as { __santaBlinkHold?: number }).__santaBlinkHold : undefined
          gl.uniform1f(uBlink, hold ?? (bt >= 1 ? 0 : Math.sin(bt * Math.PI)))

          lean += ((m === 'listening' ? 1 : 0) - lean) * 0.05
          const breathe = reduce ? 0 : Math.sin(t * 1.3) * 0.0016
          const swayX = reduce ? 0 : Math.sin(t * 0.47) * 0.0018
          const swayY = reduce ? 0 : Math.sin(t * 0.31) * 0.0012 + open * 0.0006
          gl.uniform3f(uCam, 1.0 + breathe + lean * 0.012, swayX, swayY - lean * 0.002)

          gl.viewport(0, 0, canvas.width, canvas.height)
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
      } catch {
        setFallback(true)
      }
    }
    const lost = (e: Event) => {
      e.preventDefault()
      setFallback(true)
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      canvas.removeEventListener('webglcontextlost', lost)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, stream])

  if (fallback) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={PHOTO_SANTA.fallback} alt="Santa Claus" className={`${className ?? ''} object-cover`} />
  }
  return <canvas ref={canvasRef} width={PHOTO_SANTA.width} height={PHOTO_SANTA.height} role="img" aria-label="Santa Claus" className={`${className ?? ''} object-cover`} />
}
