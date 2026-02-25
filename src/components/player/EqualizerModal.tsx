import { useState, forwardRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Music, Zap, Volume2, Waves } from "lucide-react";

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreset: (preset: EqualizerPreset) => void;
  onBandChange: (bands: number[]) => void;
  currentBands: number[];
  bassBoost: number;
  onBassBoostChange: (value: number) => void;
}

export interface EqualizerPreset {
  name: string;
  bands: number[];
  bassBoost: number;
}

const presets: EqualizerPreset[] = [
  { name: "Flat", bands: [0, 0, 0, 0, 0, 0, 0, 0], bassBoost: 0 },
  { name: "Bass Boost", bands: [6, 5, 4, 2, 0, 0, 0, 0], bassBoost: 6 },
  { name: "Treble Boost", bands: [0, 0, 0, 0, 2, 4, 5, 6], bassBoost: 0 },
  { name: "Vocal", bands: [-2, -1, 0, 3, 4, 3, 0, -1], bassBoost: 0 },
  { name: "Rock", bands: [5, 4, 2, 0, -1, 0, 3, 5], bassBoost: 3 },
  { name: "Pop", bands: [1, 3, 4, 3, 1, 0, 1, 2], bassBoost: 2 },
  { name: "Jazz", bands: [3, 2, 1, 2, -1, -1, 0, 2], bassBoost: 1 },
  { name: "Classical", bands: [4, 3, 2, 1, 0, 1, 2, 4], bassBoost: 0 },
  { name: "Electronic", bands: [5, 4, 2, 0, 1, 3, 4, 5], bassBoost: 5 },
  { name: "Bollywood", bands: [4, 3, 2, 3, 4, 3, 2, 3], bassBoost: 4 },
];

const frequencies = ["60Hz", "170Hz", "310Hz", "600Hz", "1kHz", "3kHz", "6kHz", "12kHz"];

// Forward ref wrapper for DialogTitle to fix ref warning
const EqualizerDialogTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  (props, ref) => <DialogTitle ref={ref} {...props} />
);
EqualizerDialogTitle.displayName = "EqualizerDialogTitle";

export function EqualizerModal({
  isOpen,
  onClose,
  onApplyPreset,
  onBandChange,
  currentBands,
  bassBoost,
  onBassBoostChange,
}: EqualizerModalProps) {
  const [activePreset, setActivePreset] = useState<string>("Flat");

  const handlePresetClick = (preset: EqualizerPreset) => {
    setActivePreset(preset.name);
    onApplyPreset(preset);
  };

  const handleBandChange = (index: number, value: number[]) => {
    const newBands = [...currentBands];
    newBands[index] = value[0];
    onBandChange(newBands);
    setActivePreset("Custom");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl glass-card border-border/50 max-h-[90vh] overflow-y-auto">
        <div className="mb-4">
          <EqualizerDialogTitle className="gradient-text text-xl flex items-center gap-2">
            <Waves className="w-5 h-5" /> Equalizer & Audio Effects
          </EqualizerDialogTitle>
          <DialogDescription className="sr-only">
            Adjust equalizer settings and audio effects for your music
          </DialogDescription>
        </div>

        {/* Bass Boost Section */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-400" />
              <span className="font-medium">Bass Boost</span>
            </div>
            <span className="text-sm text-orange-400 font-mono">{bassBoost > 0 ? `+${bassBoost}` : bassBoost}dB</span>
          </div>
          <Slider
            value={[bassBoost]}
            min={-6}
            max={12}
            step={1}
            onValueChange={(value) => onBassBoostChange(value[0])}
            className="[&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-orange-400"
          />
        </div>

        {/* Presets Grid */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Music className="w-4 h-4" /> Presets
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  activePreset === preset.name
                    ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[0_0_15px_hsl(190_100%_50%/0.3)]"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Equalizer Bands */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Volume2 className="w-4 h-4" /> Frequency Bands
          </h3>
          <div className="flex items-end justify-between gap-2 h-48 px-2">
            {currentBands.map((value, index) => (
              <div key={index} className="flex flex-col items-center gap-2 flex-1">
                <div className="h-40 flex flex-col justify-center">
                  <Slider
                    orientation="vertical"
                    value={[value]}
                    min={-12}
                    max={12}
                    step={1}
                    onValueChange={(val) => handleBandChange(index, val)}
                    className="h-32"
                  />
                </div>
                <span className="text-xs text-muted-foreground">{frequencies[index]}</span>
                <span className={cn(
                  "text-xs font-mono",
                  value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-muted-foreground"
                )}>
                  {value > 0 ? `+${value}` : value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Visual feedback */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Live Preview</span>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">
              {activePreset}
            </span>
          </div>
          <div className="flex items-end justify-center gap-1 h-12">
            {currentBands.map((value, index) => (
              <div
                key={index}
                className="w-4 rounded-t bg-gradient-to-t from-primary to-accent transition-all duration-300"
                style={{ height: `${((value + 12) / 24) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
