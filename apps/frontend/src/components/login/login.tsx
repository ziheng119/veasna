// src/components/login/login.tsx

"use client"

import { getUsers } from "@/lib/api/user/getUsers"
import { loginUser } from "@/lib/api/user/loginUser"
import { User } from "@/lib/types/user"
import { useUserStore } from "@/stores/useUserStore"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import CreatableSelect from 'react-select/creatable'

export default function Login() {

  const setUser = useUserStore((state) => state.setUser)
  const router = useRouter();

  const [selectedUsername, setSelectedUsername] = useState<string>("");
  const [initialUsers, setInitialUsers] = useState<User[]>([])
  const [options ,setOptions] = useState<{label: string, value: string}[]>([]);

  async function refreshUsers() {
    const users = await getUsers();
    setInitialUsers(users)
  }

  useEffect(() => {
    refreshUsers();
  }, [])

  useEffect(() => {
    setOptions(initialUsers.map(user => ({label: user.username, value: user.username})));
  }, [initialUsers])

  // const handleCreateUser = async (user: User) => {
  //   const createdUser = await addUser(user);
  //   toast.success(`Login Success: User ${createdUser.username} created`)
  // };

  const handleLogin = async () => {
    if (!selectedUsername || selectedUsername.trim() === "") {
      toast.error("Please select or create a username!");
      return;
    }

    try {
      // 1. Call loginUser, which handles both existing and new users on the backend
      const loggedInUser = await loginUser(selectedUsername);

      // 2. save the complete user object (id, username, token) to the store
      setUser(loggedInUser)

      toast.success(`Welcome, ${loggedInUser.username}!`);
      router.push('/');
    } catch (error) {
      console.error(error)
      toast.error("An error has occurred during login, please try again")
    }
  }

  return (
    <div
      className="bg-beige-default px-[30px] py-[30px] rounded-md border-[1px]"
    >
      <h2 className="font-bold text-[30px] mb-[30px] text-center">Log In</h2>

      <div className="flex items-center mb-[30px]">
        <p className="w-24">User</p>
        <CreatableSelect
          instanceId="login-creatable-select"
          isClearable
          className="w-[200px] text-black"
          onChange={(newValue) => setSelectedUsername(newValue?.value || '')}
          onCreateOption={(newUsername) => {
            setOptions((prev) => [...prev, { label: newUsername, value: newUsername }]);
            setSelectedUsername(newUsername);
          }}
          options={options}
          placeholder="Select or type name..."
        />
      </div>

      <button
        className="bg-green-default px-[10px] py-[5px] rounded-md border-[1px] block hover:cursor-pointer items-center mx-auto"
        onClick={handleLogin}
      >
        Login
      </button>

    </div>
  )
}