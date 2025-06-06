
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { 
  Home, 
  History, 
  ChevronRight,
  User,
  Settings,
  LogOut,
  Loader2,
  MessageSquareText,
  Users,
  CalendarCheck,
  Layers, // Icon for Flashcards
  Edit // Icon for Tests
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";


const sidebarNavItems = [
  { href: "/chat", label: "Home", icon: Home },
  { href: "/chat/history", label: "Homework History", icon: History }, 
  { href: "/community", label: "Community", icon: Users },
  { href: "/planner", label: "Study Planner", icon: CalendarCheck },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/tests", label: "Tests", icon: Edit },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: "Could not log you out. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-full w-full flex-col border-r bg-muted/30">
      <ScrollArea className="flex-1 py-2">
        <nav className="grid items-start px-2 text-sm font-medium">
          {sidebarNavItems.map((item) => {
            const isActive = pathname === item.href || 
                             (item.href === "/chat" && pathname.startsWith("/chat/") && !pathname.startsWith("/chat/history") && !pathname.startsWith("/community") && !pathname.startsWith("/planner") && !pathname.startsWith("/flashcards") && !pathname.startsWith("/tests")) ||
                             pathname.startsWith(item.href + "/") || // General case for nested routes
                             (item.href === "/tests" && pathname.startsWith("/tests")); // Specific for /tests and /tests/[id]
            
            // Special handling for history to avoid conflict with /chat/[id]
            const isHistoryActive = item.href === "/chat/history" && pathname === "/chat/history";


            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-foreground transition-all hover:bg-accent/50 hover:text-accent-foreground",
                  (isActive || isHistoryActive) && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {(item as any).hasArrow && <ChevronRight className="ml-auto h-4 w-4" />}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="mt-auto border-t p-2">
        {authLoading ? (
          <div className="flex items-center justify-center p-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start text-left">
                <Avatar className="mr-2 h-7 w-7">
                  <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "User"} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : <User size={16}/>)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-medium truncate">{user.displayName || "User"}</span>
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" side="top" align="start">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
           <Button variant="outline" className="w-full" asChild>
             <Link href="/login">Log In</Link>
           </Button>
        )}
      </div>
    </div>
  );
}
