/** Eight-point girih star mark + wordmark */
export function Star({ size = 54 }: { size?: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 19 : 30;
    pts.push(`${32 + Math.cos(a) * r},${32 + Math.sin(a) * r}`);
  }
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <polygon points={pts.join(' ')} fill="#2bb3c0" />
      <polygon points={pts.map((p) => p.split(',').map((v) => 32 + (Number(v) - 32) * 0.55).join(',')).join(' ')} fill="#0e1b2c" />
      <circle cx="32" cy="32" r="6" fill="#e9b44c" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="logo" style={{ justifyContent: 'center' }}>
      <Star />
      <h1>
        UZBEK LIFE
        <span>OPEN WORLD</span>
      </h1>
    </div>
  );
}
