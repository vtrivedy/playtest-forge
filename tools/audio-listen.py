"""Listen to audio with an audio-language model (Qwen2-Audio-7B-Instruct) on a Modal GPU.

The team cannot hear; this gives a semantic second opinion next to the numeric diagnostics
(tools/audio-understand.py): what instruments/sounds are present, whether anything is harsh,
constant or intrusive, how music and effects balance. Clips are split into <=30 s windows (the
model's audio limit) and each window is answered separately.

    modal run tools/audio-listen.py --path mix.wav [--path ref.wav ...] [--question "..."] [--window 30]

Prints one JSON line per window: {file, start_s, end_s, answer}. Answers are model opinions, not ground
truth: always cross-check against the spectrogram/meter and say so when reporting.
"""
import json
import pathlib

import modal

MODEL = "Qwen/Qwen2-Audio-7B-Instruct"
# neutral on purpose: a checklist in the prompt makes the model "hear" every item on it (it reported birds and
# footsteps in a solo harp track when asked about them). Ask for a description, then judge it against the meter.
QUESTION = (
    "Describe this audio in detail: every sound source you can actually hear, how loud each is relative to "
    "the others, how often each occurs, and the overall mood. Only mention sounds that are really present."
)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("torch==2.4.1", "transformers==4.45.2", "accelerate==0.34.2", "librosa==0.10.2.post1", "soundfile")
)
app = modal.App("audio-listen", image=image)
cache = modal.Volume.from_name("audio-listen-hf-cache", create_if_missing=True)


@app.cls(gpu="A10G", volumes={"/root/.cache/huggingface": cache}, timeout=1800, scaledown_window=120)
class Listener:
    @modal.enter()
    def load(self):
        import torch
        from transformers import AutoProcessor, Qwen2AudioForConditionalGeneration

        self.processor = AutoProcessor.from_pretrained(MODEL)
        self.model = Qwen2AudioForConditionalGeneration.from_pretrained(MODEL, torch_dtype=torch.float16, device_map="cuda")
        cache.commit()

    @modal.method()
    def listen(self, data: bytes, question: str, window: float) -> list[dict]:
        import io

        import librosa

        sr = self.processor.feature_extractor.sampling_rate
        audio, _ = librosa.load(io.BytesIO(data), sr=sr, mono=True)
        out = []
        step = int(window * sr)
        for i in range(0, max(1, len(audio)), step):
            chunk = audio[i : i + step]
            if len(chunk) < sr:
                break
            conv = [{"role": "user", "content": [{"type": "audio", "audio_url": "clip"}, {"type": "text", "text": question}]}]
            text = self.processor.apply_chat_template(conv, add_generation_prompt=True, tokenize=False)
            inputs = self.processor(text=text, audios=[chunk], sampling_rate=sr, return_tensors="pt", padding=True).to("cuda")
            inputs["input_features"] = inputs["input_features"].half()
            ids = self.model.generate(**inputs, max_new_tokens=220, do_sample=False)
            ans = self.processor.batch_decode(ids[:, inputs.input_ids.size(1) :], skip_special_tokens=True)[0]
            out.append({"start_s": round(i / sr, 1), "end_s": round((i + len(chunk)) / sr, 1), "answer": ans.strip()})
        return out


@app.local_entrypoint()
def main(path: str, question: str = QUESTION, window: float = 30.0):
    listener = Listener()
    for p in path.split(","):
        for w in listener.listen.remote(pathlib.Path(p).read_bytes(), question, window):
            print(json.dumps({"file": p, **w}))
