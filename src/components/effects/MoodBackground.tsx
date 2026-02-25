import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface MoodBackgroundProps {
  mood?: string | null;
  isPlaying: boolean;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  type: "heart" | "tear" | "star" | "note" | "circle" | "spark" | "lotus" | "fire";
}

export function MoodBackground({ mood, isPlaying, className }: MoodBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize particles
    const initParticles = () => {
      const count =
        !mood
          ? 25
          : mood === "sad" || mood === "party" || mood === "workout"
          ? 60
          : mood === "romantic"
          ? 40
          : 30;
      particlesRef.current = Array.from({ length: count }, () => createParticle(canvas, mood, isPlaying));
    };

    initParticles();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Gradient overlay
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2
      );

      if (mood === "romantic") {
        gradient.addColorStop(0, "rgba(255, 100, 150, 0.12)");
        gradient.addColorStop(1, "rgba(255, 50, 100, 0)");
      } else if (mood === "sad") {
        gradient.addColorStop(0, "rgba(100, 150, 255, 0.10)");
        gradient.addColorStop(1, "rgba(50, 100, 255, 0)");
      } else if (mood === "chill") {
        gradient.addColorStop(0, "rgba(100, 255, 150, 0.10)");
        gradient.addColorStop(1, "rgba(50, 200, 100, 0)");
      } else if (mood === "party") {
        gradient.addColorStop(0, "rgba(180, 100, 255, 0.12)");
        gradient.addColorStop(1, "rgba(255, 50, 150, 0)");
      } else if (mood === "devotional") {
        gradient.addColorStop(0, "rgba(255, 200, 100, 0.10)");
        gradient.addColorStop(1, "rgba(255, 150, 50, 0)");
      } else if (mood === "workout") {
        gradient.addColorStop(0, "rgba(255, 100, 50, 0.12)");
        gradient.addColorStop(1, "rgba(255, 50, 0, 0)");
      } else {
        gradient.addColorStop(0, "rgba(100, 200, 255, 0.08)");
        gradient.addColorStop(1, "rgba(150, 100, 255, 0)");
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const speedMod = isPlaying ? 1 : 0.3;
      particlesRef.current.forEach((particle) => {
        updateParticle(particle, canvas, mood, speedMod);
        drawParticle(ctx, particle, mood, isPlaying ? 1 : 0.5);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [mood, isPlaying]);

  return <canvas ref={canvasRef} className={cn("fixed inset-0 pointer-events-none z-0", className)} />;
}

function createParticle(canvas: HTMLCanvasElement, mood?: string | null, isPlaying?: boolean): Particle {
  const types: Particle["type"][] =
    mood === "romantic"
      ? ["heart", "heart", "circle", "spark"]
      : mood === "sad"
      ? ["star", "spark", "note", "circle"]
      : mood === "chill"
      ? ["note", "circle", "circle"]
      : mood === "party"
      ? ["star", "spark", "note", "circle"]
      : mood === "devotional"
      ? ["lotus", "circle", "spark"]
      : mood === "workout"
      ? ["fire", "spark", "circle"]
      : ["circle", "star", "spark", "note"];

  const baseSpeed = isPlaying ? 1 : 0.3;
  const isFastMood = mood === "sad" || mood === "party" || mood === "workout";

  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * (isFastMood ? 2 : 0.8) * baseSpeed,
    vy:
      mood === "romantic"
        ? (-Math.random() * 0.5 - 0.2) * baseSpeed
        : (Math.random() - 0.5) * (isFastMood ? 1.5 : 0.8) * baseSpeed,
    size: Math.random() * 15 + 8,
    opacity: Math.random() * 0.4 + 0.1,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * (isFastMood ? 0.04 : 0.02),
    type: types[Math.floor(Math.random() * types.length)],
  };
}

