"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HTMLAttributes } from "react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod"; // Added this line

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BookOpenText } from "lucide-react";


const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

const signupSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters."}),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type AuthFormProps = HTMLAttributes<HTMLDivElement> & {
  mode: "login" | "signup";
  onSubmit: (values: any) => Promise<void>; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export function AuthForm({ className, mode, onSubmit, ...props }: AuthFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const schema = mode === "login" ? loginSchema : signupSchema;
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: mode === 'login' ? { email: "", password: "" } : { displayName: "", email: "", password: "" },
  });

  const handleSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      await onSubmit(values);
      toast({
        title: mode === "login" ? "Login Successful" : "Signup Successful",
        description: mode === "login" ? "Welcome back!" : "Your account has been created.",
      });
      router.push("/chat");
    } catch (error: unknown) {
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast({
        title: mode === "login" ? "Login Failed" : "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary p-4", className)} {...props}>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpenText size={32} />
          </div>
          <CardTitle className="font-headline text-3xl">
            {mode === "login" ? "Welcome Back to StudyBuddy AI" : "Join StudyBuddy AI"}
          </CardTitle>
          <CardDescription>
            {mode === "login" ? "Sign in to continue your learning journey." : "Create an account to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {mode === "signup" && (
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (mode === "login" ? "Signing In..." : "Creating Account...") : (mode === "login" ? "Sign In" : "Create Account")}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <Link href={mode === "login" ? "/signup" : "/login"} className="font-medium text-primary hover:underline">
              {mode === "login" ? "Sign Up" : "Sign In"}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
