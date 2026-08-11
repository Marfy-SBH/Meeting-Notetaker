import { Mic } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-primary text-primary-foreground">
            <Mic className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold text-foreground">Meeting Note Taker</span>
        </div>
        {children}
      </div>
    </div>
  );
}
