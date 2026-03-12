"use client";

import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1E40AF] text-white flex items-center justify-center text-sm font-bold">
            {session?.user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden md:block">
            {session?.user?.name}
          </span>
        </div>
      </div>
    </header>
  );
}
