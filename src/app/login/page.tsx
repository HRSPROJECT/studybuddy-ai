"use client";

import { AuthForm } from "@/components/AuthForm";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function LoginPage() {
  const handleLogin = async (values: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Firebase provides error.code and error.message
      if (error.code) {
        switch (error.code) {
          case "auth/user-not-found":
          case "auth/wrong-password":
          case "auth/invalid-credential":
            throw new Error("Invalid email or password.");
          default:
            throw new Error(error.message || "Login failed. Please try again.");
        }
      }
      throw new Error("An unexpected error occurred during login.");
    }
  };

  return <AuthForm mode="login" onSubmit={handleLogin} />;
}
