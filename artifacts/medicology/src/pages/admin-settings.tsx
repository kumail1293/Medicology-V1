import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, RotateCcw, Mail, Database, Shield, Bell } from 'lucide-react';

interface AdminSettings {
  siteName: string;
  apiUrl: string;
  enableEmailNotifications: boolean;
  maxFileUploadSize: number;
  sessionTimeout: number;
  enableAnalytics: boolean;
  maintenanceMode: boolean;
  requireMFA: boolean;
}

const defaultSettings: AdminSettings = {
  siteName: 'Medicology',
  apiUrl: '/api',
  enableEmailNotifications: true,
  maxFileUploadSize: 10,
  sessionTimeout: 30,
  enableAnalytics: true,
  maintenanceMode: false,
  requireMFA: false,
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleChange = (key: keyof AdminSettings, value: any) => {
    setSettings({ ...settings, [key]: value });
    setUnsavedChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error('Failed to save settings');
      toast({ title: 'Success', description: 'Settings saved successfully' });
      setUnsavedChanges(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset settings to defaults?')) {
      setSettings(defaultSettings);
      setUnsavedChanges(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Admin Settings</h2>
        <p className="text-sm text-muted-foreground">Configure system-wide preferences and behavior.</p>
      </div>

      <div className="grid gap-6">
        {/* General Settings */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <Settings size={18} className="text-primary" />
            <h3 className="font-semibold text-lg">General</h3>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Site Name</label>
            <input
              type="text"
              value={settings.siteName}
              onChange={(e) => handleChange('siteName', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">API Base URL</label>
            <input
              type="text"
              value={settings.apiUrl}
              onChange={(e) => handleChange('apiUrl', e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </div>
        </div>

        {/* Notification Settings */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <Bell size={18} className="text-primary" />
            <h3 className="font-semibold text-lg">Notifications</h3>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableEmailNotifications}
              onChange={(e) => handleChange('enableEmailNotifications', e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="font-medium">Email Notifications</span>
              <p className="text-xs text-muted-foreground">Send email alerts for system events</p>
            </div>
          </label>
        </div>

        {/* File & Storage Settings */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <Database size={18} className="text-primary" />
            <h3 className="font-semibold text-lg">Storage</h3>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Max File Upload Size (MB)</label>
            <input
              type="number"
              value={settings.maxFileUploadSize}
              onChange={(e) => handleChange('maxFileUploadSize', Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
            <p className="text-xs text-muted-foreground mt-1">Maximum file size users can upload</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Session Timeout (minutes)</label>
            <input
              type="number"
              value={settings.sessionTimeout}
              onChange={(e) => handleChange('sessionTimeout', Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
            <p className="text-xs text-muted-foreground mt-1">Auto-logout after inactivity</p>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableAnalytics}
              onChange={(e) => handleChange('enableAnalytics', e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="font-medium">Analytics Tracking</span>
              <p className="text-xs text-muted-foreground">Collect usage statistics</p>
            </div>
          </label>
        </div>

        {/* Security Settings */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <Shield size={18} className="text-primary" />
            <h3 className="font-semibold text-lg">Security</h3>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.requireMFA}
              onChange={(e) => handleChange('requireMFA', e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="font-medium">Require Multi-Factor Authentication</span>
              <p className="text-xs text-muted-foreground">Enforce MFA for all admin users</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="font-medium text-destructive">Maintenance Mode</span>
              <p className="text-xs text-muted-foreground">Disable access for non-admin users</p>
            </div>
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50"
        >
          <RotateCcw size={16} /> Reset
        </button>
        <button
          onClick={handleSave}
          disabled={!unsavedChanges || isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Save size={16} /> {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {unsavedChanges && (
        <div className="fixed bottom-6 right-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
          You have unsaved changes. Click "Save Settings" to apply them.
        </div>
      )}
    </div>
  );
}
