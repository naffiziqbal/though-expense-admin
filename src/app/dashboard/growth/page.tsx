'use client';

import { useEffect, useState } from 'react';
import { fetchGrowth } from '@/lib/api';
import type { GrowthPoint } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const chartConfig = {
  signups: { label: 'Signups', color: 'hsl(var(--chart-1))' },
  premiumSignups: { label: 'Premium at signup', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

export default function GrowthPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<GrowthPoint[] | null>(null);

  useEffect(() => {
    setData(null);
    fetchGrowth(days).then(setData).catch(() => setData([]));
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Growth</h1>
          <p className="text-sm text-muted-foreground">New account registrations over time</p>
        </div>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <TabsList>
            <TabsTrigger value="7">7d</TabsTrigger>
            <TabsTrigger value="30">30d</TabsTrigger>
            <TabsTrigger value="90">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily signups</CardTitle>
          <CardDescription>Includes users who registered with premium already active (e.g. promo).</CardDescription>
        </CardHeader>
        <CardContent>
          {!data ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <BarChart data={data} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.slice(5)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="signups" fill="var(--color-signups)" radius={4} />
                <Bar dataKey="premiumSignups" fill="var(--color-premiumSignups)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
