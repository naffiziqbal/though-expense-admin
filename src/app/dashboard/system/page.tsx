'use client';

import { useEffect, useState } from 'react';
import { fetchSystemHealth } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function SystemPage() {
  const [health, setHealth] = useState<Awaited<ReturnType<typeof fetchSystemHealth>> | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7100';

  useEffect(() => {
    fetchSystemHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System</h1>
        <p className="text-sm text-muted-foreground">API connectivity and environment</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Base URL:</span> {apiUrl}
          </p>
          {!health ? (
            <Skeleton className="h-6 w-32" />
          ) : (
            <>
              <p className="flex items-center gap-2">
                Status:{' '}
                <Badge variant={health.status === 'ok' ? 'default' : 'destructive'}>{health.status}</Badge>
              </p>
              {health.redis && (
                <p className="flex items-center gap-2">
                  Redis:{' '}
                  <Badge variant={health.redis.ok ? 'default' : 'destructive'}>
                    {health.redis.ok ? 'ok' : health.redis.message}
                  </Badge>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Environment:</span> {health.nodeEnv}
              </p>
              <p>
                <span className="text-muted-foreground">Uptime:</span> {Math.round(health.uptime)}s
              </p>
              <p>
                <span className="text-muted-foreground">Checked:</span>{' '}
                {new Date(health.timestamp).toLocaleString()}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin access</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Console operators live in the <code className="rounded bg-muted px-1">Admin</code> table.
          Create accounts with <code className="rounded bg-muted px-1">pnpm admin:create</code> on the server.
          Admin JWTs use <code className="rounded bg-muted px-1">purpose: admin_access</code> and cannot access user app routes.
        </CardContent>
      </Card>
    </div>
  );
}
