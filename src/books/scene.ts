// The 3D bookshelf. Loaded only on /books, and only when the device can draw it.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { casePlan, caseSize, groupByGenre, packCells, shade, shelfTop, SHELF, type Book, type CaseSize } from "./layout";
import { drawLabel, drawPageEdges, drawPlainCover, drawSpine, loadSpineFonts } from "./spine";

export type Quality = "high" | "low";

export interface Placement {
  /** "side": caption to the right of the book. "stack": caption under it. */
  mode: "side" | "stack";
  /** Caption box in CSS pixels, relative to the stage element. */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ShelfOptions {
  quality: Quality;
  dark: boolean;
  onSelect: (book: Book | null, placement: Placement | null) => void;
  /** 0 to 1 while a book is held up: how far the page behind the stage should dim. */
  onDim: (amount: number) => void;
}

export interface Shelf {
  select: (id: string | null) => void;
  setTheme: (dark: boolean) => void;
  dispose: () => void;
  /** Test hook: step the animation without waiting for real frames. */
  advance: (seconds: number) => void;
  /** Test hook: stop the frame loop, so that only `advance` moves time. */
  freeze: (on: boolean) => void;
  selected: () => string | null;
}

const MM = 0.001;
const FOV = 20;
/**
 * Wall above the case and floor in front of it, in metres. The floor margin is
 * measured at the front of the case; the floor itself runs on toward the camera.
 */
const MARGIN = { top: 0.036, floor: 0.11 };
/** The shelf is never drawn larger than this many CSS pixels per metre. */
const MAX_SCALE = 1150;
const SPINE_SETBACK = 0.016;
/** CSS pixels at the foot of the stage where the floor fades into the page. */
export const FLOOR_FADE = 64;
/** How dark the shelf and the page go behind an open book. Also used by the CSS backdrop. */
export const DIM = 0.55;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface BookObject {
  book: Book;
  group: THREE.Group;
  home: THREE.Vector3;
  cover: THREE.MeshStandardMaterial;
  hover: number;
  hoverTarget: number;
  /** 0 on the shelf, 1 held up in front of the camera. */
  out: number;
  /** How far the book can tip before its top corner meets the board above. */
  maxLean: number;
  /** Radians the book leans on its neighbour while it stands on the shelf. */
  roll: number;
}

export async function createShelf(
  stage: HTMLElement,
  canvas: HTMLCanvasElement,
  books: Book[],
  opts: ShelfOptions,
): Promise<Shelf> {
  await loadSpineFonts();

  const high = opts.quality === "high";
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !high,
    // The canvas is see-through: the page is the wall, so the two always match.
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 20);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  pmrem.dispose();
  RectAreaLightUniformsLib.init();

  // ---- lights -------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc4b4, 1);
  const key = new THREE.DirectionalLight(0xfff3e2, 2.4);
  key.castShadow = true;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.004;
  key.shadow.radius = high ? 5 : 3;
  const fill = new THREE.DirectionalLight(0xdfe9ff, 0.5);
  // Lights the book that is held up; it comes on as the shelf dims.
  const reading = new THREE.DirectionalLight(0xfff6ea, 0);
  // Stands in for the shelf lights in the dark theme when the case has too many shelves for real ones.
  const wash = new THREE.DirectionalLight(0xffc98f, 0);
  scene.add(hemi, key, key.target, fill, reading, reading.target, wash, wash.target);
  const strips: THREE.RectAreaLight[] = [];
  const glows: THREE.Mesh[] = [];

