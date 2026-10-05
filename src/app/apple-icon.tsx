import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0E9488 0%, #0F766E 100%)',
          borderRadius: 36,
        }}
      >
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="1.5" fill="white" fillOpacity="0.95" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" fill="white" fillOpacity="0.75" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" fill="white" fillOpacity="0.95" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" fill="white" fillOpacity="0.75" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
