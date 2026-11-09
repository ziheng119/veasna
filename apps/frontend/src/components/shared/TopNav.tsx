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
import { NAVIGATION, canAccessPage, isAdmin } from "@/lib/permissions";
import { useFormOptionsStore } from "@/stores/useFormOptionsStore";
import { formatDayLabel } from "@/helper/format_date";
import { MENU_CHEVRON, MENU_TRIGGER } from "@/lib/motion";

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

  const pathname = usePathname();
  // Form choices change rarely (Station data page), so reload them on each page change.
  useEffect(() => {
    void useFormOptionsStore.getState().load();
  }, [pathname]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    useRealtimeStore.getState().invalidate();
    try {
      await Promise.all([fetchData(), useFormOptionsStore.getState().load()]);
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

  const isActive = (path: string) => {
    return pathname === path;
  };

  const linkBaseClass = "rounded-md px-3 py-2 text-sm font-semibold transition-[color,background-color,transform] duration-200 hover:-translate-y-px active:translate-y-0 active:scale-95 motion-reduce:transform-none";
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
            className="group text-foreground hover:bg-accent"
            title="Refresh data"
          >
            <RefreshCw
            className={`size-4 transition-transform duration-500 group-hover:rotate-90 motion-reduce:transition-none ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </Button>
          <LocationDropdown />
          {user?.token ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={MENU_TRIGGER}>
                  {user.username}
                  <ChevronDown className={MENU_CHEVRON} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {isAdmin(user.role) && <>
                  <DropdownMenuItem onClick={() => router.push("/analytics")}>
                    Analytics
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/station-data")}>
                    Station data
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/accounts")}>
                    Accounts
                  </DropdownMenuItem>
                </>}
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleLoginClick} variant="outline" className={MENU_TRIGGER}>
              Login
            </Button>
          )}
        </div>
      </div>
      {user?.role === "user" && (user.screening_date
        ? <p className="px-6 pb-2 text-xs text-muted-foreground">
            Screening day {formatDayLabel(user.screening_date)}: you see the patients queued that day and their earlier visits. Enter and correct their records; printing and downloads need the admin account.
          </p>
        : <p className="px-6 pb-2 text-xs text-muted-foreground">User access: view all pages, enter and correct records. Printing and downloads need the admin account.</p>)}
    </nav>
  );
}
