import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/** filmic grade applied after tone mapping: contrast, saturation, warm highlights, cool shadows, soft vignette */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.06 },
    saturation: { value: 1.12 },
    gain: { value: new THREE.Vector3(1.03, 1.0, 0.96) },
    lift: { value: new THREE.Vector3(0.0, 0.006, 0.016) },
    vignette: { value: 0.22 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; uniform vec3 gain; uniform vec3 lift; uniform float vignette; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = (c.rgb - 0.5) * contrast + 0.5;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = col * gain + lift * (1.0 - col);
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * dot(d, d) * 1.6;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

export interface PostOptions {
  ao: boolean;
  bloom: boolean;
  msaa: number;
  smaa: boolean;
}

/** When every effect is off the renderer draws straight to the screen (cheapest path, used on phones). */
export class PostFX {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
  enabled = false;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {}

  configure(o: PostOptions) {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    this.grade = null;
    this.enabled = o.ao || o.bloom || o.msaa > 0 || o.smaa;
    // filmic AgX + grade on the post path; ACES when drawing straight to screen (phones)
    this.renderer.toneMapping = this.enabled ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
    if (!this.enabled) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: o.msaa });
    const c = new EffectComposer(this.renderer, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    if (o.ao) {
      const ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.9;
      ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      c.addPass(ao);
    }
    if (o.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.12, 0.4, 0.95);
      c.addPass(this.bloom);
    }
    c.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    c.addPass(this.grade);
    if (o.smaa) c.addPass(new SMAAPass(size.x, size.y));
    this.composer = c;
  }

  setNight(night: number, rain = 0) {
    if (this.bloom) {
      this.bloom.strength = 0.1 + night * 0.38;
      this.bloom.threshold = 0.95 - night * 0.22;
    }
    if (this.grade) {
      const u = this.grade.uniforms;
      u.saturation.value = 1.12 - night * 0.2 - rain * 0.22;
      u.contrast.value = 1.06 - rain * 0.04;
      (u.gain.value as THREE.Vector3).set(1.03 - night * 0.07, 1.0 - night * 0.02, 0.96 + night * 0.09);
      (u.lift.value as THREE.Vector3).set(0, 0.006 + night * 0.002, 0.016 + night * 0.012);
    }
  }

  setSize(w: number, h: number) {
    if (!this.composer) return;
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
  }

  render(dt: number) {
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
