"use client";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
export default function UserMenu({ name }: { name: string }) { return <div className="user-menu"><span className="user-avatar">{name.slice(0,1).toUpperCase()}</span><button type="button" className="signout-button" onClick={() => void signOut({ callbackUrl: "/" })} aria-label="Sign out"><LogOut size={15}/><span>Sign out</span></button></div>; }
