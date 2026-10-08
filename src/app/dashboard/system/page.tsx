'use client';

import { useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, Copy, Download, RefreshCw, Send } from 'lucide-react';
import {
  createBackupDownloadLink,
  fetchSystemBackups,
  fetchSystemHealth,
  sendTestAlert,
} from '@/lib/api';
import type { SystemBackups, SystemHealth } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** Monitor runs every 15 min; flag it after two missed runs. */
const MONITOR_STALE_MS = 35 * 60 * 1000;
const BACKUP_STALE_MS = 26 * 60 * 60 * 1000;

function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function exact(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, yyyy, h:mm a');
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusBadge({ ok, label }: { ok: boolean | 'warn'; label: string }) {
  if (ok === 'warn') {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
        {label}
      </Badge>
    );
  }
  return <Badge variant={ok ? 'secondary' : 'destructive'}>{label}</Badge>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm sm:text-right">{children}</dd>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

export default function SystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [backups, setBackups] = useState<SystemBackups | null>(null);
  const [backupsError, setBackupsError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState(-1);
  /** When the data on screen was fetched — staleness is measured against this, not render time. */
  const [checkedAt, setCheckedAt] = useState(0);
  const [sendingTest, setSendingTest] = useState(false);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [link, setLink] = useState<{ fileName: string; url: string; expiresAt: string } | null>(null);
  const [linking, setLinking] = useState(false);
  const refreshing = loadedKey !== refreshKey;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchSystemHealth()
        .then((h) => {
          if (cancelled) return;
          setHealth(h);
          setHealthError(false);
        })
        .catch(() => !cancelled && setHealthError(true)),
      fetchSystemBackups()
        .then((b) => {
          if (cancelled) return;
          setBackups(b);
          setBackupsError(false);
        })
        .catch(() => !cancelled && setBackupsError(true)),
    ]).then(() => {
      if (cancelled) return;
      setCheckedAt(Date.now());
      setLoadedKey(refreshKey);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function onTestAlert() {
    setSendingTest(true);
    try {
      await sendTestAlert();
      toast.success('Test alert sent — check Telegram');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send test alert');
    } finally {
      setSendingTest(false);
    }
  }

  async function onCreateLink() {
    if (!confirmKey) return;
    setLinking(true);
    try {
      const res = await createBackupDownloadLink(confirmKey);
      setLink({ fileName: confirmKey.split('/').pop() ?? confirmKey, ...res });
      setConfirmKey(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create download link');
    } finally {
      setLinking(false);
    }
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7100';
  const m = health?.migrations;
  const alerts = health?.alerts;
  const monitorStale =
    !!alerts?.monitorLastRun && checkedAt - new Date(alerts.monitorLastRun.at).getTime() > MONITOR_STALE_MS;
  const backupStale =
    !!backups?.lastSuccessAt && checkedAt - new Date(backups.lastSuccessAt).getTime() > BACKUP_STALE_MS;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System"
        description="Infrastructure health, deployed version, alerts and database backups."
        actions={
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
        }
      />

      {healthError && !health ? (
        <Warning>
          <p className="font-medium">Could not reach the API at {apiUrl}.</p>
        </Warning>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Services
              {health ? (
                <StatusBadge
                  ok={health.status === 'ok' ? true : health.status === 'degraded' ? 'warn' : false}
                  label={health.status}
                />
              ) : null}
            </CardTitle>
            <CardDescription className="break-all">{apiUrl}</CardDescription>
          </CardHeader>
          <CardContent>
            {!health ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <dl className="divide-y">
                <Row label="Database">
                  <span className="inline-flex flex-wrap items-center gap-2 sm:justify-end">
                    <StatusBadge ok={health.database.ok} label={health.database.ok ? 'ok' : 'down'} />
                    {health.database.ok ? (
                      <span className="text-muted-foreground tabular-nums">
                        {health.database.latencyMs} ms · {health.database.version}
                      </span>
                    ) : (
                      <span className="text-destructive">{health.database.message}</span>
                    )}
                  </span>
                </Row>
                <Row label="Redis">
                  <StatusBadge
                    ok={!!health.redis?.ok}
                    label={health.redis?.ok ? 'ok' : (health.redis?.message ?? 'unknown')}
                  />
                </Row>
                <Row label="Environment">{health.nodeEnv}</Row>
                <Row label="Uptime">{duration(health.uptime)}</Row>
                <Row label="Checked">{exact(health.timestamp)}</Row>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Deployed version */}
        <Card>
          <CardHeader>
            <CardTitle>Deployed version</CardTitle>
            <CardDescription>The code the running API process was started from.</CardDescription>
          </CardHeader>
          <CardContent>
            {!health ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <dl className="divide-y">
                <Row label="Commit">
                  <span className="font-mono text-xs">{health.deploy.commit ?? 'unknown'}</span>
                </Row>
                <Row label="Message">
                  <span className="line-clamp-2">{health.deploy.commitMessage ?? '—'}</span>
                </Row>
                <Row label="Committed">{exact(health.deploy.committedAt)}</Row>
                <Row label="Server started">
                  {exact(health.deploy.startedAt)}{' '}
                  <span className="text-muted-foreground">({ago(health.deploy.startedAt)})</span>
                </Row>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Migrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Database migrations
              {m ? (
                <StatusBadge
                  ok={m.historyMissing || m.failed.length ? false : m.pending.length ? 'warn' : true}
                  label={
                    m.historyMissing
                      ? 'no history'
                      : m.failed.length
                        ? 'failed'
                        : m.pending.length
                          ? `${m.pending.length} pending`
                          : 'up to date'
                  }
                />
              ) : null}
            </CardTitle>
            <CardDescription>Migrations shipped with this build vs. applied to the database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!health ? (
              <Skeleton className="h-24 w-full" />
            ) : !m ? (
              <p className="text-sm text-muted-foreground">Could not read migration status.</p>
            ) : (
              <>
                <dl className="divide-y">
                  <Row label="Applied">
                    <span className="tabular-nums">
                      {m.applied} / {m.total}
                    </span>
                  </Row>
                  <Row label="Latest applied">
                    {m.latestApplied ? (
                      <span className="inline-flex flex-col sm:items-end">
                        <span className="break-all font-mono text-xs">{m.latestApplied.name}</span>
                        <span className="text-xs text-muted-foreground">{exact(m.latestApplied.appliedAt)}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </Row>
                </dl>
                {m.historyMissing ? (
                  <Warning>
                    <p className="font-medium">This database has no migration history.</p>
                    <p>
                      It was likely created with <code>prisma db push</code>. Deploys will fail at{' '}
                      <code>migrate deploy</code> until existing migrations are baselined. Don&apos;t run{' '}
                      <code>db push</code> or <code>migrate reset</code> on production.
                    </p>
                  </Warning>
                ) : null}
                {m.failed.length ? (
                  <Warning>
                    <p className="font-medium">Migration started but did not finish:</p>
                    {m.failed.map((n) => (
                      <p key={n} className="break-all font-mono text-xs">
                        {n}
                      </p>
                    ))}
                  </Warning>
                ) : null}
                {m.pending.length && !m.historyMissing ? (
                  <Warning>
                    <p className="font-medium">Not applied yet — the running code may expect these:</p>
                    {m.pending.map((n) => (
                      <p key={n} className="break-all font-mono text-xs">
                        {n}
                      </p>
                    ))}
                  </Warning>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Alerts
              {alerts ? (
                <StatusBadge
                  ok={!alerts.telegramConfigured ? false : alerts.firing.length ? 'warn' : true}
                  label={
                    !alerts.telegramConfigured
                      ? 'not configured'
                      : alerts.firing.length
                        ? `${alerts.firing.length} firing`
                        : 'all clear'
                  }
                />
              ) : null}
            </CardTitle>
            <CardDescription>Telegram alerts from @te_penny_bot, checked every 15 minutes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!health ? (
              <Skeleton className="h-24 w-full" />
            ) : !alerts ? (
              <p className="text-sm text-muted-foreground">Alert status unavailable (Redis unreachable).</p>
            ) : (
              <>
                <dl className="divide-y">
                  <Row label="Telegram">
                    {alerts.telegramConfigured
                      ? `configured · ${alerts.envLabel}`
                      : 'TELEGRAM_* not set on the API'}
                  </Row>
                  <Row label="Last monitor run">
                    {alerts.monitorLastRun ? (
                      <span className={monitorStale ? 'text-destructive' : undefined}>
                        {ago(alerts.monitorLastRun.at)} · {alerts.monitorLastRun.checks} checks
                      </span>
                    ) : (
                      'never'
                    )}
                  </Row>
                </dl>
                {monitorStale ? (
                  <Warning>
                    <p>The monitor hasn&apos;t run for over 30 minutes — alerts may not be arriving.</p>
                  </Warning>
                ) : null}
                {alerts.firing.length ? (
                  <ul className="space-y-2">
                    {alerts.firing.map((a) => (
                      <li
                        key={a.key}
                        className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">since {ago(a.since)}</p>
                        </div>
                        <StatusBadge ok={a.severity === 'critical' ? false : 'warn'} label={a.severity} />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void onTestAlert()}
                  disabled={sendingTest || !alerts.telegramConfigured}
                >
                  <Send className="size-4" />
                  {sendingTest ? 'Sending…' : 'Send test alert'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Backups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            Database backups
            {backups?.lastSuccessAt ? (
              <StatusBadge ok={!backupStale} label={backupStale ? 'overdue' : 'healthy'} />
            ) : null}
          </CardTitle>
          <CardDescription>
            Nightly dumps stored in Spaces{backups?.bucket ? ` (${backups.bucket})` : ''}. Download links expire after
            an hour, are recorded in the audit log, and are announced on Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!backups && !backupsError ? (
            <Skeleton className="h-40 w-full" />
          ) : backupsError ? (
            <p className="text-sm text-muted-foreground">Could not load backups from storage.</p>
          ) : !backups?.configured ? (
            <p className="text-sm text-muted-foreground">Backup storage isn&apos;t configured on the API.</p>
          ) : (
            <>
              <p className="text-sm">
                <span className="text-muted-foreground">Last successful backup: </span>
                {backups.lastSuccessAt ? (
                  <span className={backupStale ? 'font-medium text-destructive' : undefined}>
                    {exact(backups.lastSuccessAt)} ({ago(backups.lastSuccessAt)})
                  </span>
                ) : (
                  <span className="text-muted-foreground">not visible from the API host</span>
                )}
                <span className="text-muted-foreground"> · {backups.total} stored</span>
              </p>
              {backups.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No backups stored yet.</p>
              ) : (
                <div className="-mx-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Created</TableHead>
                        <TableHead className="hidden sm:table-cell">File</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead className="pr-6 text-right">
                          <span className="sr-only">Download</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backups.items.map((b) => (
                        <TableRow key={b.key}>
                          <TableCell className="pl-6">
                            <span className="block">{exact(b.createdAt)}</span>
                            <span className="text-xs text-muted-foreground">{ago(b.createdAt)}</span>
                          </TableCell>
                          <TableCell className="hidden font-mono text-xs sm:table-cell">{b.fileName}</TableCell>
                          <TableCell className="text-right tabular-nums">{bytes(b.sizeBytes)}</TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button variant="ghost" size="sm" onClick={() => setConfirmKey(b.key)}>
                              <Download className="size-4" />
                              <span className="hidden sm:inline">Download</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirm before handing out the whole database */}
      <Dialog open={!!confirmKey} onOpenChange={(open) => !open && setConfirmKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a download link?</DialogTitle>
            <DialogDescription>
              This backup is the entire database — every user&apos;s email, password hash and expenses. The link works
              for anyone who has it for one hour. Creating it is recorded in the audit log and announced on Telegram.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all font-mono text-xs text-muted-foreground">{confirmKey?.split('/').pop()}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmKey(null)} disabled={linking}>
              Cancel
            </Button>
            <Button onClick={() => void onCreateLink()} disabled={linking}>
              {linking ? 'Creating…' : 'Create link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!link} onOpenChange={(open) => !open && setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download ready</DialogTitle>
            <DialogDescription>
              Expires {link ? exact(link.expiresAt) : ''}. Don&apos;t share or paste this link anywhere.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all font-mono text-xs text-muted-foreground">{link?.fileName}</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!link) return;
                void navigator.clipboard
                  .writeText(link.url)
                  .then(() => toast.success('Link copied'))
                  .catch(() => toast.error('Could not copy'));
              }}
            >
              <Copy className="size-4" />
              Copy link
            </Button>
            <Button render={<a href={link?.url} rel="noreferrer noopener" onClick={() => setLink(null)} />}>
              <Download className="size-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
