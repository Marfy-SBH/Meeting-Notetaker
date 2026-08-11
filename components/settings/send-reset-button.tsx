"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/actions/auth";

export function SendResetButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      await requestPasswordReset(formData);
      setSent(true);
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleClick} disabled={pending || sent}>
      {sent ? "Reset link sent" : pending ? "Sending…" : "Send Reset Link"}
    </Button>
  );
}
