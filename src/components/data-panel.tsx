import { cn } from '@/lib/utils';

type DataPanelProps = {
  children: React.ReactNode;
  className?: string;
};

/** Bordered surface for tables and dense lists */
export function DataPanel({ children, className }: DataPanelProps) {
  return (
    <div className={cn('overflow-hidden rounded-md border bg-background', className)}>
      {children}
    </div>
  );
}
