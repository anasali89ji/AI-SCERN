import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const title = searchParams.get('title') || 'Aiscern — Free AI Detector'
  const tool  = searchParams.get('tool')  || 'Multi-Modal'
  const color = searchParams.get('color') || '#2563eb'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px', height: '630px',
          background: 'linear-gradient(135deg, #0c0c12 0%, #13131f 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Glow accent */}
        <div style={{
          position: 'absolute', width: '600px', height: '300px',
          background: color, borderRadius: '50%',
          filter: 'blur(120px)', opacity: 0.15, top: '100px',
          display: 'flex',
        }} />
        {/* Logo */}
        <div style={{ fontSize: 28, fontWeight: 700, color: '#64748b', marginBottom: 24, display: 'flex', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          AISCERN
        </div>
        {/* Title */}
        <div style={{
          fontSize: 52, fontWeight: 900, color: '#f1f5f9',
          textAlign: 'center', maxWidth: 960,
          lineHeight: 1.15, marginBottom: 28, display: 'flex',
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {title}
        </div>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {['Free', 'No Signup', `${tool} Detection`].map(badge => (
            <div key={badge} style={{
              padding: '8px 20px', borderRadius: 999,
              border: `1.5px solid ${color}40`,
              background: `${color}15`,
              color: '#94a3b8', fontSize: 18, fontWeight: 600,
              display: 'flex',
            }}>
              {badge}
            </div>
          ))}
        </div>
        {/* URL */}
        <div style={{ position: 'absolute', bottom: 36, fontSize: 18, color: '#475569', display: 'flex' }}>
          aiscern.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
