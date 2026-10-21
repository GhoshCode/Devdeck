import { memo, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { skinFor } from '../lib/skin';

export const Backdrop = memo(function Backdrop() {
  const { backgroundImage, overlayOpacity, backgroundBlur, themeMode } = useStore((s) => s.settings);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isLight = themeMode === 'light';
  // Sonoma Glass paints its own calm backdrop in CSS: no mesh, no particles.
  const skin = useStore((s) => skinFor(s.settings));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let width = canvas.width;
    let height = canvas.height;
    
    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      char?: string;
    }

    const nodes: Node[] = [];
    const numNodes = 40;
    const glyphs = ['{', '}', ';', '/', '<', '>', '*'];

    const init = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      nodes.length = 0;
      for (let i = 0; i < numNodes; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          char: Math.random() > 0.7 ? glyphs[Math.floor(Math.random() * glyphs.length)] : undefined,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = isLight ? 'rgba(74, 78, 86, 0.30)' : 'rgba(255, 255, 255, 0.09)';
      ctx.strokeStyle = isLight ? 'rgba(74, 78, 86, 0.16)' : 'rgba(255, 255, 255, 0.055)';
      ctx.font = '14px var(--font-sans)';

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        
        if (!prefersReducedMotion) {
          node.x += node.vx;
          node.y += node.vy;

          if (node.x < 0 || node.x > width) node.vx *= -1;
          if (node.y < 0 || node.y > height) node.vy *= -1;
        }

        if (node.char) {
          ctx.fillText(node.char, node.x, node.y);
        } else {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < 22500) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      }

      if (!prefersReducedMotion) {
        animationFrame = requestAnimationFrame(draw);
      }
    };

    init();
    draw();

    window.addEventListener('resize', init);
    
    return () => {
      window.removeEventListener('resize', init);
      cancelAnimationFrame(animationFrame);
    };
  }, [isLight, skin]);

  const isGradient =
    backgroundImage &&
    (backgroundImage.startsWith('linear-gradient') || backgroundImage.startsWith('radial-gradient'));

  // Default light mode ambient mesh gradient if no custom background set
  const defaultLightMesh =
    'radial-gradient(at 0% 0%, rgba(199, 210, 254, 0.75) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(254, 205, 211, 0.6) 0px, transparent 50%), radial-gradient(at 50% 50%, rgba(224, 231, 255, 0.6) 0px, transparent 60%), radial-gradient(at 0% 100%, rgba(186, 230, 253, 0.7) 0px, transparent 55%), radial-gradient(at 100% 100%, rgba(253, 230, 138, 0.45) 0px, transparent 50%), linear-gradient(135deg, #eef2ff 0%, #f8fafc 50%, #f1f5f9 100%)';

  return (
    <div
      data-backdrop
      className="fixed inset-0 -z-10 bg-[var(--color-base)] transition-colors duration-300"
      style={{
        backgroundImage: !backgroundImage && isLight && !skin ? defaultLightMesh : undefined,
      }}
    >
      {backgroundImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-300"
          style={{ 
            backgroundImage: isGradient ? backgroundImage : `url("${backgroundImage}")`,
            filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
          }}
        />
      )}
      <div 
        className="absolute inset-0 bg-[var(--color-base)] transition-opacity duration-300" 
        style={{ opacity: backgroundImage ? (isLight ? 0.06 : overlayOpacity) : 0 }} 
      />
      {!skin && <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />}
    </div>
  );
});
