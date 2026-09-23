export function BrandWordmark({ className = "" }: { className?: string }) {
  return <span className={`pluoto-wordmark ${className}`}><img src="/pluoto-text.png" alt="Pluoto"/></span>;
}
