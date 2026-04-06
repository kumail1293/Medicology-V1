import { useState, useEffect } from "react";
import { PageTransition } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, UserPlus, UserCheck, UserX, Inbox, ChevronRight, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BuddyUser {
  id: number;
  name: string;
  college: string;
  university?: string;
  year: number;
  email?: string;
  buddyStatus?: string | null;
  buddyId?: number | null;
}

interface BuddyRequest {
  id: number;
  requesterId: number;
  status: string;
  requester?: BuddyUser;
}

export default function BuddiesPage() {
  const [buddies, setBuddies] = useState<BuddyUser[]>([]);
  const [requests, setRequests] = useState<BuddyRequest[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<BuddyUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [activeTab, setActiveTab] = useState<"buddies" | "search" | "requests">("buddies");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const token = localStorage.getItem("medicology_token");

  const api = async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers || {}) } });
    return res.json();
  };

  const load = async () => {
    setLoading(true);
    try {
      const [buddiesData, reqData] = await Promise.all([
        api("/api/buddies"),
        api("/api/buddies/requests"),
      ]);
      setBuddies(buddiesData.buddies || []);
      setRequests(reqData.requests || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api(`/api/buddies/search?q=${encodeURIComponent(search)}`);
        setSearchResults(data.users || []);
      } catch {
        setSearching(false);
        toast({ title: "Search failed. Please check your connection.", variant: "destructive" });
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const sendRequest = async (recipientId: number) => {
    setIsActing(true);
    try {
      const data = await api("/api/buddies/request", { method: "POST", body: JSON.stringify({ recipientId }) });
      if (data.error) { toast({ title: data.error, variant: "destructive" }); return; }
      toast({ title: "Buddy request sent!" });
      setSearchResults(prev => prev.map(u => u.id === recipientId ? { ...u, buddyStatus: "pending" } : u));
    } finally {
      setIsActing(false);
    }
  };

  const respond = async (id: number, action: "accept" | "reject") => {
    setIsActing(true);
    try {
      const data = await api(`/api/buddies/${id}/respond`, { method: "PUT", body: JSON.stringify({ action }) });
      if (data.error) { toast({ title: data.error, variant: "destructive" }); return; }
      toast({ title: action === "accept" ? "Buddy added!" : "Request declined" });
      await load();
    } finally {
      setIsActing(false);
    }
  };

  const removeBuddy = async (buddyRelId: number) => {
    await api(`/api/buddies/${buddyRelId}`, { method: "DELETE" });
    toast({ title: "Removed from buddies" });
    await load();
  };

  const pendingCount = requests.length;

  return (
    <PageTransition className="space-y-6 max-w-4xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-display font-extrabold tracking-tight">Study Buddies</h1>
        <p className="text-muted-foreground mt-1">Connect with students studying the same QBank</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-2xl">
        {[
          { id: "buddies" as const, label: "My Buddies", count: buddies.length },
          { id: "search" as const, label: "Find Students", count: 0 },
          { id: "requests" as const, label: "Requests", count: pendingCount },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-border text-muted-foreground"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* My Buddies */}
      {activeTab === "buddies" && (
        <>
          {loading ? (
            <div className="text-center text-muted-foreground py-12 animate-pulse">Loading…</div>
          ) : buddies.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-semibold mb-2">No buddies yet</p>
                <p className="text-sm text-muted-foreground mb-4">Search for students and send buddy requests to connect.</p>
                <Button onClick={() => setActiveTab("search")} size="sm">Find Students</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {buddies.map(buddy => (
                <Card key={buddy.id} className="group hover:border-primary/40 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-extrabold text-primary shrink-0">
                        {buddy.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base truncate">{buddy.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{buddy.college}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="secondary" className="text-xs gap-1">
                            <GraduationCap size={10} /> Year {buddy.year}
                          </Badge>
                          {buddy.university && <span className="text-xs text-muted-foreground truncate">{buddy.university}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserCheck size={13} className="text-green-500" /> Connected
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 h-7 text-xs"
                        onClick={() => removeBuddy(buddy.id)}>
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Search */}
      {activeTab === "search" && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-11 pr-4 py-3 border border-border rounded-2xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {searching && <div className="text-center text-muted-foreground py-4 animate-pulse text-sm">Searching…</div>}

          {!searching && searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map(user => (
                <Card key={user.id} className="hover:border-primary/40 transition-all">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-extrabold text-primary shrink-0">
                      {user.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.college} · Year {user.year}</p>
                    </div>
                    {user.buddyStatus === "accepted" ? (
                      <Badge className="bg-green-500 text-white text-xs gap-1"><UserCheck size={10} /> Friends</Badge>
                    ) : user.buddyStatus === "pending" ? (
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    ) : (
                      <Button size="sm" className="gap-1 text-xs" disabled={isActing} onClick={() => sendRequest(user.id)}>
                        <UserPlus size={13} /> Add
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!searching && search.length >= 2 && searchResults.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">No students found. Try a different search.</div>
          )}

          {!search && (
            <div className="text-center text-muted-foreground py-8 text-sm">Type a name or email to search for students.</div>
          )}
        </div>
      )}

      {/* Requests */}
      {activeTab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No pending buddy requests</p>
              </CardContent>
            </Card>
          ) : (
            requests.map(req => (
              <Card key={req.id} className="hover:border-primary/40 transition-all">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-extrabold text-primary shrink-0">
                    {req.requester?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{req.requester?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">{req.requester?.college} · Year {req.requester?.year}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1 text-xs bg-green-500 hover:bg-green-600 text-white" disabled={isActing} onClick={() => respond(req.id, "accept")}>
                      <UserCheck size={13} /> Accept
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" disabled={isActing} onClick={() => respond(req.id, "reject")}>
                      <UserX size={13} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </PageTransition>
  );
}
