"use client";

import { useState } from "react";
import { api } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";

export function TestGroupButton() {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/users');
      if (response.data && response.data.status === 'success') {
        setMembers(response.data.data);
      } else {
        setError(response.data.message || "Unknown error");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-slate-200/60 mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-600">
          <Users className="w-5 h-5" /> 
          Test Google Sheets API
        </CardTitle>
        <CardDescription>
          Click below to test reading data directly from Google Sheets using your Google Login credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={fetchMembers} disabled={loading} className="mb-4">
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {loading ? "Fetching..." : "Fetch Users Sheet"}
        </Button>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-md text-sm whitespace-pre-wrap">
            <strong>Error:</strong> {error}
            <br />
            <span className="text-red-500 mt-2 block">
              💡 Hint: Did you enable "Google Sheets API" in your Google Cloud Console? Also make sure you added NEXT_PUBLIC_GOOGLE_SHEET_ID in .env.local
            </span>
          </div>
        )}

        {members && (
          <div className="mt-4 p-4 bg-slate-50 rounded-md max-h-60 overflow-y-auto">
            <h4 className="font-semibold mb-2">Members ({members.length})</h4>
            <ul className="space-y-1">
              {members.length === 0 && <li className="text-sm text-slate-500">No members found.</li>}
              {members.map((m: any, idx: number) => (
                <li key={idx} className="text-sm border-b pb-1 last:border-0 border-slate-200">
                  <span className="font-medium">{m.email}</span> <span className="text-slate-400 text-xs">({m.role})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
