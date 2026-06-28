// src/components/login/login.tsx

"use client";

import { loginUser } from "@/lib/api/user/loginUser";
import { registerUser } from "@/lib/api/user/registerUser";
import { useUserStore } from "@/stores/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function Login() {
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
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
      setUser(loggedInUser);

      toast.success(
        mode === "login"
          ? `Welcome, ${loggedInUser.username}!`
          : "Account created successfully!",
      );
      router.push("/");
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="w-full max-w-md px-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <Card className="border-border/80 shadow-md">
        <CardHeader className="space-y-3 border-b border-border/70 pb-5">
          <CardTitle className="text-2xl">
            {mode === "login" ? "Welcome" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Sign in to continue to VEASNA."
              : "Set up your account for local clinic use."}
          </CardDescription>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => setMode("login")}
            >
              Login
            </Button>
            <Button
              type="button"
              variant={mode === "register" ? "default" : "outline"}
              onClick={() => setMode("register")}
            >
              Register
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="At least 8 characters"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
