// The AutoSous mark: a chef's toque drawn with three.js. It floats, its
// pleated crown breathes, it leans towards the pointer and tips itself when
// the menu opens. The halo underneath changes colour and pace with the most
// serious open alert, and the gold gear on the band spins faster when
// something is urgent.
import type * as ThreeTypes from "three";

export type MascotMood = "calm" | "info" | "warning" | "urgent";
export type Mascot = {
  setMood: (mood: MascotMood) => void;
  setOpen: (open: boolean) => void;
  // Working on an answer: the gear spins and the hat bobs a little faster.
  setBusy: (busy: boolean) => void;
  pointer: (x: number, y: number) => void;
  wave: () => void;
  destroy: () => void;
};

const HALO: Record<MascotMood, number> = {
  calm: 0x7fb59a,
  info: 0x7fa7c9,
  warning: 0xe0a443,
  urgent: 0xe05a4f,
};

export function createMascot(
  canvas: HTMLCanvasElement,
  THREE: typeof ThreeTypes,
  options: { reducedMotion: boolean },
): Mascot {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const size = () => {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width || 76, height || 76, false);
  };
  size();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.1, 7.4);
  camera.lookAt(0, 0.55, 0);

  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x31424c, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9d8e0, 0.8);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const disposables: { dispose: () => void }[] = [];
  const mat = (color: number, extra: ThreeTypes.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    disposables.push(m);
    return m;
  };
  const geo = <T extends ThreeTypes.BufferGeometry>(g: T) => {
    disposables.push(g);
    return g;
  };

  const hat = new THREE.Group();
  scene.add(hat);
  const white = mat(0xfdfcf8, { roughness: 0.85 });
  const shade = mat(0xf1eee6, { roughness: 0.9 });

  // Band: a tall cylinder with a navy ribbon round the bottom edge.
  const band = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.95, 1, 0.9, 64, 1, true)), white);
  band.position.y = 0;
  hat.add(band);
  const rimGeo = geo(new THREE.TorusGeometry(1.0, 0.07, 12, 64));
  const brim = new THREE.Mesh(rimGeo, shade);
  brim.rotation.x = Math.PI / 2;
  brim.position.y = -0.45;
  hat.add(brim);
  const ribbon = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(1.005, 1.012, 0.16, 64, 1, true)),
    mat(0x1f3640, { roughness: 0.5 }),
  );
  ribbon.position.y = -0.28;
  hat.add(ribbon);

  // Pleats running up the band.
  const pleatGeo = geo(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const p = new THREE.Mesh(pleatGeo, shade);
    p.position.set(Math.cos(a) * 0.975, 0.14, Math.sin(a) * 0.975);
    hat.add(p);
  }

  // Crown: a ring of puffs around a domed top, each breathing on its own.
  const crown = new THREE.Group();
  crown.position.y = 0.45;
  hat.add(crown);
  const puffGeo = geo(new THREE.SphereGeometry(0.55, 32, 24));
  const puffs: { mesh: ThreeTypes.Mesh; phase: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const mesh = new THREE.Mesh(puffGeo, white);
    mesh.position.set(Math.cos(a) * 0.68, 0.42, Math.sin(a) * 0.68);
    crown.add(mesh);
    puffs.push({ mesh, phase: i * 0.9 });
  }
  const top = new THREE.Mesh(geo(new THREE.SphereGeometry(0.72, 36, 28)), white);
  top.position.y = 0.72;
  crown.add(top);
  puffs.push({ mesh: top, phase: 0.4 });

  // Gold gear badge on the front of the band: the kitchen's machinery.
  const gear = new THREE.Group();
  gear.position.set(0, 0.06, 1.0);
  gear.scale.setScalar(0.9);
  hat.add(gear);
  const gold = mat(0xc9a24a, { metalness: 0.65, roughness: 0.32 });
  gear.add(new THREE.Mesh(geo(new THREE.TorusGeometry(0.16, 0.06, 12, 28)), gold));
  const tooth = geo(new THREE.BoxGeometry(0.09, 0.1, 0.08));
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(tooth, gold);
    const a = (i / 8) * Math.PI * 2;
    t.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0);
    t.rotation.z = a;
    gear.add(t);
  }

  // Halo ring under the hat.
  const haloMat = new THREE.MeshBasicMaterial({ color: HALO.calm, transparent: true, opacity: 0.55 });
  disposables.push(haloMat);
  const halo = new THREE.Mesh(geo(new THREE.TorusGeometry(1.35, 0.06, 12, 72)), haloMat);
  halo.rotation.x = Math.PI / 2.2;
  halo.position.y = -0.95;
  scene.add(halo);

  let mood: MascotMood = "calm";
  let open = false;
  let busy = false;
  let target = { x: 0, y: 0 };
  let waveStart = -10;
  let frame = 0;
  let baseY = 0;
  let stopped = false;
  const clock = new THREE.Clock();
  const color = new THREE.Color(HALO.calm);
  const next = new THREE.Color();

  const render = () => {
    const t = clock.getElapsedTime();
    const urgent = mood === "urgent";
    // Float, with a small hop now and then when something is urgent.
    const hop = urgent ? Math.max(0, Math.sin(t * 1.4)) ** 12 * 0.3 : 0;
    const w = t - waveStart;
    // Wave: a quick bounce and full turn when tapped or new alerts arrive.
    const bounce = w < 0.9 ? Math.sin((w / 0.9) * Math.PI) * 0.35 : 0;
    hat.position.y = Math.sin(t * (busy ? 5 : 2)) * (busy ? 0.05 : 0.07) + hop + bounce;
    const spin = w < 0.9 ? (1 - Math.cos((w / 0.9) * Math.PI)) * Math.PI : 0;
    // Lean towards the pointer; tip the hat when the menu is open.
    const leanY = open ? -0.5 : target.x * 0.6;
    const leanX = open ? 0.1 : target.y * 0.25;
    const tipZ = open ? 0.32 : Math.sin(t * 1.3) * 0.04;
    baseY += (leanY - baseY) * 0.08;
    hat.rotation.y = baseY + spin;
    hat.rotation.x += (leanX - hat.rotation.x) * 0.08;
    hat.rotation.z += (tipZ - hat.rotation.z) * 0.1;
    // The crown breathes.
    for (const p of puffs) p.mesh.scale.setScalar(1 + Math.sin(t * 1.8 + p.phase) * 0.035);
    crown.position.y = 0.45 + Math.sin(t * 1.8) * 0.02;
    gear.rotation.z = -t * (busy ? 5 : urgent ? 2.6 : 0.8);
    // Halo colour and pulse.
    color.lerp(next.setHex(HALO[mood]), 0.08);
    haloMat.color.copy(color);
    const pace = urgent ? 5 : mood === "warning" ? 3 : 1.5;
    haloMat.opacity = 0.35 + (Math.sin(t * pace) + 1) * 0.2;
    halo.scale.setScalar(1 + (Math.sin(t * pace) + 1) * (urgent ? 0.05 : 0.02));
    renderer.render(scene, camera);
  };
  const loop = () => {
    if (stopped) return;
    render();
    frame = requestAnimationFrame(loop);
  };
  if (options.reducedMotion) render();
  else loop();
  const observer = new ResizeObserver(() => {
    size();
    if (options.reducedMotion) render();
  });
  observer.observe(canvas);

  return {
    setMood(value) {
      mood = value;
      if (options.reducedMotion) render();
    },
    setOpen(value) {
      open = value;
      if (options.reducedMotion) {
        hat.rotation.z = open ? 0.32 : 0;
        render();
      }
    },
    setBusy(value) {
      busy = value;
      if (options.reducedMotion) render();
    },
    pointer(x, y) {
      target = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    },
    wave() {
      if (!options.reducedMotion) waveStart = clock.getElapsedTime();
    },
    destroy() {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
}
