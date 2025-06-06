
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { auth, db } from "@/lib/firebase";
import { updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { ref, update as updateDb } from "firebase/database";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCog, Mail, KeyRound } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const settingsSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }).max(50, { message: "Display name cannot exceed 50 characters." }),
  email: z.string().email().optional(), // Email is for display, not submission
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      displayName: "",
      email: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({ 
        displayName: user.displayName || "",
        email: user.email || "" 
      });
    }
  }, [user, form]);

  const onSubmit = async (data: SettingsFormValues) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to update settings.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Only update displayName if it has changed
      if (data.displayName !== user.displayName) {
        await updateProfile(user, { displayName: data.displayName });
        await updateDb(ref(db, `users/${user.uid}`), { displayName: data.displayName });
      }
      
      toast({
        title: "Settings Updated",
        description: "Your display name has been successfully updated.",
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      toast({
        title: "Update Failed",
        description: "Could not update your display name. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) {
      toast({
        title: "Error",
        description: "User email not available for password reset.",
        variant: "destructive",
      });
      return;
    }
    setIsResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({
        title: "Password Reset Email Sent",
        description: `An email has been sent to ${user.email} with instructions to reset your password.`,
      });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      toast({
        title: "Password Reset Failed",
        description: "Could not send password reset email. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
     return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p>Please log in to view settings.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <div className="mb-6 flex items-center gap-3">
        <UserCog className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl font-headline">
          User Settings
        </h1>
      </div>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your display name and manage account settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your display name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input {...field} readOnly disabled className="cursor-not-allowed bg-muted/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </form>
          </Form>
          
          <Separator className="my-8" />

          <div>
            <h3 className="text-lg font-medium mb-1 text-foreground">Account Management</h3>
            <p className="text-sm text-muted-foreground mb-4">Manage your account security.</p>
            <Button 
              variant="outline" 
              onClick={handlePasswordReset} 
              disabled={isResettingPassword}
              className="w-full sm:w-auto"
            >
              {isResettingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Reset Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