function updateParticle(particle: Particle, canvas: HTMLCanvasElement, mood?: string | null, speedMod: number = 1) {
  particle.x += particle.vx * speedMod;
  particle.y += particle.vy * speedMod;
  particle.rotation += particle.rotationSpeed * speedMod;

  if (particle.x < -50) particle.x = canvas.width + 50;
  if (particle.x > canvas.width + 50) particle.x = -50;
  if (particle.y < -50) particle.y = canvas.height + 50;
  if (particle.y > canvas.height + 50) particle.y = -50;

  const rawOpacity = 0.45 + Math.sin(performance.now() * 0.0007 + particle.x * 0.01) * 0.18;
  particle.opacity = Math.max(0.08, Math.min(0.75, rawOpacity));
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle, mood?: string | null, alphaMod: number = 1) {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.globalAlpha = particle.opacity * alphaMod;

  const color =
    mood === "romantic"
      ? "rgba(255, 100, 150,"
      : mood === "sad"
      ? "rgba(100, 150, 255,"
      : mood === "chill"
      ? "rgba(100, 255, 180,"
      : mood === "party"
      ? "rgba(180, 100, 255,"
      : mood === "devotional"
      ? "rgba(255, 180, 80,"
      : mood === "workout"
      ? "rgba(255, 100, 50,"
      : "rgba(120, 180, 255,";

  switch (particle.type) {
    case "heart":
      drawHeart(ctx, particle.size, color);
      break;
    case "tear":
      drawTear(ctx, particle.size, color);
      break;
    case "star":
      drawStar(ctx, particle.size, color);
      break;
    case "note":
      drawNote(ctx, particle.size, color);
      break;
    case "spark":
      drawSpark(ctx, particle.size, color);
      break;
    case "lotus":
      drawLotus(ctx, particle.size, color);
      break;
    case "fire":
      drawFire(ctx, particle.size, color);
      break;
    default:
      drawCircle(ctx, particle.size, color);
  }

  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color + " 0.9)";
  ctx.beginPath();
  const s = size / 2;
  ctx.moveTo(0, s / 4);
  ctx.bezierCurveTo(-s, -s / 2, -s, s / 2, 0, s);
  ctx.bezierCurveTo(s, s / 2, s, -s / 2, 0, s / 4);
  ctx.fill();
  ctx.shadowColor = color + " 1)";
  ctx.shadowBlur = 14;
  ctx.fill();
}

function drawTear(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color + " 0.5)";
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.bezierCurveTo(size / 3, 0, size / 3, size / 2, 0, size / 2);
  ctx.bezierCurveTo(-size / 3, size / 2, -size / 3, 0, 0, -size / 2);
  ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color + " 0.7)";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const x = Math.cos(angle) * (size / 2);
    const y = Math.sin(angle) * (size / 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = color + " 1)";
  ctx.shadowBlur = 15;
  ctx.fill();
}

function drawNote(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.strokeStyle = color + " 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-size / 6, size / 4, size / 4, size / 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.moveTo(size / 12, size / 4);
  ctx.lineTo(size / 12, -size / 2);
  ctx.quadraticCurveTo(size / 2, -size / 3, size / 4, 0);
  ctx.stroke();
}

function drawSpark(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
  gradient.addColorStop(0, color + " 0.8)");
  gradient.addColorStop(1, color + " 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCircle(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
  gradient.addColorStop(0, color + " 0.4)");
  gradient.addColorStop(1, color + " 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

// Lotus shape for devotional mood
function drawLotus(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color + " 0.75)";
  const petals = 6;
  const r = size / 2;
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / petals);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.5, r * 0.25, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowColor = color + " 1)";
  ctx.shadowBlur = 12;
}

// Fire particle for workout mood
function drawFire(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color + " 0.8)";
  ctx.beginPath();
  const s = size / 2;
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.3, s * 0.4, s);
  ctx.lineTo(-s * 0.4, s);
  ctx.quadraticCurveTo(-s * 0.7, -s * 0.3, 0, -s);
  ctx.fill();
  ctx.shadowColor = color + " 1)";
  ctx.shadowBlur = 14;
  ctx.fill();
}
