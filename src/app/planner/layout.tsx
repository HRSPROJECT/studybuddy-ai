
"use client";

import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar"; 
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();

  if (authLoading && !user) { 
     return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex md:flex-col md:w-72 lg:w-80 shrink-0">
           { authLoading && !user ? ( 
            <div className="flex flex-1 items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <AppSidebar /> 
          )}
        </aside>
        <main className="flex flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
