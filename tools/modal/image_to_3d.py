"""Temporary GPU generation. Run: modal run tools/modal/image_to_3d.py
Use --model hunyuan for fallback, --fetch-only to retrieve durable outputs without GPU.
No deploy: the app and GPU shut down after the local entrypoint returns.
"""
from pathlib import Path
import modal

app = modal.App('hero-sol-image-to-3d')
cache = modal.Volume.from_name('hero-sol-model-cache', create_if_missing=True)
image = (
    modal.Image.from_registry('nvidia/cuda:12.1.1-devel-ubuntu22.04', add_python='3.10')
    .apt_install('git', 'build-essential', 'libgl1', 'libglib2.0-0', 'libegl1', 'libgles2', 'libxrender1')
    .pip_install('torch==2.4.0', 'torchvision==0.19.0', index_url='https://download.pytorch.org/whl/cu121')
    .pip_install('numpy<2', 'pillow', 'imageio', 'imageio-ffmpeg', 'tqdm', 'easydict', 'opencv-python-headless<4.12', 'scipy', 'ninja', 'rembg', 'onnxruntime', 'trimesh', 'open3d', 'xatlas', 'pyvista', 'pymeshfix==0.17.0', 'igraph', 'transformers==4.46.3', 'huggingface_hub<1', 'accelerate', 'safetensors', 'spconv-cu120', 'xformers==0.0.27.post2')
    .run_commands('git clone --recursive https://github.com/microsoft/TRELLIS.git /opt/TRELLIS', 'pip install git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8')
    .env({'CUDA_HOME':'/usr/local/cuda', 'TORCH_CUDA_ARCH_LIST':'8.0', 'MAX_JOBS':'4', 'CC':'gcc', 'CXX':'g++'})
    .run_commands('pip install --no-build-isolation git+https://github.com/NVlabs/nvdiffrast.git@v0.3.3', 'git clone --recursive https://github.com/autonomousvision/mip-splatting.git /opt/mip-splatting', 'pip install --no-build-isolation /opt/mip-splatting/submodules/diff-gaussian-rasterization', 'git clone --recursive https://github.com/JeffreyXiang/diffoctreerast.git /opt/diffoctreerast', 'pip install --no-build-isolation /opt/diffoctreerast')
    .apt_install('libusb-1.0-0')
    .pip_install('numpy<2')
    .run_commands('pip install kaolin==0.17.0 -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.0_cu121.html')
    .env({'PYTHONPATH':'/opt/TRELLIS', 'ATTN_BACKEND':'xformers', 'SPCONV_ALGO':'native', 'HF_HOME':'/cache/huggingface'})
)

@app.function(image=image, gpu='A100', timeout=900, volumes={'/cache':cache}, scaledown_window=2)
def generate(source: bytes, seed: int = 42) -> dict:
    import io, os, time, json, subprocess, hashlib
    from PIL import Image
    import torch
    from trellis.pipelines import TrellisImageTo3DPipeline
    from trellis.utils import postprocessing_utils
    started = time.time()
    pipe = TrellisImageTo3DPipeline.from_pretrained('microsoft/TRELLIS-image-large')
    pipe.cuda()
    conditioning = pipe.preprocess_image(Image.open(io.BytesIO(source)))
    result = pipe.run(conditioning, seed=seed, preprocess_image=False)
    mesh = result['mesh'][0]
    count = len(mesh.faces)
    print(f'Raw triangles: {count}')
    glb = postprocessing_utils.to_glb(result['gaussian'][0], mesh, simplify=max(0.0, 1-28000/count), texture_size=2048)
    glb.export('/tmp/fox.glb')
    print(f'Elapsed GPU job seconds: {time.time()-started:.1f}; final faces: {len(glb.faces)}')
    folder = Path('/cache/outputs')
    folder.mkdir(exist_ok=True)
    blob = Path('/tmp/fox.glb').read_bytes()
    (folder/f'fox_trellis_seed{seed}.glb').write_bytes(blob)
    conditioning.save(folder/f'conditioning_seed{seed}.png')
    metadata = {'model':'microsoft/TRELLIS-image-large', 'seed':seed, 'gpu':torch.cuda.get_device_name(), 'raw_triangles':count, 'final_triangles':len(glb.faces), 'texture_size':2048, 'bytes':len(blob), 'gpu_job_seconds':round(time.time()-started,1), 'trellis_commit':subprocess.check_output(['git','-C','/opt/TRELLIS','rev-parse','HEAD'],text=True).strip(), 'source_sha256':hashlib.sha256(source).hexdigest(), 'glb_sha256':hashlib.sha256(blob).hexdigest()}
    (folder/f'generation_seed{seed}.json').write_text(json.dumps(metadata,indent=2))
    cache.commit()
    return metadata

