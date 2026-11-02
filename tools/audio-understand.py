#!/usr/bin/env python3
"""Structural audio diagnostics. Dependencies: numpy scipy matplotlib imageio-ffmpeg.
Onsets are attacks, chroma similarity is harmonic recurrence; neither labels birds.
Events: JSON list of {time_s, kind}, in recording-relative seconds.
"""
import argparse, hashlib, json, shutil, subprocess
from pathlib import Path
import numpy as np
from scipy import signal
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

SR = 24000

def decode(path, ffmpeg):
    raw = subprocess.run([ffmpeg, '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', 'pipe:1'], check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype='<f4')
    if len(x) < 2048 or not np.isfinite(x).all():
        raise ValueError('Need at least 2048 finite PCM samples')
    return x

def db(x):
    return 20 * np.log10(np.maximum(x, 1e-10))

def blocks(x):
    return np.array([np.sqrt(np.mean(x[i:i+1200].astype(float)**2)) for i in range(0,len(x),1200)])

def analyze(x):
    f,t,z = signal.stft(x, SR, nperseg=2048, noverlap=1536, boundary=None)
    power = np.abs(z)**2
    energy = power.sum(axis=0)
    active = energy > max(1e-12, energy.max()*1e-6)
    centroid = (f[:,None]*power).sum(axis=0)/np.maximum(energy,1e-20)
    # Relative positive log-spectral flux; fixed robust threshold, not event semantics.
    logmag = np.log1p(1000*np.abs(z))
    flux = np.maximum(np.diff(logmag,axis=1,prepend=logmag[:,:1]),0).mean(axis=0)
    median = np.median(flux)
    mad = np.median(np.abs(flux-median))
    peaks,_ = signal.find_peaks(flux, height=max(.004,median+3*mad), prominence=max(.003,2*mad), distance=round(.2/(512/SR)))
    peaks = peaks[active[peaks]]
    # Average pitch-class energy into 2 s blocks; retain silence as missing.
    chroma = np.zeros((12,len(t)))
    valid = (f>=65)&(f<=4000)
    pitch = np.rint(69+12*np.log2(f[valid]/440)).astype(int)%12
    for k in range(12): chroma[k] = power[valid][pitch==k].sum(axis=0)
    n = max(1,int(np.ceil(len(x)/SR/2)))
    c = np.zeros((n,12))
    for i in range(n):
        sel=(t>=2*i)&(t<2*i+2)&active
        if sel.any(): c[i]=chroma[:,sel].mean(axis=1)
    norms=np.linalg.norm(c,axis=1)
    unit=c/np.maximum(norms[:,None],1e-20)
    sim=unit@unit.T
    np.fill_diagonal(sim,np.nan)
    sim[np.abs(np.arange(n)[:,None]-np.arange(n)[None,:])<=1]=np.nan
    sim[(norms==0)[:,None]|(norms==0)[None,:]]=np.nan
    pairs=[]
    for i,j in zip(*np.where(np.triu(np.nan_to_num(sim,nan=-1),2)>.96)):
        pairs.append(dict(first_s=int(i*2),second_s=int(j*2),cosine=float(sim[i,j])))
    bands={}
    total=power[:,active].sum()
    for lo,hi in [(0,150),(150,500),(500,2000),(2000,6000),(6000,12001)]:
        bands[f'{lo}-{hi}Hz']=float(power[(f>=lo)&(f<hi)][:,active].sum()/total) if total else None
    return f,t,z,flux,peaks,sim,dict(onset_times_s=t[peaks].tolist(),onsets_per_minute=len(peaks)*60/(len(x)/SR),onset_label='Generic spectral attacks; not semantic event counts',active_spectral_centroid_median_hz=float(np.median(centroid[active])) if active.any() else None,spectral_energy_fraction=bands,harmonic_recurrence_pairs=pairs[:100],recurrence_label='2 s chroma cosine > .96, excludes adjacent/silent blocks; harmonic recurrence does not prove waveform repetition')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('input',type=Path);p.add_argument('--out',type=Path,required=True)
    p.add_argument('--events',type=Path);p.add_argument('--music',type=Path);p.add_argument('--sfx',type=Path)
    p.add_argument('--provenance',default='Unspecified; do not infer runtime SHA or reference identity')
    a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    ff=shutil.which('ffmpeg')
    if not ff:
        import imageio_ffmpeg
        ff=imageio_ffmpeg.get_ffmpeg_exe()
    x=decode(a.input,ff); f,t,z,flux,peaks,sim,report=analyze(x)
    rms=blocks(x); duration=len(x)/SR
    envelope=rms-rms.mean()
    correlation=signal.correlate(envelope,envelope,mode='full',method='fft')[len(envelope)-1:]
    if correlation[0]>1e-20:
        correlation=correlation/correlation[0]
        lag_peaks,_=signal.find_peaks(correlation[5:min(len(correlation),601)],prominence=.03)
        lag_peaks=lag_peaks+5
        ranked=sorted(lag_peaks,key=lambda i:correlation[i],reverse=True)[:8]
        report['envelope_recurrence']=dict(label='Normalized RMS autocorrelation, lags .25-30s; can reflect movement rhythm or shared ambience, not sample identity',peaks=[dict(lag_s=float(i*.05),correlation=float(correlation[i])) for i in ranked])
    report.update(input=str(a.input.resolve()),sha256=hashlib.sha256(a.input.read_bytes()).hexdigest(),provenance=a.provenance,duration_s=duration,sample_rate=SR,channel_label='Mono downmix for spectral analysis; use audio-meter.py for stereo peaks/LUFS',rms_dbfs=float(db(np.sqrt(np.mean(x.astype(float)**2)))),peak_dbfs=float(db(np.max(np.abs(x)))),below_minus60_rms_seconds=float(np.sum(np.minimum(.05,np.maximum(0,duration-np.arange(len(rms))*.05))[rms<.001])))
    if a.events:
        events=json.loads(a.events.read_text()); grouped={}
        for e in events:
            stamp=float(e['time_s'])
            if not 0<=stamp<=duration: raise ValueError('Event outside recording interval')
            grouped.setdefault(e['kind'],[]).append(stamp)
        report['instrumented_events']={k:dict(count=len(v),per_minute=len(v)*60/duration,times_s=sorted(v),gaps_s=np.diff(sorted(v)).tolist()) for k,v in grouped.items()}
    if bool(a.music)!=bool(a.sfx): raise ValueError('Supply both aligned stems')
    if a.music:
        music=decode(a.music,ff);sfx=decode(a.sfx,ff)
        if abs(len(music)-len(x))>1200 or abs(len(sfx)-len(x))>1200: raise ValueError('Stem lengths differ by >50ms; supply aligned stems')
        m=blocks(music);s=blocks(sfx);n=min(len(m),len(s));valid=(m[:n]>.001)&(s[:n]>.00001)
        report['stem_balance']=dict(label='Aligned 50ms windows; SFX minus music RMS where music >-60dBFS and SFX >-100dBFS',windows=int(valid.sum()),median_sfx_minus_music_db=float(np.median(db(s[:n][valid])-db(m[:n][valid]))) if valid.any() else None)
    fig,axes=plt.subplots(4,1,figsize=(15,14),layout='constrained')
    axes[0].pcolormesh(t,f,db(np.abs(z)),vmin=-90,vmax=-15,cmap='magma',shading='auto');axes[0].set(yscale='log',ylim=(50,12000),ylabel='Hz',title='Absolute amplitude spectrogram (dBFS, fixed -90 to -15 scale)')
    axes[1].plot(np.arange(len(rms))*.05,db(rms),lw=.8);axes[1].set(ylim=(-100,0),ylabel='50ms RMS dBFS',xlim=(0,duration))
    axes[2].plot(t,flux,lw=.6);axes[2].scatter(t[peaks],flux[peaks],s=12,color='red');axes[2].set(ylabel='Positive spectral flux',xlabel='Recording seconds',title='Detected attacks; no bird/music classification')
    axes[3].imshow(sim,vmin=0,vmax=1,origin='lower',extent=(0,len(sim)*2,0,len(sim)*2),cmap='viridis',aspect='auto');axes[3].set(xlabel='Seconds',ylabel='Seconds',title='Harmonic recurrence (2s chroma; masked neighbors/silence)')
    fig.suptitle(a.input.name);fig.savefig(a.out/'diagnostics.png',dpi=130);plt.close(fig)
    (a.out/'analysis.json').write_text(json.dumps(report,indent=2,allow_nan=False))
    print(json.dumps({k:v for k,v in report.items() if k not in ['onset_times_s','harmonic_recurrence_pairs']},indent=2))
if __name__=='__main__':main()
