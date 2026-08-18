import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";
import { useUpdateCurrentUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { User, Save, Lock, GraduationCap, Mail, Phone, BadgeCheck, Shield, Camera, Loader2, Trash2, Gift, Calendar, Pencil } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";

const YEAR_LABELS: Record<number, string> = {
  1: "1st Year (Pre-Clinical)",
  2: "2nd Year (Pre-Clinical)",
  3: "3rd Year (Para-Clinical)",
  4: "4th Year (Clinical)",
  5: "5th Year (Clinical)",
  6: "House Officer",
};

const ROLE_LABELS: Record<string, string> = {
  user: "Student",
  editor: "Editor",
  teacher: "Teacher",
  reviewer: "MCQ Reviewer",
  admin: "Admin",
  superadmin: "Super Admin",
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  editor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  teacher: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  reviewer: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  admin: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  superadmin: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

export default function ProfilePage() {
  const { user, login, role } = useAuth();
  const { toast } = useToast();
  const updateUser = useUpdateCurrentUser();
  const hasInitialized = React.useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [college, setCollege] = useState(user?.college ?? "");
  const [university, setUniversity] = useState(user?.university ?? "");
  const [year, setYear] = useState<number>(user?.year ?? 1);
  const [bio, setBio] = useState((user as any)?.bio ?? "");
  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>((user as any)?.avatarUrl ?? null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user && !hasInitialized.current) {
      setName(user.name);
      setEmail(user.email);
      setCollege(user.college);
      setUniversity(user.university ?? "");
      setYear(user.year);
      setBio((user as any)?.bio ?? "");
      setPhone((user as any)?.phone ?? "");
      setAvatarUrl((user as any)?.avatarUrl ?? null);
      hasInitialized.current = true;
    }
  }, [user]);

  const refreshUser = (res: any) => {
    if (res?.token && res?.user) login(res.token, res.user);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image must be under 10 MB", variant: "destructive" });
      return;
    }
    const token = localStorage.getItem("medicology_token");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/storage/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAvatarUrl(data.url);
      // Persist the URL on the user record and refresh auth state.
      const upd = await updateUser.mutateAsync({ data: { avatarUrl: data.url } });
      refreshUser(upd);
      toast({ title: "Profile picture updated" });
    } catch (err: any) {
      toast({ title: err?.message ?? "Failed to upload picture", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const upd = await updateUser.mutateAsync({ data: { avatarUrl: null } });
      setAvatarUrl(null);
      refreshUser(upd);
      toast({ title: "Profile picture removed" });
    } catch {
      toast({ title: "Failed to remove picture", variant: "destructive" });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await updateUser.mutateAsync({
        data: {
          name: name.trim(),
          email: email.trim(),
          college: college.trim(),
          university: university.trim() || undefined,
          year,
          bio: bio.trim() || undefined,
          phone: phone.trim() || undefined,
        },
      });
      refreshUser(res);
      toast({ title: "Profile updated successfully" });
    } catch (err: any) {
      toast({ title: err?.message ?? "Failed to update profile", variant: "destructive" });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    try {
      const res = await updateUser.mutateAsync({
        data: { currentPassword, newPassword },
      });
      refreshUser(res);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
      toast({ title: "Password changed successfully" });
    } catch (err: any) {
      toast({ title: err?.message ?? "Failed to change password", variant: "destructive" });
    }
  };

  if (!user) return null;

  const inputCls = "w-full px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";
  const labelCls = "text-xs font-medium text-muted-foreground uppercase tracking-wide";
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-PK", { year: "numeric", month: "long" }) : "—";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header card with avatar upload */}
      <div className="relative overflow-hidden bg-card border border-border rounded-3xl shadow-sm">
        <div className="h-24 bg-gradient-to-r from-primary/25 via-accent/20 to-primary/10 border-b border-border/50" />
        <div className="px-6 pb-6 -mt-10 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="relative shrink-0">
            <UserAvatar name={user.name} src={avatarUrl} size={88} ring />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload profile picture"
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-card hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {user.name}
              {role !== "user" && <BadgeCheck size={18} className="text-primary" />}
            </h1>
            <p className="text-muted-foreground text-sm">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${ROLE_COLORS[role] ?? ROLE_COLORS.user}`}>
                <Shield size={10} /> {ROLE_LABELS[role] ?? role}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                <GraduationCap size={10} /> Year {user.year}
              </span>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 size={10} /> Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
          <div className="px-6 py-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Gift size={11} /> Reward Points</p>
            <p className="mt-1 text-lg font-extrabold text-primary">{(user as any).rewardPoints ?? 0} pts</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={11} /> Member Since</p>
            <p className="mt-1 text-lg font-extrabold">{memberSince}</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Pencil size={11} /> Profile</p>
            <p className="mt-1 text-lg font-extrabold truncate">{bio ? "Completed" : "Add a bio"}</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <User size={16} className="text-primary" /> Personal Information
          </h2>
        </div>
        <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)} required className={inputCls} placeholder="Dr. John Doe" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls + " flex items-center gap-1"}><Mail size={10} /> Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} placeholder="you@example.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls + " flex items-center gap-1"}><GraduationCap size={10} /> Medical College</label>
            <input value={college} onChange={e => setCollege(e.target.value)} required className={inputCls} placeholder="King Edward Medical University" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>University / Affiliation</label>
              <input value={university} onChange={e => setUniversity(e.target.value)} className={inputCls} placeholder="University of Health Sciences" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Academic Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>
                {Object.entries(YEAR_LABELS).map(([y, label]) => (
                  <option key={y} value={y}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls + " flex items-center gap-1"}><Phone size={10} /> Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+92 300 1234567" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls + " flex items-center gap-1"}>About me</label>
              <input value={bio} onChange={e => setBio(e.target.value)} className={inputCls} placeholder="Final year MBBS, passionate about cardiology" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updateUser.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {updateUser.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPasswordSection(!showPasswordSection)}
          className="w-full border-b border-border px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Lock size={16} className="text-primary" /> Change Password
          </h2>
          <span className="text-xs text-muted-foreground">{showPasswordSection ? "Close" : "Open"}</span>
        </button>

        {showPasswordSection && (
          <form onSubmit={handleChangePassword} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className={inputCls} placeholder="Enter current password" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className={inputCls} placeholder="Min. 6 characters" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={inputCls} placeholder="Re-enter new password" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={updateUser.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Lock size={14} />
                {updateUser.isPending ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
