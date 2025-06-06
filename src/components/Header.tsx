
"use client";

import { BookOpenText } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background/80 px-4 shadow-sm backdrop-blur-md md:px-6">
      <Link href="/chat" className="flex items-center gap-2">
        <BookOpenText className="h-7 w-7 text-primary" />
        <span className="font-headline text-2xl font-semibold text-foreground">StudyBuddy AI</span>
      </Link>
      {user && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Welcome, {user.displayName || user.email}
          </span>
          {/* Logout button is now in AppSidebar user dropdown */}
        </div>
      )}
    </header>
  );
}