# Fallback after TRELLIS produced opaque wisp slabs.
hunyuan_image = (
    image.apt_install('libglu1-mesa', 'libgomp1', 'libopengl0')
    .pip_install('diffusers==0.31.0', 'einops', 'omegaconf', 'pymeshlab', 'pygltflib', 'sentencepiece')
    .env({'CUDA_HOME':'/usr/local/cuda', 'TORCH_CUDA_ARCH_LIST':'8.0', 'MAX_JOBS':'4', 'CC':'gcc', 'CXX':'g++', 'HF_HOME':'/cache/huggingface', 'HY3DGEN_MODELS':'/cache/hy3dgen', 'PYTHONPATH':'/opt/Hunyuan3D-2'})
    .run_commands('git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git /opt/Hunyuan3D-2', 'cd /opt/Hunyuan3D-2/hy3dgen/texgen/custom_rasterizer && pip install --no-build-isolation .', 'cd /opt/Hunyuan3D-2/hy3dgen/texgen/differentiable_renderer && pip install --no-build-isolation .')
)

@app.function(image=hunyuan_image, gpu='A100', timeout=900, volumes={'/cache':cache}, scaledown_window=2)
def generate_hunyuan(source: bytes, seed: int = 42) -> dict:
    import io, time, json, subprocess, hashlib, gc
    import torch, rembg
    from PIL import Image
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, FaceReducer, FloaterRemover, DegenerateFaceRemover
    from hy3dgen.texgen import Hunyuan3DPaintPipeline
    started = time.time()
    torch.manual_seed(seed)
    conditioning = rembg.remove(Image.open(io.BytesIO(source)).convert('RGB'))
    shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2')
    mesh = shape(image=conditioning, num_inference_steps=40, octree_resolution=384, generator=torch.Generator(device='cuda').manual_seed(seed))[0]
    count = len(mesh.faces)
    print(f'Hunyuan raw triangles: {count}', flush=True)
    mesh = FloaterRemover()(mesh)
    mesh = DegenerateFaceRemover()(mesh)
    mesh = FaceReducer()(mesh, max_facenum=28000)
    del shape
    gc.collect(); torch.cuda.empty_cache()
    paint = Hunyuan3DPaintPipeline.from_pretrained('tencent/Hunyuan3D-2')
    mesh = paint(mesh, image=conditioning)
    folder = Path('/cache/outputs'); folder.mkdir(exist_ok=True)
    target=folder/f'fox_hunyuan_seed{seed}.glb'
    mesh.export(str(target))
    conditioning.save(folder/f'conditioning_hunyuan_seed{seed}.png')
    blob=target.read_bytes()
    metadata={'model':'tencent/Hunyuan3D-2', 'paint':'hunyuan3d-paint-v2-0-turbo', 'seed':seed, 'gpu':torch.cuda.get_device_name(), 'raw_triangles':count, 'final_triangles':len(mesh.faces), 'texture_size':2048, 'bytes':len(blob), 'gpu_job_seconds':round(time.time()-started,1), 'hunyuan_commit':subprocess.check_output(['git','-C','/opt/Hunyuan3D-2','rev-parse','HEAD'],text=True).strip(), 'source_sha256':hashlib.sha256(source).hexdigest(), 'glb_sha256':hashlib.sha256(blob).hexdigest()}
    (folder/f'generation_hunyuan_seed{seed}.json').write_text(json.dumps(metadata,indent=2))
    print(metadata,flush=True)
    cache.commit()
    return metadata

@app.function(image=modal.Image.debian_slim(), volumes={'/cache':cache}, timeout=60, scaledown_window=2)
def read_chunk(name: str, offset: int, size: int = 524288) -> bytes:
    with open('/cache/outputs/' + name, 'rb') as f:
        f.seek(offset)
        return f.read(size)

@app.local_entrypoint()
def main(seed: int = 42, fetch_only: bool = False, model: str = "trellis"):
    root = Path(__file__).resolve().parents[2]
    folder = root / 'assets/hero/candidates/sol'
    import json
    if model not in {'trellis', 'hunyuan'}:
        raise ValueError('model must be trellis or hunyuan')
    suffix = f'hunyuan_seed{seed}' if model == 'hunyuan' else f'seed{seed}'
    if fetch_only:
        metadata = json.loads(read_chunk.remote(f'generation_{suffix}.json', 0))
    else:
        fn = generate_hunyuan if model == 'hunyuan' else generate
        metadata = fn.remote((folder/'concept_crop.png').read_bytes(), seed)
    (folder/f'generation_{suffix}.json').write_text(json.dumps(metadata,indent=2))
    mesh_name = f'fox_hunyuan_seed{seed}.glb' if model == 'hunyuan' else f'fox_trellis_seed{seed}.glb'
    for name in [mesh_name, f'conditioning_{suffix}.png']:
        with (folder/name).open('wb') as out:
            offset = 0
            while True:
                chunk = read_chunk.remote(name, offset)
                if not chunk: break
                out.write(chunk)
                offset += len(chunk)
        print(f'Saved {name}: {offset} bytes')
