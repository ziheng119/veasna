'use client';
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { BarChart3, LogOut, RefreshCw, SlidersHorizontal, UserCog } from "lucide-react";
import { useUserStore } from "@/stores/useUserStore";
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import { NAVIGATION, can, canAccessPage, isAdmin, permissionLabel, permissionsOf } from "@/lib/permissions";
import { useFormOptionsStore } from "@/stores/useFormOptionsStore";
import { formatDayLabel } from "@/helper/format_date";
import { MENU_TRIGGER } from "@/lib/motion";
import GuideButton from "@/components/guide/GuideButton";
import AccountMenu, { AccountMenuItem } from "./AccountMenu";

export default function TopNav() {
  const user = useUserStore((state) => state.user);
  const removeUser = useUserStore((state) => state.removeUser);
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pathname = usePathname();
  // Form choices change rarely (Station data page), so reload them on each page change.
  useEffect(() => {
    void useFormOptionsStore.getState().load();
  }, [pathname]);

  // Every open list reloads (live updates), along with the form choices.
  const handleRefresh = async () => {
    setIsRefreshing(true);
    useRealtimeStore.getState().invalidate();
    try {
      await useFormOptionsStore.getState().load();
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

  // Only what this account can open; the rest is not shown at all.
  const menuItems: AccountMenuItem[] = [
    ...(can(user, "analytics") ? [{ label: "Analytics", icon: BarChart3, onSelect: () => router.push("/analytics"),
      description: "Totals, trends and referral lists for a day or a period." }] : []),
    ...(isAdmin(user?.role) ? [
      { label: "Station data", icon: SlidersHorizontal, onSelect: () => router.push("/station-data"),
        description: "Change the choices offered in each station's forms, such as conditions and referral destinations." },
      { label: "Accounts", icon: UserCog, onSelect: () => router.push("/accounts"),
        description: "Make an account for each screening day and choose what it may do." },
    ] : []),
    { label: "Logout", icon: LogOut, onSelect: handleLogout, separated: true,
      description: "Sign out on this device. Anything typed but not saved stays here as a draft for a day." },
  ];

  // What a non-admin account may do, so staff know why something isn't there.
  const allowed = permissionsOf(user).map(permissionLabel);

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-3">
        {/* Navigation Links */}
        <div className="flex flex-wrap items-center gap-1" data-tour="nav">
          {NAVIGATION.filter(item => canAccessPage(user, item.href)).map(item => (
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
          {user?.token ? (
            <AccountMenu username={user.username} items={menuItems} />
          ) : (
            <Button onClick={handleLoginClick} variant="outline" className={MENU_TRIGGER}>
              Login
            </Button>
          )}
          {/* Last in the bar: the right-hand corner. */}
          {user?.token && <GuideButton />}
        </div>
      </div>
      {user?.role === "user" && (
        <p className="px-6 pb-2 text-xs text-muted-foreground">
          {user.screening_date ? `Screening day ${formatDayLabel(user.screening_date)}. ` : ""}
          {allowed.length
            ? <>This account can: {allowed.join(" · ")}.</>
            : <>This account can view the station queues only.</>}
          {" "}Anything else needs the admin to change this account in Accounts.
        </p>
      )}
    </nav>
  );
}