  // ---- shared textures and materials --------------------------------------
  const loader = new THREE.TextureLoader();
  const wood = (name: string, srgb: boolean) => {
    const t = loader.load(`/textures/bookshelf/${name}.webp`, () => invalidate());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const floorMap = wood("floor-color", true);
  const floorRough = wood("floor-rough", false);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorMap, roughnessMap: floorRough, roughness: 0.82 });
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.5 });
  const woodMap = wood("wood-color", true);
  const woodNormal = wood("wood-normal", false);
  const woodRough = wood("wood-rough", false);
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodMap,
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: woodRough,
    roughness: 0.9,
    color: 0xd9c2ae,
  });
  const backMat = woodMat.clone();
  backMat.color.set(0xa8927f);
  // The case hangs on the page itself, so its shadow on the "wall" is a soft
  // painted one: a real shadow map cannot give a penumbra this wide.
  const shadowMats = [0, 1, 2].map(
    () => new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false }),
  );
  /** A blurred black box: `w` by `h` metres with `spread` metres of blur around it. */
  const softShadow = (w: number, h: number, spread: number) => {
    const px = 360;
    const c = document.createElement("canvas");
    c.width = Math.ceil((w + spread * 2) * px);
    c.height = Math.ceil((h + spread * 2) * px);
    const ctx = c.getContext("2d")!;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = spread * px * 0.85;
    ctx.shadowOffsetX = 4096;
    ctx.fillRect(spread * px - 4096, spread * px, w * px, h * px);
    return new THREE.CanvasTexture(c);
  };
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.42, metalness: 0.65 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8 });
  const edgeTex = new THREE.CanvasTexture(drawPageEdges());
  edgeTex.wrapS = edgeTex.wrapT = THREE.RepeatWrapping;
  edgeTex.colorSpace = THREE.SRGBColorSpace;
  const pageMats = {
    cream: new THREE.MeshStandardMaterial({ map: edgeTex, color: 0xf3ead6, roughness: 0.95 }),
    pulp: new THREE.MeshStandardMaterial({ map: edgeTex, color: 0xe9dab6, roughness: 0.95 }),
  };
  // Darkens what is drawn and leaves the see-through wall alone: the page
  // behind the canvas dims in CSS by the same amount.
  const dimMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });

  const spineTextures = new Map<string, THREE.Texture>();
  const coverTextures = new Map<string, THREE.Texture>();
  const spineTexture = (book: Book) => {
    let t = spineTextures.get(book.id);
    if (!t) {
      t = new THREE.CanvasTexture(drawSpine(book, high ? 4 : 3));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      spineTextures.set(book.id, t);
    }
    return t;
  };
  /** A photo of the real spine replaces the typeset one as soon as it has loaded. */
  const loadSpinePhoto = (book: Book, mat: THREE.MeshStandardMaterial) => {
    if (!book.spine.image) return;
    const photo = loader.load(book.spine.image, () => {
      spineTextures.get(book.id)?.dispose();
      spineTextures.set(book.id, photo);
      mat.map = photo;
      mat.needsUpdate = true;
      invalidate();
    });
    photo.colorSpace = THREE.SRGBColorSpace;
    photo.anisotropy = maxAniso;
  };
  const plainCover = (book: Book) => {
    const t = new THREE.CanvasTexture(drawPlainCover(book));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const loadCover = (o: BookObject) => {
    const { book } = o;
    if (!book.cover || coverTextures.has(book.id)) return;
    const t = loader.load(book.cover, () => {
      o.cover.map = t;
      o.cover.needsUpdate = true;
      invalidate();
    });
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    coverTextures.set(book.id, t);
  };

  // ---- world --------------------------------------------------------------
  const world = new THREE.Group();
  scene.add(world);
  const dimmer = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), dimMat);
  dimmer.visible = false;
  dimmer.renderOrder = 5;
  scene.add(dimmer);

  let objects: BookObject[] = [];
  let size: CaseSize;
  let view = { w: 1, h: 1, cssW: 1, cssH: 1 };
  let camZ = 2;
  /** Tangent of half the vertical field of view. */
  let halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  let depth = 0.2;

  /** Give a box UVs in real-world scale, so the grain is the same size on every board. */
  const worldUv = (g: THREE.BufferGeometry, grain: "x" | "y" | "z", scale: number) => {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const ox = Math.random();
    const oy = Math.random();
    for (let i = 0; i < pos.count; i++) {
      const p = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) };
      const n = { x: Math.abs(nor.getX(i)), y: Math.abs(nor.getY(i)), z: Math.abs(nor.getZ(i)) };
      const normalAxis = n.x >= n.y && n.x >= n.z ? "x" : n.y >= n.z ? "y" : "z";
      const axes = (["x", "y", "z"] as const).filter((a) => a !== normalAxis);
      const along = axes.includes(grain) ? grain : axes[0];
      const across = axes.find((a) => a !== along)!;
      uv.setXY(i, p[across] / scale + ox, p[along] / scale + oy);
    }
  };
  /** A board with eased edges, as planed wood has. */
  const woodBox = (w: number, h: number, d: number, grain: "x" | "y" | "z", mat: THREE.Material, ease = 0.0018) => {
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(ease, w / 2, h / 2, d / 2));
    worldUv(g, grain, 1.25);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const makeBook = (book: Book): BookObject => {
    const w = book.w * MM;
    const h = book.h * MM;
    const t = book.t * MM;
    const hard = book.format === "hardcover";
    const board = hard ? 0.0026 : 0.0005;
    const over = hard ? 0.003 : 0;
    const gap = hard ? 0.0035 : 0.0005;
    const bulge = hard ? Math.min(0.0035, t * 0.1) : 0;
    const group = new THREE.Group();

    const jacket = new THREE.MeshStandardMaterial({ color: book.spine.bg, roughness: hard ? 0.5 : 0.62 });
    const inside = new THREE.MeshStandardMaterial({ color: shade(book.spine.bg, 0.75), roughness: 0.9 });
    const cover = new THREE.MeshStandardMaterial({ map: plainCover(book), roughness: hard ? 0.42 : 0.55 });
    const spineMat = new THREE.MeshStandardMaterial({
      map: spineTexture(book),
      roughness: hard ? 0.5 : 0.62,
      side: THREE.DoubleSide,
    });

    loadSpinePhoto(book, spineMat);

    // Page block. The stripes run across the thickness on every visible edge.
    const pw = w - gap - over;
    const pg = new THREE.BoxGeometry(pw, h - over * 2, t - board * 2);
    {
      const pos = pg.attributes.position;
      const nor = pg.attributes.normal;
      const uv = pg.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const other = Math.abs(nor.getY(i)) > 0.5 ? pos.getX(i) : pos.getY(i);
        uv.setXY(i, pos.getZ(i) / 0.02 + t * 37, other / 0.05);
      }
    }
    const pages = new THREE.Mesh(pg, hard ? pageMats.cream : pageMats.pulp);
    pages.position.x = -w / 2 + gap + pw / 2;

    // A board is one box: its four edges are one draw call, its two faces one each.
    const boardBox = () => {
      const g = new THREE.BoxGeometry(w, h, board);
      g.clearGroups();
      g.addGroup(0, 24, 0);
      g.addGroup(24, 6, 1);
      g.addGroup(30, 6, 2);
      return g;
    };
    const front = new THREE.Mesh(boardBox(), [jacket, cover, inside]);
    front.position.z = t / 2 - board / 2;
    const back = new THREE.Mesh(boardBox(), [jacket, inside, jacket]);
    back.position.z = -t / 2 + board / 2;

    // Spine: a strip across the thickness, rounded on a hardcover.
    const sg = new THREE.PlaneGeometry(t, h, hard ? 10 : 1, 1);
    sg.rotateY(-Math.PI / 2);
    const sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const k = (2 * sp.getZ(i)) / t;
      sp.setX(i, -w / 2 - bulge * (1 - k * k));
    }
    sg.computeVertexNormals();
    const spine = new THREE.Mesh(sg, spineMat);

    for (const m of [pages, front, back, spine]) {
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
    group.userData.bookId = book.id;
    return {
      book,
      group,
      home: new THREE.Vector3(),
      cover,
      hover: 0,
      hoverTarget: 0,
      out: 0,
      maxLean: 0.44,
      roll: 0,
    };
  };

  const disposeWorld = () => {
    world.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const shared: THREE.Material[] = [woodMat, backMat, floorMat, paintMat, ...shadowMats, steelMat, pageMats.cream, pageMats.pulp, glowMat];
        if (shared.includes(mat)) continue;
        const std = mat as THREE.MeshStandardMaterial;
        // Spine and cover textures are cached across rebuilds; label and plain-cover ones are not.
        const map = std.map;
        if (map && ![...spineTextures.values(), ...coverTextures.values()].includes(map)) map.dispose();
        std.dispose();
      }
    });
    world.clear();
    for (const s of strips) scene.remove(s);
    strips.length = 0;
    glows.length = 0;
  };

  let builtFor = -1;
  let floorY = 0;
  let realStrips = true;
  const build = (cssW: number) => {
    const plan = casePlan(cssW);
    // A real shelf is never perfectly dressed: each book sits a few millimetres in or out.
    const nudge = (id: string) => {
      let h = 9;
      for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
      return ((h % 1000) / 1000 - 0.5) * 0.007;
    };
    const cells = packCells(groupByGenre(books), plan.cell, plan.bays);
    size = caseSize(cells, plan.cell, plan.bays);

    const outer = size.outer * MM;
    const cellW = size.cell * MM;
    const board = size.board * MM;
    const topT = size.top * MM;
    const over = size.overhang * MM;
    const side = size.side * MM;
    const clear = size.clear * MM;
    const plinth = size.plinth * MM;
    const H = size.height * MM;
    depth = size.depth * MM;

    const scale = Math.min(MAX_SCALE, cssW / (outer + over * 2 + plan.marginSide * 2));
    const totalH = H + MARGIN.top + MARGIN.floor;
    view = { w: cssW / scale, h: totalH, cssW, cssH: Math.round(totalH * scale) };
    const top = view.h / 2 - MARGIN.top;
    floorY = top - H;
    const level = (i: number) => floorY + shelfTop(size, i) * MM;

    // Books are kept across a rebuild; only the case around them is made again.
    const previous = new Map(objects.map((o) => [o.book.id, o]));
    for (const o of objects) world.remove(o.group);
    disposeWorld();
    objects = [];

    // Camera: the case, the wall above it and a strip of floor fill the view.
    // It stands back far enough that a wide, low case is not seen at a steep angle.
    const dist = Math.max(view.h, view.w * 0.8) / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    halfTan = view.h / 2 / dist;
    camZ = depth + dist;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfTan));
    camera.aspect = view.w / view.h;
    camera.near = Math.max(0.1, dist - 1.2);
    camera.far = camZ + 2;
    camera.updateProjectionMatrix();

    // ---- room: floor, skirting, and the shadows of the case on both ---------
    // The floor runs from the wall to where it leaves the bottom of the view.
    const floorD = depth + (MARGIN.floor / halfTan) * 1.15 + 0.1;
    const floorW = view.w * 1.2 + 0.2;
    const fg = new THREE.PlaneGeometry(floorW, floorD);
    fg.rotateX(-Math.PI / 2);
    {
      const pos = fg.attributes.position;
      const uv = fg.attributes.uv;
      // Planks run from the wall toward the camera. One tile of the texture is 1.7 m.
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.7 + 0.37, pos.getZ(i) / 1.7);
    }
    const floor = new THREE.Mesh(fg, floorMat);
    floor.position.set(0, floorY, floorD / 2);
    floor.receiveShadow = true;
    world.add(floor);

    for (const sx of [-1, 1]) {
      const len = (floorW - outer) / 2;
      const skirt = new THREE.Mesh(new RoundedBoxGeometry(len, 0.088, 0.015, 2, 0.004), paintMat);
      skirt.position.set(sx * (outer / 2 + len / 2), floorY + 0.044, 0.0075);
      skirt.castShadow = true;
      skirt.receiveShadow = true;
      world.add(skirt);
    }

    // Shadow of the case on the wall: a wide soft one and a tight one near the edges.
    [
      { spread: 0.05, inset: 0.012, dx: 0.008, dy: -0.024 },
      { spread: 0.012, inset: 0.004, dx: 0.002, dy: -0.005 },
    ].forEach(({ spread, inset, dx, dy }, i) => {
      const w = outer + over * 2 - inset * 2;
      const h = H - inset * 2;
      shadowMats[i].map?.dispose();
      shadowMats[i].map = softShadow(w, h, spread);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w + spread * 2, h + spread * 2), shadowMats[i]);
      m.position.set(dx, floorY + H / 2 + dy, 0.001 + i * 0.0005);
      m.renderOrder = -4 + i;
      world.add(m);
    });
    // Where the case stands on the floor: a soft dark pool, deepest under the front edge.
    {
      const spread = 0.045;
      shadowMats[2].map?.dispose();
      shadowMats[2].map = softShadow(outer - 0.01, depth, spread);
      const g = new THREE.PlaneGeometry(outer - 0.01 + spread * 2, depth + spread * 2);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, shadowMats[2]);
      m.position.set(0.004, floorY + 0.0006, depth / 2 + 0.012);
      m.renderOrder = -1;
      world.add(m);
    }

    // ---- case ----------------------------------------------------------------
    const add = (m: THREE.Mesh, x: number, y: number, z: number) => {
      m.position.set(x, y, z);
      world.add(m);
      return m;
    };
    const left = -outer / 2;
    const bodyH = H - topT;
    // Sides stand on the floor; the uprights between the bays stand on the bottom boards.
    for (const sx of [-1, 1]) {
      add(woodBox(side, bodyH, depth, "y", woodMat), (sx * (outer - side)) / 2, floorY + bodyH / 2, depth / 2);
    }
    for (let b = 1; b < size.bays; b++) {
      const h = bodyH - plinth;
      add(
        woodBox(side, h, depth - 0.008, "y", woodMat),
        left + b * (cellW + side) + side / 2,
        floorY + plinth + h / 2,
        0.006 + (depth - 0.008) / 2,
      );
    }
    // The top board stands proud of the sides and the front.
    add(woodBox(outer + over * 2, topT, depth + over, "x", woodMat, 0.003), 0, floorY + H - topT / 2, (depth + over) / 2);
    // The back, and the recessed kick board under the bottom shelf.
    add(woodBox(outer - side * 2, bodyH - plinth, 0.006, "y", backMat, 0.0005), 0, floorY + plinth + (bodyH - plinth) / 2, 0.003);
    add(woodBox(outer - side * 2, plinth, 0.018, "x", woodMat), 0, floorY + plinth / 2, depth - 0.03);

    const boardD = depth - 0.006 - 0.004;
    const boardFront = depth - 0.004;
    const spineZ = depth - SPINE_SETBACK;
    realStrips = size.levels <= 6;

    for (let l = 0; l < size.levels; l++) {
      const y = level(l);
      for (let b = 0; b < size.bays; b++) {
        const x0 = left + side + b * (cellW + side);
        add(woodBox(cellW, board, boardD, "x", woodMat), x0 + cellW / 2, y - board / 2, 0.006 + boardD / 2);
        const cell = cells[l * size.bays + b];
        if (!cell) continue;

        for (const placed of cell.books) {
          const o = previous.get(placed.book.id) ?? makeBook(placed.book);
          const { w, h, t } = placed.book;
          o.home.set(x0 + (placed.x + t / 2) * MM, y + (h * MM) / 2, spineZ - (w * MM) / 2 + nudge(placed.book.id));
          o.roll = placed.lean;
          o.maxLean = 0.44;
          while (o.maxLean > 0.05 && h * MM * Math.cos(o.maxLean) + w * MM * Math.sin(o.maxLean) > clear - 0.003) {
            o.maxLean -= 0.01;
          }
          objects.push(o);
          world.add(o.group);
        }

        for (const px of cell.plates) {
          const plate = new THREE.Shape();
          const ph = 0.125;
          const pd = 0.1;
          const rr = 0.014;
          plate.moveTo(0, 0);
          plate.lineTo(pd, 0);
          plate.lineTo(pd, ph - rr);
          plate.quadraticCurveTo(pd, ph, pd - rr, ph);
          plate.lineTo(rr, ph);
          plate.quadraticCurveTo(0, ph, 0, ph - rr);
          plate.closePath();
          const pg = new THREE.ExtrudeGeometry(plate, { depth: 0.0016, bevelEnabled: false, curveSegments: 8 });
          pg.rotateY(-Math.PI / 2);
          const up = new THREE.Mesh(pg, steelMat);
          up.castShadow = true;
          up.receiveShadow = true;
          add(up, x0 + px * MM + 0.0016, y, spineZ - 0.004 - pd);
        }

        for (const lab of cell.labels) {
          const lw = SHELF.label * MM;
          const lh = lw * (132 / 672);
          const tex = new THREE.CanvasTexture(drawLabel(lab.genre));
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = maxAniso;
          const plain = new THREE.MeshStandardMaterial({ color: 0xb8924a, roughness: 0.4, metalness: 0.8 });
          const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.15 });
          const holder = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, 0.002), [plain, plain, plain, plain, face, plain]);
          holder.castShadow = true;
          add(holder, x0 + lab.x * MM + lw / 2, y - board / 2, boardFront + 0.001);
        }

        const glow = new THREE.Mesh(new THREE.BoxGeometry(cellW - 0.02, 0.0016, 0.006), glowMat);
        add(glow, x0 + cellW / 2, y + clear - 0.0008, depth - 0.03);
        glows.push(glow);
      }

      // Warm strip light under the board above; it is lit only in the dark theme.
      if (realStrips) {
        const inner = outer - side * 2;
        const strip = new THREE.RectAreaLight(0xffc98f, 0, inner - 0.02, 0.012);
        strip.position.set(0, y + clear - 0.004, depth - 0.03);
        strip.lookAt(0, y, depth - 0.11);
        scene.add(strip);
        strips.push(strip);
      }
    }

    // Key light from the upper left; its shadow map is fitted to the case and the floor near it.
    key.position.set(-0.75, 1.35, 1.9).normalize().multiplyScalar(view.h / 2 + 3);
    key.position.y += floorY + H / 2;
    key.target.position.set(0, floorY + H / 2, depth / 2);
    {
      const eye = key.position;
      const inv = new THREE.Matrix4().lookAt(eye, key.target.position, new THREE.Vector3(0, 1, 0)).setPosition(eye).invert();
      const box = new THREE.Box3();
      for (const x of [left - 0.06, -left + 0.3]) {
        for (const y of [floorY, floorY + H + 0.01]) {
          for (const z of [0, depth + 0.16]) box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inv));
        }
      }
      const sc = key.shadow.camera;
      sc.left = box.min.x;
      sc.right = box.max.x;
      sc.bottom = box.min.y;
      sc.top = box.max.y;
      sc.near = Math.max(0.1, -box.max.z - 0.2);
      sc.far = -box.min.z + 0.2;
      sc.updateProjectionMatrix();
      // Share the texels out by the shape of the case: a tall case gets a tall map.
      const budget = (high ? 3072 : 1536) ** 2;
      const ratio = (box.max.x - box.min.x) / (box.max.y - box.min.y);
      const cap = Math.min(4096, renderer.capabilities.maxTextureSize);
      const mw = clamp(Math.round(Math.sqrt(budget * ratio)), 512, cap);
      const mh = clamp(Math.round(budget / mw), 512, cap);
      if (key.shadow.mapSize.x !== mw || key.shadow.mapSize.y !== mh) {
        key.shadow.mapSize.set(mw, mh);
        key.shadow.map?.dispose();
        key.shadow.map = null;
      }
    }
    fill.position.set(1.2, -0.2, 2);
    reading.position.set(-0.5, 0.7, camZ);
    reading.target.position.set(0, 0, depth);
    wash.position.set(0, floorY + H + 1.2, depth + 0.9);
    wash.target.position.set(0, floorY + H / 2, depth);

    // The dimmer hangs just in front of the case and covers the whole view.
    dimmer.scale.set(view.w * 3, view.h * 3, 1);
    dimmer.position.set(0, 0, depth + over + 0.006);
    applyTheme();
    builtFor = cssW;
    if (selectedId) computeTarget();
  };

  // ---- theme --------------------------------------------------------------
  let dark = opts.dark;
  const applyTheme = () => {
    if (dark) {
      shadowMats[0].opacity = 0.55;
      shadowMats[1].opacity = 0.5;
      shadowMats[2].opacity = 0.7;
      hemi.intensity = 0.2;
      hemi.color.set(0xc4cbd8);
      key.intensity = 0.75;
      key.color.set(0xe4dccf);
      fill.intensity = 0.3;
      scene.environmentIntensity = 0.1;
      paintMat.color.set(0x34383c);
      floorMat.color.set(0x9a948c);
      for (const s of strips) s.intensity = 26;
      wash.intensity = realStrips ? 0 : 1.5;
      for (const g of glows) g.visible = true;
    } else {
      shadowMats[0].opacity = 0.22;
      shadowMats[1].opacity = 0.2;
      shadowMats[2].opacity = 0.42;
      hemi.intensity = 1.25;
      hemi.color.set(0xffffff);
      key.intensity = 2.3;
      key.color.set(0xfff3e2);
      fill.intensity = 0.45;
      scene.environmentIntensity = 0.42;
      paintMat.color.set(0xf2efe9);
      floorMat.color.set(0xffffff);
      for (const s of strips) s.intensity = 0;
      wash.intensity = 0;
      for (const g of glows) g.visible = false;
    }
  };

  // ---- post-processing ----------------------------------------------------
  let composer: EffectComposer | null = null;
  let gtao: GTAOPass | null = null;
  if (high) {
    const target = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 4, 4);
    gtao.updateGtaoMaterial({ radius: 0.07, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    gtao.blendIntensity = 0.9;
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
  }

  const resize = () => {
    const cssW = Math.round(stage.clientWidth);
    if (!cssW) return;
    if (cssW !== builtFor) build(cssW);
    stage.style.height = `${view.cssH}px`;
    // Spend a fixed number of pixels, whatever the shape of the case, and stay
    // inside the largest surface the device can draw to.
    const budget = high ? 4.4e6 : 2.6e6;
    const limit = Math.min(renderer.capabilities.maxTextureSize, 8192);
    const dpr = Math.max(
      0.75,
      Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(budget / (view.cssW * view.cssH)),
        limit / view.cssH,
        limit / view.cssW,
      ),
    );
    renderer.setPixelRatio(dpr);
    renderer.setSize(view.cssW, view.cssH, false);
    composer?.setPixelRatio(dpr);
    composer?.setSize(view.cssW, view.cssH);
    invalidate();
  };

  // ---- selection ----------------------------------------------------------
  let selectedId: string | null = null;
  const target = { pos: new THREE.Vector3(), scale: 1, rotX: 0, rotY: 0 };
  let placement: Placement | null = null;

  /** Where the open book hangs: the middle of the part of the stage that is on screen. */
  const computeTarget = () => {
    const o = objects.find((x) => x.book.id === selectedId);
    if (!o) return;
    const rect = stage.getBoundingClientRect();
    const visTop = clamp(-rect.top, 0, view.cssH);
    const visBottom = clamp(window.innerHeight - rect.top, 0, view.cssH);
    const region = { top: visTop, height: Math.max(visBottom - visTop, Math.min(view.cssH, 360)) };
    if (region.top + region.height > view.cssH) region.top = view.cssH - region.height;

    // The floor fades into the page at the foot of the stage; the book stays above that.
    const floorLine = view.cssH - FLOOR_FADE;
    if (region.top + region.height > floorLine) region.height = Math.max(240, floorLine - region.top);

    // On a wide stage the book and its caption keep to a column in the middle.
    const colW = Math.min(view.cssW, 940);
    const col = (view.cssW - colW) / 2;
    const side = colW >= 540;
    const pad = 18;
    const bookBox = side
      ? { cx: col + colW * 0.32, cy: region.top + region.height / 2, w: colW * 0.44, h: region.height - pad * 2 }
      : { cx: view.cssW / 2, cy: region.top + region.height * 0.31, w: view.cssW - pad * 4, h: region.height * 0.58 };
    placement = side
      ? { mode: "side", left: col + colW * 0.585, top: region.top + pad, width: colW * 0.415 - pad, height: region.height - pad * 2 }
      : { mode: "stack", left: pad, top: region.top + region.height * 0.62, width: view.cssW - pad * 2, height: region.height * 0.38 - pad * 0.5 };

    const z = depth + 0.34;
    const halfH = (camZ - z) * halfTan;
    const mPerPx = (halfH * 2) / view.cssH;
    const w = o.book.w * MM;
    const h = o.book.h * MM;
    // The book is turned a touch, so the spine and page edges still read as a
    // book; its footprint on screen is a little wider than the cover.
    const turn = 0.2;
    const wide = w * Math.cos(turn) + o.book.t * MM * Math.sin(turn);
    target.scale = Math.min((bookBox.h * mPerPx) / h, (bookBox.w * mPerPx) / wide, 2.4) * 0.9;
    target.pos.set((bookBox.cx - view.cssW / 2) * mPerPx, (view.cssH / 2 - bookBox.cy) * mPerPx, z);
    target.rotY = Math.atan2(-target.pos.x, camZ - z) + turn;
    target.rotX = Math.atan2(target.pos.y, camZ - z) * -1;
  };

  const select = (id: string | null) => {
    if (id === selectedId) return;
    if (id && !objects.some((o) => o.book.id === id)) return;
    selectedId = id;
    const o = objects.find((x) => x.book.id === id);
    if (o) {
      loadCover(o);
      computeTarget();
    } else placement = null;
    for (const x of objects) x.hoverTarget = 0;
    canvas.style.cursor = "";
    opts.onSelect(o?.book ?? null, placement);
    invalidate();
  };

  // ---- pointer ------------------------------------------------------------
  const pointer = new THREE.Vector2(0, 0);
  const look = new THREE.Vector2(0, 0);
  const ray = new THREE.Raycaster();
  let inside = false;
  let downAt: { x: number; y: number } | null = null;

  const pick = (e: PointerEvent): BookObject | null => {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(objects.map((o) => o.group), true)[0];
    if (!hit) return null;
    let n: THREE.Object3D | null = hit.object;
    while (n && !n.userData.bookId) n = n.parent;
    return objects.find((o) => o.group === n) ?? null;
  };

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    inside = true;
    if (e.pointerType !== "touch" && !selectedId) {
      const o = pick(e);
      for (const x of objects) x.hoverTarget = x === o ? 1 : 0;
      if (o) loadCover(o);
      canvas.style.cursor = o ? "pointer" : "";
    } else if (selectedId) canvas.style.cursor = "pointer";
    invalidate();
  };
  const onLeave = () => {
    inside = false;
    pointer.set(0, 0);
    for (const x of objects) x.hoverTarget = 0;
    invalidate();
  };
  const onDown = (e: PointerEvent) => {
    downAt = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 8) return;
    if (selectedId) return select(null);
    const o = pick(e);
    if (o) select(o.book.id);
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);

  // ---- frame loop: draws only while something moves -------------------------
  let raf = 0;
  let last = 0;
  let disposed = false;
  let frozen = false;
  const tilt = new THREE.Vector2(0, 0);
  let lastDim = 0;

  /**
   * The way a hand takes a book: a finger hooks the top of the spine and tips
   * it out, the book pivots on the bottom edge of its spine, then it slides off
   * the shelf and comes up to the camera.
   */
  const qShelf = new THREE.Quaternion();
  const qOut = new THREE.Quaternion();
  const qRoll = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const place = (o: BookObject) => {
    const g = o.group;
    const w = o.book.w * MM;
    const h = o.book.h * MM;
    const t = o.book.t * MM;
    const p = o.out;
    const tip = smooth(0, 0.26, p);
    const pull = smooth(0.18, 0.55, p);
    const fly = easeInOut(clamp((p - 0.42) / 0.58, 0, 1));
    const lean = Math.min(o.maxLean, tip * 0.44 + o.hover * 0.13) * (1 - fly);
    // A book that leans on its neighbour is set upright as the hand takes hold of it.
    const roll = o.roll * (1 - smooth(0, 0.2, p)) * (1 - o.hover * 0.5);

    // Pivot: the bottom edge of the spine, where the book rests on the board.
    const py = o.home.y - h / 2;
    const pz = o.home.z + w / 2;
    const c = Math.cos(lean);
    const sn = Math.sin(lean);
    // The leaning book turns about its bottom left corner.
    const rx = (t / 2) * (Math.cos(roll) - 1) - (h / 2) * Math.sin(roll);
    const ry = (t / 2) * Math.sin(roll) + (h / 2) * (Math.cos(roll) - 1);
    const y = py + (h / 2) * c + (w / 2) * sn + ry;
    const z = pz + (h / 2) * sn - (w / 2) * c + o.hover * 0.004 + pull * (w + 0.03);
    g.position.set(
      THREE.MathUtils.lerp(o.home.x + rx, target.pos.x, fly),
      THREE.MathUtils.lerp(y, target.pos.y, fly),
      THREE.MathUtils.lerp(z, target.pos.z, fly) + Math.sin(Math.PI * fly) * 0.04,
    );
    const open = o.book.id === selectedId ? 1 : 0;
    qShelf.setFromEuler(euler.set(lean, Math.PI / 2, 0));
    if (roll) qShelf.premultiply(qRoll.setFromAxisAngle(Z_AXIS, roll));
    if (fly > 0) {
      qOut.setFromEuler(euler.set(target.rotX + tilt.y * 0.16 * open, target.rotY + tilt.x * 0.3 * open, 0));
      qShelf.slerp(qOut, fly);
    }
    g.quaternion.copy(qShelf);
    g.scale.setScalar(THREE.MathUtils.lerp(1, target.scale, fly));
  };

  const update = (dt: number) => {
    let active = false;
    const k = 1 - Math.exp(-dt * 9);

    const lookTarget = inside && !selectedId ? pointer : new THREE.Vector2(0, 0);
    look.lerp(lookTarget, 1 - Math.exp(-dt * 4));
    if (look.distanceTo(lookTarget) > 0.002) active = true;
    camera.position.set(look.x * 0.035, look.y * 0.022, camZ);
    camera.lookAt(look.x * 0.006, look.y * 0.004, depth);

    const tiltTarget = inside && selectedId ? pointer : new THREE.Vector2(0, 0);
    tilt.lerp(tiltTarget, 1 - Math.exp(-dt * 5));
    if (tilt.distanceTo(tiltTarget) > 0.002) active = true;

    let dim = 0;
    for (const o of objects) {
      o.hover += (o.hoverTarget - o.hover) * k;
      if (Math.abs(o.hoverTarget - o.hover) > 0.002) active = true;
      else o.hover = o.hoverTarget;
      const goal = o.book.id === selectedId ? 1 : 0;
      if (o.out !== goal) {
        const step = dt / (goal ? 1.4 : 1.0);
        o.out = goal ? Math.min(1, o.out + step) : Math.max(0, o.out - step);
        active = true;
      }
      dim = Math.max(dim, smooth(0.1, 0.8, o.out));
      place(o);
    }
    // The page dims in display space; the scene is dimmed in linear light, so the
    // amount is converted to give the same result on screen.
    dimMat.opacity = 1 - (1 - dim * DIM) ** 2;
    reading.intensity = dim * (dark ? 2.4 : 0.5);
    dimmer.visible = dim > 0.001;
    if (dim !== lastDim) opts.onDim((lastDim = dim));
    return active;
  };

  const render = () => {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  };

  const tick = (now: number) => {
    raf = 0;
    if (disposed || frozen) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const active = update(dt);
    render();
    if (active) raf = requestAnimationFrame(tick);
    else last = 0;
  };
  function invalidate() {
    if (!raf && !disposed && !frozen) raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();
  update(0);
  render();

  return {
    select,
    selected: () => selectedId,
    setTheme(next: boolean) {
      dark = next;
      applyTheme();
      invalidate();
    },
    advance(seconds: number) {
      const steps = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < steps; i++) update(1 / 60);
      render();
    },
    freeze(on: boolean) {
      frozen = on;
      if (!on) invalidate();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      for (const o of objects) world.add(o.group);
      disposeWorld();
      for (const m of shadowMats) m.map?.dispose();
      for (const t of [...spineTextures.values(), ...coverTextures.values(), woodMap, woodNormal, woodRough, floorMap, floorRough, edgeTex]) {
        t.dispose();
      }
      envTarget.dispose();
      composer?.dispose();
      gtao?.dispose();
      renderer.dispose();
    },
  };
}
