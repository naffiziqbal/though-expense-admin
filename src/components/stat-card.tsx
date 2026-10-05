import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: React.ReactNode;
};

export function StatCard({ label, value, hint, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
        {trend ? <div className="pt-1">{trend}</div> : null}
      </CardContent>
    </Card>
  );
}
