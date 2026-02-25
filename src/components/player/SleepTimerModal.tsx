import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Moon, Clock, X } from "lucide-react";
import { useState, useEffect } from "react";

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetTimer: (minutes: number | null) => void;
  activeTimer: number | null;
}

const timerOptions = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
];

export function SleepTimerModal({ isOpen, onClose, onSetTimer, activeTimer }: SleepTimerModalProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(activeTimer);

  useEffect(() => {
    setTimeLeft(activeTimer);
  }, [activeTimer]);

  useEffect(() => {
    if (timeLeft && timeLeft > 0) {
      const interval = setInterval(() => {
        setTimeLeft((prev) => (prev ? prev - 1 : null));
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [timeLeft]);

  const formatTimeLeft = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m remaining`;
    }
    return `${mins}m remaining`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Moon className="w-5 h-5" />
            Sleep Timer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {activeTimer && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm">{formatTimeLeft(timeLeft || activeTimer)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetTimer(null)}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {timerOptions.map((option) => (
              <Button
                key={option.value}
                variant={activeTimer === option.value ? "default" : "outline"}
                onClick={() => {
                  onSetTimer(option.value);
                  onClose();
                }}
                className="w-full"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
