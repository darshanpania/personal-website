import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import type { Stop } from "../stops";
import type { ThemeFactory } from "../theme";

/**
 * Test scene for the 3D pipeline: a slow field of dots in the colours of the
 * site. It proves the full chain (lazy load, one canvas across pages, a
 * camera stop for each page, dark mode, lite mode) before the real theme
 * replaces it.
 */

const GRID = 150;
const SPACING = 0.55;
const FOV = 45;

/** Camera position and look-at point for each stop. */
const VIEWS: Record<Stop, [position: [number, number, number], look: [number, number, number]]> = {
  home: [[0, 5.5, 20], [0, 0, 0]],
  blog: [[-15, 4.5, 11], [3, 0, -5]],
  post: [[-5, 15, 7], [-5, 0, -3]],
  projects: [[15, 5, 11], [-3, 0, -5]],
  resume: [[11, 9, -9], [0, 0, 2]],
  contact: [[0, 3, 26], [0, 1, 0]],
  other: [[0, 11, 23], [0, 0, 0]],
};

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;
  varying float vCrest;

  void main() {
    vec3 p = position;
    float wave =
      sin(p.x * 0.35 + uTime * 0.40) * 0.55 +
      sin(p.z * 0.27 - uTime * 0.31) * 0.55 +
      sin((p.x + p.z) * 0.12 + uTime * 0.20) * 1.10;
    p.y = wave;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float dist = -mv.z;
    float size = 0.07 * uScale / dist;
    gl_PointSize = max(size, 1.5);
    // Dots smaller than the minimum size fade out, so they do not shimmer.
    float small = min(size / 1.5, 1.0);
    // Fade into the distance, and fade the large dots next to the camera,
    // so the field stays quiet behind the text.
    vAlpha = small * small * smoothstep(46.0, 14.0, dist) * smoothstep(3.0, 12.0, dist);
    vCrest = smoothstep(0.4, 2.0, wave);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uAccent;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vCrest;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float dot = 1.0 - smoothstep(0.32, 0.5, d);
    if (dot <= 0.0) discard;
    gl_FragColor = vec4(mix(uInk, uAccent, vCrest), dot * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export const createTheme: ThemeFactory = (ctx) => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, ctx.aspect, 0.1, 120);

  const positions = new Float32Array(GRID * GRID * 3);
  const half = ((GRID - 1) * SPACING) / 2;
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const k = (i * GRID + j) * 3;
      positions[k] = i * SPACING - half;
      positions[k + 2] = j * SPACING - half;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  const background = new Color();
  const goal = { background: new Color(), ink: new Color(), accent: new Color(), opacity: 1 };
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1 },
      uInk: { value: new Color() },
      uAccent: { value: new Color() },
      uOpacity: { value: 1 },
    },
  });
  const dots = new Points(geometry, material);
  // The waves move the dots in the shader, outside the static bounding sphere.
  dots.frustumCulled = false;
  scene.add(dots);
  scene.background = background;

  let coloursSettled = false;
  const readColours = (instant: boolean) => {
    goal.background.set(token("--bg"));
    goal.ink.set(token("--text-secondary"));
    goal.accent.set(token("--mono-accent"));
    goal.opacity = ctx.dark ? 0.5 : 0.42;
    coloursSettled = false;
    if (instant) blendColours(1);
  };
  const blendColours = (k: number) => {
    background.lerp(goal.background, k);
    material.uniforms.uInk.value.lerp(goal.ink, k);
    material.uniforms.uAccent.value.lerp(goal.accent, k);
    material.uniforms.uOpacity.value += (goal.opacity - material.uniforms.uOpacity.value) * k;
  };

  const position = new Vector3();
  const look = new Vector3();
  const goalPosition = new Vector3();
  const goalLook = new Vector3();
  const sway = new Vector3();
  const goalSway = new Vector3();
  const lookNow = new Vector3();
  let colourClock = 0;

  const setScale = () => {
    const height = ctx.renderer.domElement.height;
    material.uniforms.uScale.value = height / (2 * Math.tan((FOV * Math.PI) / 360));
    // A narrow screen sees less of the field: pull the camera back a little.
    camera.fov = ctx.aspect < 1 ? FOV + (1 - ctx.aspect) * 18 : FOV;
    camera.updateProjectionMatrix();
  };

  readColours(true);
  setScale();

  return {
    scene,
    camera,

    goTo(stop, { instant }) {
      const [p, l] = VIEWS[stop];
      goalPosition.set(p[0], p[1], p[2]);
      goalLook.set(l[0], l[1], l[2]);
      if (instant) {
        position.copy(goalPosition);
        look.copy(goalLook);
      }
    },

    update({ time, dt, pointer, scroll }) {
      const still = ctx.reducedMotion;

      if (!coloursSettled) {
        colourClock += dt;
        blendColours(ease(14, dt));
        if (colourClock > 0.6) {
          blendColours(1);
          coloursSettled = true;
          colourClock = 0;
        }
      }

      if (still) {
        position.copy(goalPosition);
        look.copy(goalLook);
        sway.set(0, 0, 0);
      } else {
        position.lerp(goalPosition, ease(2.6, dt));
        look.lerp(goalLook, ease(2.6, dt));
        goalSway.set(pointer.x * 0.7, pointer.y * 0.35, 0);
        sway.lerp(goalSway, ease(3, dt));
        material.uniforms.uTime.value = time;
      }

      camera.position.copy(position).add(sway);
      // Reading down a page lowers the view a little.
      camera.position.y -= scroll * 1.2;
      lookNow.copy(look);
      lookNow.y -= scroll * 2.4;
      camera.lookAt(lookNow);

      // With motion on, the waves never stop. With reduced motion the scene
      // is still, and the engine can stop the frame loop.
      return !still || !coloursSettled;
    },

    resize() {
      setScale();
    },

    setDark() {
      readColours(false);
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
};
