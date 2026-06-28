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

  const linkBaseClass = "mr-[20px] pb-2 border-b-2 transition-colors duration-200";
  const activeLinkClass = "border-primary-foreground";
  const inactiveLinkClass = "border-transparent hover:border-primary-foreground/60";

  return (
    <nav className="grow bg-primary text-primary-foreground font-bold py-[13px]">
      <div className="flex justify-between items-center mx-10">
        {/* Navigation Links */}
        <div className="flex">
          <Link
            href="/"
            className={`${linkBaseClass} ${isActive('/') ? activeLinkClass : inactiveLinkClass}`}
          >
            Home
          </Link>
          <Link
            href="/patient-list"
            className={`${linkBaseClass} ${isActive('/patient-list') ? activeLinkClass : inactiveLinkClass}`}
          >
            Patient List
          </Link>
          <Link
            href="/triage"
            className={`${linkBaseClass} ${isActive('/triage') ? activeLinkClass : inactiveLinkClass}`}
          >
            Triage
          </Link>
          <Link
            href="/seva"
            className={`${linkBaseClass} ${isActive('/seva') ? activeLinkClass : inactiveLinkClass}`}
          >
            Seva
          </Link>
          <Link
            href="/physiotherapy"
            className={`${linkBaseClass} ${isActive('/physiotherapy') ? activeLinkClass : inactiveLinkClass}`}
          >
            Physiotherapy
          </Link>
          <Link
            href="/doctors-consultation"
            className={`${linkBaseClass} ${isActive('/doctors-consultation') ? activeLinkClass : inactiveLinkClass}`}
          >
            Consult
          </Link>
          
          <Link
            href="/pharmacy"
            className={`${linkBaseClass} ${isActive('/pharmacy') ? activeLinkClass : inactiveLinkClass}`}
          >
            Pharmacy
          </Link>
        </div>

        {/* Refresh Button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
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
                  className="border-primary-foreground/80 text-primary-foreground hover:bg-primary-foreground hover:text-primary font-semibold"
                >
                  {user.username}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={handleLoginClick}
              variant="outline"
              className="border-primary-foreground/80 text-primary-foreground hover:bg-primary-foreground hover:text-primary font-semibold"
            >
              Login
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}