import type { Group } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Models come from Blender (scripts/blender) as .glb files in public/models,
 * compressed with meshopt.
 */

let loader: GLTFLoader | null = null;
const models = new Map<string, Promise<Group>>();

/**
 * Load `/models/<name>.glb`. Each file downloads once; later calls get the
 * same scene graph, so clone it if you need more than one copy.
 */
export function loadModel(name: string): Promise<Group> {
  let model = models.get(name);
  if (!model) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    model = loader.loadAsync(`/models/${name}.glb`).then((gltf) => gltf.scene);
    // Do not keep a failed download: the next call can try again.
    model.catch(() => models.delete(name));
    models.set(name, model);
  }
  return model;
}
