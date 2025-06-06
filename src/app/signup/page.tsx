"use client";

import { AuthForm } from "@/components/AuthForm";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set } from "firebase/database";

export default function SignupPage() {
  const handleSignup = async (values: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: values.displayName,
      });

      // Store additional user info in Realtime Database
      await set(ref(db, `users/${user.uid}`), {
        uid: user.uid,
        email: user.email,
        displayName: values.displayName,
        createdAt: new Date().toISOString(),
      });

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (error.code) {
        switch (error.code) {
          case "auth/email-already-in-use":
            throw new Error("This email address is already in use.");
          case "auth/weak-password":
            throw new Error("The password is too weak.");
          default:
            throw new Error(error.message || "Signup failed. Please try again.");
        }
      }
      throw new Error("An unexpected error occurred during signup.");
    }
  };

  return <AuthForm mode="signup" onSubmit={handleSignup} />;
}
