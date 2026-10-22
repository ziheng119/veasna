'use client';
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import LocationDropdown from "./LocationDropdown";
import { useLocationStore } from "@/stores/useLocationStore";
import { useLocationDataStore } from "@/stores/useLocationDataStore";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { ChevronDown, RefreshCw } from "lucide-react";
import { getLocations } from "@/lib/api/location";
import { useUserStore } from "@/stores/useUserStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import { NAVIGATION, canAccessPage } from "@/lib/permissions";

export default function TopNav() {

  const setLocations = useLocationStore((state) => state.setLocations);
  const fetchData = useLocationDataStore((state) => state.fetchData);
  const user = useUserStore((state) => state.user);
  const removeUser = useUserStore((state) => state.removeUser);
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshLocations() {
    const locations = await getLocations();
    setLocations(locations)
  }

  useEffect(() => {
    refreshLocations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    useRealtimeStore.getState().invalidate();
    try {
      await fetchData();
    } finally {
      setIsRefreshing(false);
    }
  }

  const handleLoginClick = () => {
    router.push("/login");
  };

  const handleLogout = () => {
    removeUser();
    router.push("/login");
  };

  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path;
  };

  const linkBaseClass = "rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-200";
  const activeLinkClass = "bg-primary/10 text-primary";
  const inactiveLinkClass = "text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-3">
        {/* Navigation Links */}
        <div className="flex flex-wrap items-center gap-1">
          {NAVIGATION.filter(item => canAccessPage(user?.role, item.href)).map(item => (
            <Link key={item.href} href={item.href}
              className={`${linkBaseClass} ${isActive(item.href) || (item.href === "/pharmacy" && pathname.startsWith("/pharmacy/")) ? activeLinkClass : inactiveLinkClass}`}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Refresh Button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-accent transition-colors"
            title="Refresh data"
          >
            <RefreshCw
            className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </Button>
          <LocationDropdown />
          {user?.token ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-border bg-background text-foreground hover:bg-accent hover:text-foreground font-semibold"
                >
                  {user.username}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(
                  <DropdownMenuItem onClick={() => router.push("/analytics")}>
                    Analytics
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={handleLoginClick}
              variant="outline"
              className="border-border bg-background text-foreground hover:bg-accent hover:text-foreground font-semibold"
            >
              Login
            </Button>
          )}
        </div>
      </div>
      {user?.role === "user" && <p className="px-6 pb-2 text-xs text-muted-foreground">User access: view all pages and create new records. Ask an admin to change saved data or queues.</p>}
    </nav>
  );
}
