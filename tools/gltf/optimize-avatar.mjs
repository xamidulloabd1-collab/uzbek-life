// node optimize.mjs in.glb out.glb [--keep-anims] : strip non-rotation channels (except pelvis), resample, prune, meshopt
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup, reorder, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
const [, , inp, out] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(inp);
const root = doc.getRoot();
let removed = 0;
for (const anim of root.listAnimations()) {
  for (const ch of anim.listChannels()) {
    const n = ch.getTargetNode();
    const keep = ch.getTargetPath() === 'rotation' || (n && /Pelvis$/.test(n.getName()) && ch.getTargetPath() === 'translation');
    if (!keep) { const s = ch.getSampler(); ch.dispose(); s && s.dispose(); removed++; }
  }
}
console.log('removed channels', removed);
await doc.transform(
  resample({ tolerance: 0.0008 }),
  prune(), dedup(),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizeNormal: 10, quantizeTexcoord: 14, quantizePosition: 14 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(out, doc);
