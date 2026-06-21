"use client";

import { useUserStore } from "@/stores/useUserStore";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Footer() {
  const [isHovered, setIsHovered] = useState(false);
  const removeUser = useUserStore((state) => state.removeUser)
  const router = useRouter()

  const handleLogout = () => {
    removeUser()
    router.push('/login')
  }

  return (
    <>
      {/* Hover hotzone */}
      <div
        className="fixed bottom-0 left-0 w-full h-4 z-40"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Footer itself */}
      <footer
        className={`fixed bottom-0 left-0 w-full bg-gray-800 text-white py-4 px-6 z-50 transition-transform duration-300 ${
          isHovered ? "translate-y-0" : "translate-y-full"
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex justify-between items-center text-sm">
          <p className="text-white-default">© 2025 Veasna. All rights reserved.</p>
          <button
            onClick={handleLogout}
            className="text-white-default hover:text-gray-300 hover:cursor-pointer transition duration-200"
          >
            Logout
          </button>
        </div>
      </footer>
    </>
  );
}
