import { Link } from "react-router-dom";
import { ParticleBackground } from "@/components/effects/ParticleBackground";
import { MouseGlow } from "@/components/effects/MouseGlow";
import { NeonButton } from "@/components/ui/NeonButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { Music, Sparkles, Headphones, Zap } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";


export default function Landing() {
  const features = [
    { icon: Music, title: "Hindi Hits", desc: "Latest Bollywood songs & romantic melodies" },
    { icon: Sparkles, title: "Mood Vibes", desc: "Animated backgrounds that match song moods" },
    { icon: Headphones, title: "Lyrics View", desc: "Sing along with built-in lyrics display" },
    { icon: Zap, title: "Quick Search", desc: "Find songs and artists instantly" },
  ];

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/home");
    }
  }, [user, navigate]);

  return (

    <div className="min-h-screen relative overflow-hidden">
      <ParticleBackground particleCount={60} />
      <MouseGlow />

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5" />

        <div className="text-center z-10 animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-orbitron font-bold mb-6">
            <span className="gradient-text">RAANG BEAT</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience the best of Hindi music. Bollywood hits with stunning visualizations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/signup">
              <NeonButton size="lg">Get Started Free</NeonButton>
            </Link>
            <Link to="/login">
              <NeonButton variant="outline" size="lg">Sign In</NeonButton>
            </Link>
          </div>
        </div>

        {/* Animated rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full border border-primary/20 animate-pulse-ring" />
          <div className="absolute inset-0 w-[600px] h-[600px] rounded-full border border-accent/20 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-center mb-12 gradient-text">
            Next-Gen Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <GlassCard key={i} className="p-6 text-center" hover>
                <feature.icon className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
