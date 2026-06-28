// src/components/login/login.tsx

"use client"

import { loginUser } from "@/lib/api/user/loginUser"
import { registerUser } from "@/lib/api/user/registerUser"
import { useUserStore } from "@/stores/useUserStore"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"

export default function Login() {
  const user = useUserStore((state) => state.user)
  const setUser = useUserStore((state) => state.setUser)
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.token) {
      router.replace("/");
    }
  }, [user, router]);

  const handleSubmit = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      toast.error("Please enter a username.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      const loggedInUser =
        mode === "login"
          ? await loginUser(normalizedUsername, password)
          : await registerUser(normalizedUsername, password);
      setUser(loggedInUser)

      toast.success(mode === "login" ? `Welcome, ${loggedInUser.username}!` : "Account created successfully!");
      router.push('/');
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Authentication failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="bg-beige-default px-[30px] py-[30px] rounded-md border-[1px]"
    >
      <h2 className="font-bold text-[30px] mb-[20px] text-center">
        {mode === "login" ? "Log In" : "Create Account"}
      </h2>

      <div className="flex items-center mb-[16px]">
        <p className="w-24">Username</p>
        <input
          className="w-[220px] rounded border border-gray-300 px-3 py-2 text-black bg-white"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          autoComplete="username"
        />
      </div>

      <div className="flex items-center mb-[24px]">
        <p className="w-24">Password</p>
        <input
          className="w-[220px] rounded border border-gray-300 px-3 py-2 text-black bg-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="At least 8 characters"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>

      <button
        className="bg-green-default px-[10px] py-[5px] rounded-md border-[1px] block hover:cursor-pointer items-center mx-auto disabled:opacity-60"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
      </button>

      <button
        className="mt-4 text-sm underline block mx-auto hover:cursor-pointer"
        onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}
      >
        {mode === "login" ? "New user? Create account" : "Already have an account? Log in"}
      </button>

    </div>
  )
}