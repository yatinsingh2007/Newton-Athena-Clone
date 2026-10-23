import { useEffect, useRef } from 'react'

// Live microphone level, drawn straight to the DOM each frame to avoid re-rendering.
export function MicMeter({ stream }) {
  const barRef = useRef(null)

  useEffect(() => {
    if (!stream?.getAudioTracks().length) return
    const audio = new AudioContext()
    const analyser = audio.createAnalyser()
    analyser.fftSize = 512
    audio.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    let frame

    const draw = () => {
      analyser.getFloatTimeDomainData(samples)
      const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length)
      const level = Math.min(1, rms * 6)
      if (barRef.current) barRef.current.style.transform = `scaleX(${level})`
      frame = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(frame)
      audio.close()
    }
  }, [stream])

  return (
    <div className="mic-meter" role="img" aria-label="Microphone level">
      <div className="mic-meter-bar" ref={barRef} />
    </div>
  )
}
