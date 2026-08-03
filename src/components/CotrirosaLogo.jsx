export default function CotrirosaLogo({ className = "w-9 h-9" }) {
  return (
    <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" rx="40" fill="currentColor" />
      <text x="100" y="120" fontSize="90" fontWeight="700" fontFamily="sans-serif" textAnchor="middle" fill="white">
        CR
      </text>
    </svg>
  );
}