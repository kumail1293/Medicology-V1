import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { useUpdateCurrentUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { User, Save, Lock, GraduationCap, Mail, Phone, BadgeCheck, Shield } from "lucide-react";

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

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [college, setCollege] = useState(user?.college ?? "");
  const [university, setUniversity] = useState(user?.university ?? "");
  const [year, setYear] = useState<number>(user?.year ?? 1);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    if (user && !hasInitialized.current) {
      setName(user.name);
      setEmail(user.email);
      setCollege(user.college);
      setUniversity(user.university ?? "");
      setYear(user.year);
      hasInitialized.current = true;
    }
  }, [user]);

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
        },
      });
      if (res.token && res.user) {
        login(res.token, res.user);
      }
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
        data: {
          currentPassword,
          newPassword,
        },
      });
      if (res.token && res.user) {
        login(res.token, res.user);
      }
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-3xl font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
          <p className="text-muted-foreground text-sm">{user.email}</p>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1.5 ${ROLE_COLORS[role] ?? ROLE_COLORS.user}`}>
            <Shield size={10} /> {ROLE_LABELS[role] ?? role}
          </span>
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
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Dr. John Doe"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Mail size={10} /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <GraduationCap size={10} /> Medical College
            </label>
            <input
              value={college}
              onChange={e => setCollege(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="King Edward Medical University"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">University / Affiliation</label>
              <input
                value={university}
                onChange={e => setUniversity(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="University of Health Sciences"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Academic Year</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {Object.entries(YEAR_LABELS).map(([y, label]) => (
                  <option key={y} value={y}>{label}</option>
                ))}
              </select>
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
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Enter current password"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Min. 6 characters"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Re-enter new password"
                />
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

      <div className="bg-muted/30 border border-border rounded-2xl px-6 py-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <BadgeCheck size={12} /> Account Info
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Member since</span>
            <p className="font-medium">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-PK", { year: "numeric", month: "long" }) : "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Reward Points</span>
            <p className="font-medium text-primary">{(user as any).rewardPoints ?? 0} pts</p>
          </div>
        </div>
      </div>
    </div>
  );
}
