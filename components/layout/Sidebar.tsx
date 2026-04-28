"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  User,
  Users,
  UsersRound,
  BarChart2,
  PieChart,
  Crosshair,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  Map,
  Target,
  Ruler,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Role } from "@prisma/client";

// Rôles qui ont accès au dashboard global (pas les commerciaux purs)
const DASHBOARD_ROLES = [
  Role.ADMIN,
  Role.COMMERCIAL_PRINCIPAL,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
];

// Rôles qui ont une page "Mes Performances" (commerciaux individuels)
const PERFORMANCE_ROLES = [
  Role.COMMERCIAL_TERRAIN,
  Role.COMMERCIAL_TELEVENTE,
  Role.COMMERCIAL_GRAND_COMPTE,
  Role.MERCHANDISEUR,
  Role.AUTRES,
];

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: DASHBOARD_ROLES },
  { href: "/commercial/me", label: "Mes Performances", icon: User, roles: PERFORMANCE_ROLES },
  { href: "/clients", label: "Clients", icon: Users, roles: null },
  {
    href: "/map",
    label: "Carte",
    icon: Map,
    roles: [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE],
  },
  {
    href: "/analyses",
    label: "Analyses",
    icon: BarChart2,
    roles: [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE],
  },
  {
    href: "/segmentation",
    label: "Segmentation",
    icon: PieChart,
    roles: [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE],
  },
  { href: "/prospects", label: "Prospects", icon: Crosshair, roles: null },
  {
    href: "/commerciaux",
    label: "Commerciaux",
    icon: UsersRound,
    roles: [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE],
  },
  {
    href: "/metrage",
    label: "Métrage",
    icon: Ruler,
    roles: DASHBOARD_ROLES,
  },
  { href: "/objectifs", label: "Objectifs", icon: Target, roles: null },
  { href: "/admin", label: "Administration", icon: Settings, roles: [Role.ADMIN] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  // Cacher le rôle pour éviter que le menu disparaisse pendant le rechargement de session
  const [cachedRole, setCachedRole] = useState<Role | undefined>(undefined);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      setCachedRole(session.user.role as Role);
    }
  }, [status, session?.user?.role]);

  const userRole = cachedRole ?? (session?.user?.role as Role | undefined);

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!userRole) return false;
    return (item.roles as string[]).includes(userRole);
  });

  return (
    <aside
      className={`relative flex flex-col bg-[#1E40AF] text-white h-screen transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      } flex-shrink-0`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-blue-700">
        <Building2 className="w-7 h-7 flex-shrink-0" />
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight truncate">CRM Commercial</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                isActive
                  ? "bg-white text-[#1E40AF] font-semibold"
                  : "hover:bg-blue-700 text-white"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-blue-700 px-3 py-4 space-y-2">
        {!collapsed && session?.user && (
          <div className="px-2 text-xs text-blue-200 truncate">
            <p className="font-medium text-white truncate">{session.user.name}</p>
            <p className="truncate">{session.user.role?.replace(/_/g, " ")}</p>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-700 w-full text-left transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Déconnexion</span>}
        </button>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 bg-white text-[#1E40AF] rounded-full shadow p-1 border border-gray-200 hover:bg-gray-50"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
