"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { withPlainErrors } from "@/lib/errors";

export const signUp = withPlainErrors(async function signUp(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const name = String(formData.get("name") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) return { error: error.message };
  redirect("/dashboard");
});

export const signIn = withPlainErrors(async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  redirect("/dashboard");
});

export const signOut = withPlainErrors(async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
});

export const requestPasswordReset = withPlainErrors(async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email"));
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });
  if (error) return { error: error.message };
  return { success: true };
});

export const updatePassword = withPlainErrors(async function updatePassword(formData: FormData) {
  const password = String(formData.get("password"));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
});

export const signInWithGoogle = withPlainErrors(async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  });
  if (error || !data.url) {
    redirect("/login?error=google_signin_failed");
  }
  redirect(data.url);
});
