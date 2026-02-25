import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { AnimatedInput } from "@/components/ui/AnimatedInput";
import { ParticleBackground } from "@/components/effects/ParticleBackground";
import { MouseGlow } from "@/components/effects/MouseGlow";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

const passwordSchema = z.object({
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain an uppercase letter")
        .regex(/[0-9]/, "Password must contain a number"),
});

export default function ResetPassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const { updatePassword } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        const result = passwordSchema.safeParse({ password });
        if (!result.success) {
            setError(result.error.errors[0].message);
            return;
        }

        setIsLoading(true);
        const { error } = await updatePassword(password);
        setIsLoading(false);

        if (error) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        } else {
            setIsSuccess(true);
            toast({
                title: "Success",
                description: "Your password has been updated successfully.",
            });
            setTimeout(() => navigate("/login"), 3000);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <ParticleBackground particleCount={40} />
            <MouseGlow />

            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

            <div className="w-full max-w-md z-10 animate-fade-in">
                {!isSuccess && (
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
                    >
                        <ArrowLeft size={20} />
                        <span>Back to login</span>
                    </Link>
                )}

                <GlassCard className="p-8" glow>
                    {!isSuccess ? (
                        <>
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-orbitron font-bold gradient-text mb-2">
                                    New Password
                                </h1>
                                <p className="text-muted-foreground">
                                    Set your new secure password
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <AnimatedInput
                                    label="New Password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    error={error && !error.includes("match") ? error : ""}
                                />

                                <AnimatedInput
                                    label="Confirm New Password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    error={error.includes("match") ? error : ""}
                                />

                                <NeonButton
                                    type="submit"
                                    className="w-full"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                    ) : (
                                        "Update Password"
                                    )}
                                </NeonButton>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
                                <ShieldCheck className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-orbitron font-bold mb-4">
                                Password Updated
                            </h2>
                            <p className="text-muted-foreground mb-6">
                                Your password has been successfully reset. Redirecting you to login...
                            </p>
                            <Link to="/login">
                                <NeonButton variant="outline" className="w-full">
                                    Go to Login Now
                                </NeonButton>
                            </Link>
                        </div>
                    )}
                </GlassCard>
            </div>
        </div>
    );
}
