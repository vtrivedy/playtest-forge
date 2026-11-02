#!/usr/bin/env python3
"""Fetch published OST previews for analysis, never game assets. Uses audio-understand.py.
Dependencies: numpy scipy matplotlib imageio-ffmpeg. Sources remain in --out only.
"""
import argparse, concurrent.futures, hashlib, importlib.util, json, subprocess, urllib.request
import numpy as np
from pathlib import Path
import imageio_ffmpeg

ALBUMS={1568790780:('alba',{'Along the Path','The Pine Grove','A Summer Night'}),1473635430:('short-hike',{'Hello?','Beach Buds (Short Hike)','Somewhere in the Woods (Short Hike)'})}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    jobs=[];manifest=[]
    for album,(prefix,titles) in ALBUMS.items():
        api=f'https://itunes.apple.com/lookup?id={album}&entity=song'
        metadata=json.load(urllib.request.urlopen(api))
        (a.out/f'{prefix}-metadata.json').write_text(json.dumps(metadata,indent=2))
        for track in metadata['results']:
            if track.get('trackName') not in titles:continue
            slug=prefix+'-'+track['trackName'].split(' (')[0].lower().replace(' ','-').replace('?','')
            source=a.out/(slug+'.m4a');urllib.request.urlretrieve(track['previewUrl'],source)
            manifest.append(dict(slug=slug,title=track['trackName'],artist=track['artistName'],album_id=album,metadata_url=api,preview_url=track['previewUrl'],source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),label='Published OST preview, not gameplay mix'))
            jobs.append((slug,source,'Published OST preview; not gameplay. '+track['trackViewUrl']))
    if len(jobs)!=6:raise ValueError('Expected six official previews; inspect returned metadata')
    root=Path(__file__).resolve().parents[1]
    for slug in ['music-hush-hamlet','music-apple-cider']:
        source=root/'games/fox-spirit/src/opening/sfx'/f'{slug}.ogg'
        manifest.append(dict(slug=slug,source=str(source.relative_to(root)),source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),label='Unscaled existing game source music'))
        jobs.append((slug,source,'Existing game music source, unscaled'))
    spec=importlib.util.spec_from_file_location('audio_understand',root/'tools/audio-understand.py')
    diagnostics=importlib.util.module_from_spec(spec);spec.loader.exec_module(diagnostics)
    def run(job):
        slug,source,provenance=job;wav=a.out/(slug+'-29.9s.wav');dest=a.out/slug
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(source),'-t','29.9','-c:a','pcm_f32le',str(wav)],check=True)
        subprocess.run(['python3',str(root/'tools/audio-understand.py'),str(wav),'--out',str(dest),'--provenance',provenance+'; first29.9s; no normalization'],check=True,stdout=subprocess.DEVNULL)
        report=json.loads((dest/'analysis.json').read_text());report['crest_db']=report['peak_dbfs']-report['rms_dbfs']
        levels=diagnostics.db(diagnostics.blocks(diagnostics.decode(wav,imageio_ffmpeg.get_ffmpeg_exe())))
        report['rms_p90_minus_p10_db']=float(np.percentile(levels,90)-np.percentile(levels,10))
        report['fraction_50ms_below_minus40_dbfs']=float(np.mean(levels<-40))
        return dict(slug=slug,**report)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:reports=list(pool.map(run,jobs))
    (a.out/'manifest.json').write_text(json.dumps(manifest,indent=2))
    (a.out/'comparison.json').write_text(json.dumps(reports,indent=2))
    for d in reports:print(d['slug'],round(d['rms_dbfs'],1),round(d['crest_db'],1),round(d['onsets_per_minute'],1),round(d['active_spectral_centroid_median_hz']))
if __name__=='__main__':main()
