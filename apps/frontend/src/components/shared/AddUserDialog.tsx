"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { registerUser } from "@/lib/api/user/registerUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddUserDialog({ open, onOpenChange }: AddUserDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setUsername("");
      setPassword("");
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    const normalizedUsername = username.trim();
    if (normalizedUsername.length < 3) {
      toast.error("Username must be at least 3 characters.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      const createdUsername = await registerUser(normalizedUsername, password);
      toast.success(`Account created for ${createdUsername}.`);
      handleOpenChange(false);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to create account";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Create an account for a clinic staff member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="new-username">Username</Label>
            <Input
              id="new-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
