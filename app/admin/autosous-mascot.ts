// The AutoSous character: a small chef with a hat and a turning gear,
// drawn with three.js. It bobs, blinks, follows the pointer, and its halo
// changes colour and pace with the most serious open alert.
import type * as ThreeTypes from "three";

export type MascotMood = "calm" | "info" | "warning" | "urgent";
export type Mascot = {
  setMood: (mood: MascotMood) => void;
  setOpen: (open: boolean) => void;
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
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.55, 7.2);
  camera.lookAt(0, 0.45, 0);

  scene.add(new THREE.HemisphereLight(0xfff6e5, 0x30404a, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2.5, 4, 5);
  scene.add(key);

  const disposables: { dispose: () => void }[] = [];
  const mat = (color: number, extra: ThreeTypes.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...extra });
    disposables.push(m);
    return m;
  };
  const geo = <T extends ThreeTypes.BufferGeometry>(g: T) => {
    disposables.push(g);
    return g;
  };

  const character = new THREE.Group();
  scene.add(character);

  const head = new THREE.Mesh(geo(new THREE.SphereGeometry(1, 48, 32)), mat(0xf4dfba));
  character.add(head);

  // Chef hat: a band and a cloud of puffs.
  const hat = new THREE.Group();
  hat.position.y = 0.82;
  character.add(hat);
  const white = mat(0xfdfcf8, { roughness: 0.9 });
  const band = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.72, 0.78, 0.38, 40)), white);
  band.position.y = 0.12;
  hat.add(band);
  const puff = geo(new THREE.SphereGeometry(0.42, 28, 20));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(puff, white);
    p.position.set(Math.cos(a) * 0.42, 0.58, Math.sin(a) * 0.42);
    hat.add(p);
  }
  const crown = new THREE.Mesh(geo(new THREE.SphereGeometry(0.52, 28, 20)), white);
  crown.position.y = 0.78;
  hat.add(crown);

  // A gold gear on the hat band: AutoSous is the kitchen's machinery.
  const gear = new THREE.Group();
  gear.position.set(0.55, 0.14, 0.52);
  gear.rotation.y = 0.75;
  gear.scale.setScalar(0.85);
  hat.add(gear);
  const gold = mat(0xc9a24a, { metalness: 0.6, roughness: 0.35 });
  gear.add(new THREE.Mesh(geo(new THREE.TorusGeometry(0.16, 0.06, 12, 24)), gold));
  const tooth = geo(new THREE.BoxGeometry(0.08, 0.1, 0.08));
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(tooth, gold);
    const a = (i / 8) * Math.PI * 2;
    t.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0);
    t.rotation.z = a;
    gear.add(t);
  }

  // Face.
  const face = new THREE.Group();
  character.add(face);
  const eyeGeo = geo(new THREE.SphereGeometry(0.12, 20, 14));
  const eyeMat = mat(0x1f2b30, { roughness: 0.3 });
  const eyes = [-0.34, 0.34].map((x) => {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.position.set(x, 0.08, 0.92);
    face.add(e);
    const shine = new THREE.Mesh(geo(new THREE.SphereGeometry(0.035, 10, 8)), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }));
    shine.position.set(0.04, 0.05, 0.1);
    e.add(shine);
    return e;
  });
  const cheekMat = mat(0xf0a49a, { transparent: true, opacity: 0.55 });
  for (const x of [-0.58, 0.58]) {
    const c = new THREE.Mesh(geo(new THREE.CircleGeometry(0.13, 20)), cheekMat);
    c.position.set(x, -0.14, 0.82);
    c.lookAt(x * 2.2, -0.3, 3);
    face.add(c);
  }
  const smile = new THREE.Mesh(geo(new THREE.TorusGeometry(0.2, 0.035, 10, 24, Math.PI)), eyeMat);
  smile.position.set(0, -0.2, 0.95);
  smile.rotation.z = Math.PI;
  face.add(smile);

  // Halo ring under the character.
  const haloMat = new THREE.MeshBasicMaterial({ color: HALO.calm, transparent: true, opacity: 0.55 });
  disposables.push(haloMat);
  const halo = new THREE.Mesh(geo(new THREE.TorusGeometry(1.25, 0.06, 12, 64)), haloMat);
  halo.rotation.x = Math.PI / 2.25;
  halo.position.y = -1.05;
  scene.add(halo);

  let mood: MascotMood = "calm";
  let open = false;
  let target = { x: 0, y: 0 };
  let waveStart = -10;
  let nextBlink = 2;
  let frame = 0;
  let stopped = false;
  const clock = new THREE.Clock();
  const color = new THREE.Color(HALO.calm);

  const render = () => {
    const t = clock.getElapsedTime();
    const urgent = mood === "urgent";
    // Idle bob, with a little hop now and then when something is urgent.
    const hop = urgent ? Math.max(0, Math.sin(t * 1.4)) ** 12 * 0.25 : 0;
    character.position.y = Math.sin(t * 2) * 0.06 + hop;
    // Look towards the pointer, or towards the open menu.
    const lookX = open ? -0.45 : target.x * 0.5;
    const lookY = open ? 0.12 : target.y * 0.3;
    character.rotation.y += (lookX - character.rotation.y) * 0.08;
    character.rotation.x += (-lookY - character.rotation.x) * 0.08;
    // Wave: a quick happy wiggle when clicked or when new alerts arrive.
    const w = t - waveStart;
    character.rotation.z = w < 1.2 ? Math.sin(w * 14) * 0.18 * (1 - w / 1.2) : Math.sin(t * 1.3) * 0.03;
    hat.rotation.z = Math.sin(t * 1.6) * 0.05;
    gear.rotation.z = -t * (urgent ? 2.4 : 0.9);
    // Blink.
    if (t > nextBlink) nextBlink = t + 2.5 + Math.random() * 3;
    const blink = nextBlink - t < 0.12 ? 0.15 : 1;
    for (const e of eyes) e.scale.y += (blink - e.scale.y) * 0.5;
    // Halo colour and pulse.
    color.lerp(new THREE.Color(HALO[mood]), 0.08);
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
    setMood(next) {
      mood = next;
      if (options.reducedMotion) render();
    },
    setOpen(next) {
      open = next;
      if (options.reducedMotion) render();
    },
    pointer(x, y) {
      target = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    },
    wave() {
      waveStart = clock.getElapsedTime();
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
